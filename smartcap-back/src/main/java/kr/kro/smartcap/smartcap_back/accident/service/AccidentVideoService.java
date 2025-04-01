package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentVideoRepository;
import kr.kro.smartcap.smartcap_back.util.S3Uploader;
import lombok.RequiredArgsConstructor;
import org.jcodec.api.awt.AWTSequenceEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AccidentVideoService {

    private final RedisTemplate<String, byte[]> redisTemplate;
    private final AccidentVideoRepository accidentVideoRepository;
    private final S3Uploader s3Uploader;

    // S3 버킷 및 폴더
    @Value("${s3.bucket-name}")
    private String bucketName;

    @Value("${s3.folder}")
    private String s3Folder;

    /**
     * deviceId로 Redis에 저장된 이미지들을 모아 초당 8프레임 영상 -> S3 업로드 -> accident_videos 테이블에 저장
     *
     * @param deviceId   디바이스 ID
     * @param accidentId 사고 기록 PK (accident_history.accident_id)
     * @return AccidentVideo 엔티티
     */
    public AccidentVideo createAccidentVideo(int deviceId, Long accidentId) {
        // 1) Redis에서 이미지 키 조회
        String pattern = "device:" + deviceId + ":image:*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            throw new IllegalStateException("No images found in Redis for deviceId=" + deviceId);
        }

        // 2) 키를 시간순 정렬 (키에 타임스탬프가 포함되어 있다고 가정)
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
                e.printStackTrace();
            }
        }
        if (frames.isEmpty()) {
            throw new IllegalStateException("No valid images decoded from Redis for deviceId=" + deviceId);
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

        // 6) DB(accident_videos) 저장
        AccidentVideo accidentVideo = new AccidentVideo();
        accidentVideo.setAccidentId(accidentId);
        accidentVideo.setVideoUrl(s3Url);
        AccidentVideo saved = accidentVideoRepository.save(accidentVideo);

        // 7) 임시 파일 삭제
        new File(localVideoPath).delete();

        return saved;
    }

    /**
     * Redis 키에서 타임스탬프 부분 추출
     * 예: device:1:image:1679999999999_123 -> 1679999999999
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
