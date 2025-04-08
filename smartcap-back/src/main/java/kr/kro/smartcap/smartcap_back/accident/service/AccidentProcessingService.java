package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.sse.AccidentSseEmitterHandler;
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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccidentProcessingService {

    // 필요 시 나중에 DB 저장을 위한 Repository (하루가 지나면 Redis -> DB 이전 로직에서 사용)
    private final AccidentHistoryRepository accidentHistoryRepository;
    private final AccidentVideoService accidentVideoService;
    private final AccidentSseEmitterHandler accidentSseEmitterHandler;
    // Redis 템플릿: gps, 날씨 등 문자열 데이터를 위한 템플릿과 객체 데이터를 위한 템플릿
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisTemplate<String, Object> objectRedisTemplate;

    private final RedisStatService redisStatService;

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
            // 테스트를 위해 임시 GPS 데이터 설정 (실제 환경에서는 제거)
            accidentHistoryRedisDto.setLat(37.5013);
            accidentHistoryRedisDto.setLng(127.0396);
            logger.info("Default GPS data set for testing: lat=37.5013, lng=127.0396");
        }

        // Redis에서 날씨 정보 조회 및 설정
        String weather = redisTemplate.opsForValue().get(WEATHER_KEY);
        if (weather != null && !weather.isEmpty()) {
            accidentHistoryRedisDto.setWeather(weather);
            logger.info("Weather data found in Redis: {}", weather);
        } else {
            accidentHistoryRedisDto.setWeather("맑음");
            logger.info("No weather data found in Redis. Default weather set: 맑음");
        }
        System.out.println("start");

        AccidentHistory savedHistory = accidentHistoryRepository.save(accidentHistory);
        logger.info("AccidentHistory saved: accidentId={}, constructionSitesId={}",
                savedHistory.getAccidentId(), savedHistory.getConstructionSitesId());

        
        System.out.println("gps");
        // Redis에 이미지가 있으면 영상 생성 및 DB 기록
        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideo(deviceId, savedHistory.getAccidentId());
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
        System.out.println("stat");

        // SSE 전송
        accidentSseEmitterHandler.sendAccidentToClients(savedHistory, accidentVideo);
    }
}

    /**
     * AccidentHistoryRedisDto의 정보를 기반으로, SSE 전송을 위한 AccidentHistory 엔티티 생성.
     */
    private AccidentHistory convertToAccidentHistory(AccidentHistoryRedisDto dto) {
        AccidentHistory accidentHistory = new AccidentHistory();
        accidentHistory.setConstructionSitesId(dto.getConstructionSitesId());
        accidentHistory.setAccidentType(dto.getAccidentType());
        accidentHistory.setCreatedAt(dto.getCreatedAt());
        accidentHistory.setWeather(dto.getWeather());

        // GPS 정보가 존재하면, JTS Geometry를 생성 (좌표 순서는 (lng, lat))
        if (dto.getLat() != 0.0 && dto.getLng() != 0.0) {
            GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
            Point point = geometryFactory.createPoint(new Coordinate(dto.getLng(), dto.getLat()));
            accidentHistory.setGps(point);
            logger.debug("GPS point created: lng={}, lat={}", dto.getLng(), dto.getLat());
        } else {
            // GPS 정보가 없거나 0,0인 경우 테스트용 기본값 사용
            GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
            Point point = geometryFactory.createPoint(new Coordinate(127.0396, 37.5013)); // 역삼역 근처 좌표
            accidentHistory.setGps(point);
            logger.info("Default GPS point created for testing: lng=127.0396, lat=37.5013");
        }
        return accidentHistory;
    }
}