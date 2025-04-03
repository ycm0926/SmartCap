package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.common.dto.CategoryInfo;
import kr.kro.smartcap.smartcap_back.common.util.AlarmCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AccidentProcessingService {

    private final AccidentHistoryRepository accidentHistoryRepository;
    private final AccidentVideoService accidentVideoService;
    // RedisTemplate for GPS data (assumed String type for simplicity)
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisTemplate<String, Object> objectRedisTemplate;

    private static final Logger logger = LoggerFactory.getLogger(AccidentProcessingService.class);

    @Transactional
    public void processAccident(int deviceId, AccidentHistoryDto dto) {
        AccidentHistoryRedisDto accidentHistoryRedisDto = new AccidentHistoryRedisDto();
        accidentHistoryRedisDto.setConstructionSitesId(dto.getConstructionSitesId());
        CategoryInfo info = AlarmCategoryMapper.map(dto.getAccidentType());

        accidentHistoryRedisDto.setAccidentType(info.getCategory());
        accidentHistoryRedisDto.setCreatedAt(Timestamp.from(Instant.now()));


        // Redis에서 "gps {deviceId}" 형식의 키로 gps 정보 조회
        String redisKey = "gps " + deviceId;
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(redisKey);
        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                accidentHistoryRedisDto.setLat(lat);
                accidentHistoryRedisDto.setLng(lng);
            } catch (Exception e) {
                logger.warn("Failed to parse GPS data from Redis for device {}: {}", deviceId, e.getMessage());
            }
        } else {
            logger.info("No GPS data found in Redis for device {}. GPS not set.", deviceId);
        }

        Long siteId = accidentHistoryRedisDto.getConstructionSitesId();
        String key = String.format("accident:%d:%s", siteId, LocalDate.now());
        objectRedisTemplate.opsForList().rightPush(key, accidentHistoryRedisDto);
        objectRedisTemplate.expire(key, Duration.ofDays(2));



        // Redis에 이미지가 있으면 영상 생성 및 DB 기록
        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideo(deviceId, accidentHistoryRedisDto.getConstructionSitesId());
        if (accidentVideo != null) {
            logger.info("AccidentVideo saved in DB: accidentVideoId={}, videoUrl={}",
                    accidentVideo.getAccidentVideoId(), accidentVideo.getVideoUrl());
        } else {
            logger.info("AccidentHistory saved without AccidentVideo.");
        }
    }
}
