package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.sse.AccidentSseEmitterHandler;
import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.common.dto.CategoryInfo;
import kr.kro.smartcap.smartcap_back.common.util.AlarmCategoryMapper;
import kr.kro.smartcap.smartcap_back.stats.service.RedisStatService;
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
import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AccidentProcessingService {

    private final AccidentHistoryRepository accidentHistoryRepository;
    private final AccidentVideoService accidentVideoService;
    // RedisTemplate for GPS data (assumed String type for simplicity)
    private final RedisTemplate<String, String> redisTemplate;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
    private final RedisStatService redisStatService;
    private final AccidentSseEmitterHandler accidentSseEmitterHandler;

    private static final Logger logger = LoggerFactory.getLogger(AccidentProcessingService.class);

    private static final String WEATHER_KEY = "current:weather";

    @Transactional
    public void processAccident(int deviceId, AccidentHistoryDto dto) {
        AccidentHistory accidentHistory = new AccidentHistory();
        accidentHistory.setConstructionSitesId(dto.getConstructionSitesId());

        CategoryInfo info = AlarmCategoryMapper.map(dto.getAccidentType());
        accidentHistory.setAccidentType(info.getCategory());
        accidentHistory.setCreatedAt(Timestamp.from(Instant.now()));

        // Redis에서 "gps {deviceId}" 형식의 키로 gps 정보 조회
        String redisKey = "gps " + deviceId;
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(redisKey);
        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                // JTS에서는 좌표 순서가 (x, y) 즉, (lng, lat)입니다.
                Point point = geometryFactory.createPoint(new Coordinate(lng, lat));
                accidentHistory.setGps(point);

            } catch (Exception e) {
                logger.warn("Failed to parse GPS data from Redis for device {}: {}", deviceId, e.getMessage());
            }
        } else {
            logger.info("No GPS data found in Redis for device {}. GPS not set.", deviceId);
        }

        setWeatherFromRedis(accidentHistory);

        AccidentHistory savedHistory = accidentHistoryRepository.save(accidentHistory);
        logger.info("AccidentHistory saved: accidentId={}, constructionSitesId={}",
                savedHistory.getAccidentId(), savedHistory.getConstructionSitesId());

        
        // Redis에 이미지가 있으면 영상 생성 및 DB 기록

//        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideo(deviceId, savedHistory.getAccidentId());
        //TODO: 시연 코드(삭제 해야하는 부분)
        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideoV2(deviceId, savedHistory.getAccidentId(), dto.getVideoUrl());
        if (accidentVideo != null) {
            logger.info("AccidentVideo saved in DB: accidentVideoId={}, videoUrl={}",
                    accidentVideo.getAccidentVideoId(), accidentVideo.getVideoUrl());
        } else {
            logger.info("AccidentHistory saved without AccidentVideo.");
        }

        // 레디스 통계 업데이트
        redisStatService.incrementStats(
                accidentHistory.getCreatedAt().toLocalDateTime(),
                accidentHistory.getAccidentType(),
                "3"
        );

        // SSE 전송
        accidentSseEmitterHandler.sendAccidentToClients(savedHistory, accidentVideo);
    }

    private void setWeatherFromRedis(AccidentHistory accidentHistory) {
        String weather = redisTemplate.opsForValue().get(WEATHER_KEY);

        if (weather != null && !weather.isEmpty()) {
            accidentHistory.setWeather(weather);
        } else {
            accidentHistory.setWeather("맑음");
            logger.info("No weather data found in Redis. Default weather set: 맑음");
        }
    }
}
