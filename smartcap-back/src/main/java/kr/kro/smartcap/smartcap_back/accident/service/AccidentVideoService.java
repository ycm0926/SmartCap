package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentVideoRepository;
import kr.kro.smartcap.smartcap_back.common.util.S3Uploader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jcodec.api.awt.AWTSequenceEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccidentVideoService {

    private final RedisTemplate<String, byte[]> redisTemplate;
    private final AccidentVideoRepository accidentVideoRepository;
    private final S3Uploader s3Uploader;

    @Value("${s3.bucket-name}")
    private String bucketName;

    @Value("${s3.folder}")
    private String s3Folder;

    /**
     * Redis에 저장된 이미지들을 모아 영상 생성, S3 업로드, DB(accident_videos) 기록.
     * 이미지 키가 없거나 유효 이미지가 하나도 없으면 null 반환.
     *
     * @param deviceId   디바이스 ID
     * @param accidentId 사고 기록 PK
     * @return AccidentVideo 엔티티, 없으면 null
     */
    public AccidentVideo createAccidentVideo(int deviceId, Long accidentId) {
        // 1) Redis에서 이미지 키 조회
        String pattern = "device:" + deviceId + ":image:*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            return null;
        }

        // 2) 키를 시간순 정렬 (타임스탬프 포함)
        List<String> sortedKeys = new ArrayList<>(keys);
        sortedKeys.sort((k1, k2) -> Long.compare(parseTimestamp(k1), parseTimestamp(k2)));

        // 3) Redis에서 이미지 데이터를 읽어 BufferedImage 목록으로 변환
        List<BufferedImage> frames = new ArrayList<>();
        for (String key : sortedKeys) {
            byte[] imageBytes = redisTemplate.opsForValue().get(key);
            if (imageBytes == null) continue;
            try {
                BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageBytes));
                if (img != null) {
                    frames.add(img);
                }
            } catch (Exception e) {
                // Redis 관련 로그는 남기지 않음
            }
        }
        if (frames.isEmpty()) {
            return null;
        }

        // 4) 영상 생성: AWTSequenceEncoder 사용 (fps 8)
        String localVideoPath = "temp_device_" + deviceId + ".mp4";
        try {
            File outFile = new File(localVideoPath);
            AWTSequenceEncoder encoder = AWTSequenceEncoder.createSequenceEncoder(outFile, 8);
            for (BufferedImage frame : frames) {
                encoder.encodeImage(frame);
            }
            encoder.finish();
        } catch (Exception e) {
            throw new RuntimeException("Failed to encode video with JCodec", e);
        }

        // 5) S3에 영상 파일 업로드
        String s3Key = s3Folder + "device_" + deviceId + "_" + Instant.now().toEpochMilli() + ".mp4";
        String s3Url = s3Uploader.uploadFile(new File(localVideoPath), bucketName, s3Key);

        // 6) DB에 AccidentVideo 기록
        AccidentVideo accidentVideo = new AccidentVideo();
        accidentVideo.setAccidentId(accidentId);
        accidentVideo.setVideoUrl(s3Url);
        AccidentVideo saved = accidentVideoRepository.save(accidentVideo);

        // 7) 임시 영상 파일 삭제
        new File(localVideoPath).delete();

        return saved;
    }

    /**
     * Redis에 저장된 압축된 이미지 데이터를 해제하여 영상 생성, S3 업로드, DB(accident_videos) 기록.
     * Redis 키가 없거나 유효 이미지가 하나도 없으면 null 반환.
     *
     * @param deviceId   디바이스 ID
     * @param accidentId 사고 기록 PK
     * @param redisKey   Redis에 저장된 압축 데이터 키
     * @return AccidentVideo 엔티티, 없으면 null
     */
    public AccidentVideo createAccidentVideoV2(int deviceId, Long accidentId, String redisKey) {
        // 1) Redis에서 압축된 데이터 조회
        byte[] compressedData = redisTemplate.opsForValue().get(redisKey);
        if (compressedData == null || compressedData.length == 0) {
            log.warn("No data found in Redis for key: {}", redisKey);
            return null;
        }

        // 2) zlib 압축 해제
        byte[] decompressedData;
        try {
            decompressedData = decompressZlib(compressedData);
        } catch (Exception e) {
            log.error("Failed to decompress data from Redis: {}", e.getMessage(), e);
            return null;
        }

        // 3) 바이너리 데이터 파싱 - 이미 JPEG로 인코딩된 프레임 데이터 추출
        List<BufferedImage> frames = new ArrayList<>();
        try {
            frames = extractFramesFromBinaryData(decompressedData);
        } catch (Exception e) {
            log.error("Failed to extract frames from binary data: {}", e.getMessage(), e);
            return null;
        }

        if (frames.isEmpty()) {
            log.warn("No valid frames extracted from Redis data");
            return null;
        }

        // 4) 영상 생성: AWTSequenceEncoder 사용 (fps 8)
        String localVideoPath = "temp_device_" + deviceId + ".mp4";
        try {
            File outFile = new File(localVideoPath);
            AWTSequenceEncoder encoder = AWTSequenceEncoder.createSequenceEncoder(outFile, 8);
            for (BufferedImage frame : frames) {
                encoder.encodeImage(frame);
            }
            encoder.finish();
            log.info("Created video with {} frames for device {}", frames.size(), deviceId);
        } catch (Exception e) {
            log.error("Failed to encode video with JCodec: {}", e.getMessage(), e);
            return null;
        }

        // 5) S3에 영상 파일 업로드
        String s3Key = s3Folder + "device_" + deviceId + "_" + Instant.now().toEpochMilli() + ".mp4";
        String s3Url = s3Uploader.uploadFile(new File(localVideoPath), bucketName, s3Key);

        log.info("Uploaded video to S3: {}", s3Url);

        // 6) DB에 AccidentVideo 기록
        AccidentVideo accidentVideo = new AccidentVideo();
        accidentVideo.setAccidentId(accidentId);
        accidentVideo.setVideoUrl(s3Url);
        AccidentVideo saved = accidentVideoRepository.save(accidentVideo);

        // 7) 임시 영상 파일 삭제
        new File(localVideoPath).delete();

        return saved;
    }

    /**
     * zlib으로 압축된 데이터 해제
     */
    private byte[] decompressZlib(byte[] compressedData) throws DataFormatException {
        Inflater inflater = new Inflater();
        inflater.setInput(compressedData);

        // 충분히 큰 버퍼 할당 (필요에 따라 조정)
        byte[] buffer = new byte[100 * 1024 * 1024]; // 100MB
        int decompressedLength = inflater.inflate(buffer);
        inflater.end();

        // 실제 크기에 맞게 배열 복사
        byte[] result = new byte[decompressedLength];
        System.arraycopy(buffer, 0, result, 0, decompressedLength);
        return result;
    }

    /**
     * 바이너리 데이터에서 프레임 추출
     * 형식:
     * - 4바이트: 프레임 수
     * - 각 프레임마다:
     *   - 8바이트: 타임스탬프
     *   - 4바이트: 프레임 데이터 크기
     *   - N바이트: JPEG 인코딩된 프레임 데이터
     */
    private List<BufferedImage> extractFramesFromBinaryData(byte[] data) throws IOException {
        List<BufferedImage> frames = new ArrayList<>();
        ByteBuffer buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);

        // 프레임 수 읽기
        int frameCount = buffer.getInt();
        log.info("Extracting {} frames from binary data", frameCount);

        // 각 프레임 처리
        for (int i = 0; i < frameCount; i++) {
            try {
                // 타임스탬프 읽기 (8바이트)
                long timestamp = buffer.getLong();

                // 프레임 크기 읽기 (4바이트)
                int frameSize = buffer.getInt();

                // 프레임 데이터 읽기
                byte[] frameData = new byte[frameSize];
                buffer.get(frameData);

                // JPEG 이미지로 디코딩
                BufferedImage img = ImageIO.read(new ByteArrayInputStream(frameData));
                if (img != null) {
                    frames.add(img);
                } else {
                    log.warn("Failed to decode frame #{}: null image returned", i);
                }
            } catch (Exception e) {
                log.warn("Error processing frame #{}: {}", i, e.getMessage());
            }
        }

        log.info("Successfully extracted {} frames out of {}", frames.size(), frameCount);
        return frames;
    }

    /**
     * Redis 키에서 타임스탬프 추출 (예: device:1:image:1679999999999_123 -> 1679999999999)
     */
    private long parseTimestamp(String key) {
        String[] parts = key.split(":");
        if (parts.length < 4) return 0L;
        String lastPart = parts[3];
        String[] subParts = lastPart.split("_");
        try {
            return Long.parseLong(subParts[0]);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
