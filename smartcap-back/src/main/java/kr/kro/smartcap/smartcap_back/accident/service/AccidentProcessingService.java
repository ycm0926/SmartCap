package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.sse.AccidentSseEmitterHandler;
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

    private static final Logger logger = LoggerFactory.getLogger(AccidentProcessingService.class);

    private static final String WEATHER_KEY = "current:weather";

    @Transactional
    public void processAccident(int deviceId, AccidentHistoryDto dto) {
        // Redis에 저장할 DTO 생성 및 기본 값 설정
        AccidentHistoryRedisDto accidentHistoryRedisDto = new AccidentHistoryRedisDto();
        accidentHistoryRedisDto.setConstructionSitesId(dto.getConstructionSitesId());
        // 기존 로직에서 alarm 카테고리 매핑 (필요에 따라 dto.getAccidentType() 그대로 사용할 수도 있음)
        CategoryInfo categoryInfo = AlarmCategoryMapper.map(dto.getAccidentType());
        String accidentTypeStr = categoryInfo.getCategory();

        // 알람 유형이 비어있다면 사고 유형 코드에 따라 기본값 설정
        if (accidentTypeStr == null || accidentTypeStr.isEmpty()) {
            switch (dto.getAccidentType()) {
                case 1:
                    accidentTypeStr = "낙상사고";
                    break;
                case 2:
                    accidentTypeStr = "충돌사고";
                    break;
                case 3:
                    accidentTypeStr = "협착사고";
                    break;
                case 4:
                    accidentTypeStr = "화재사고";
                    break;
                case 5:
                    accidentTypeStr = "감전사고";
                    break;
                default:
                    accidentTypeStr = "안전사고";
                    break;
            }
            logger.info("Empty accident type from mapper. Setting default type: {} for code: {}",
                    accidentTypeStr, dto.getAccidentType());
        }

        accidentHistoryRedisDto.setAccidentType(accidentTypeStr);
        Timestamp now = Timestamp.from(Instant.now());
        accidentHistoryRedisDto.setCreatedAt(now);

        // Redis에서 GPS 정보 조회 ("gps {deviceId}" 키 사용)
        String gpsRedisKey = "gps " + deviceId;
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(gpsRedisKey);
        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                accidentHistoryRedisDto.setLat(lat);
                accidentHistoryRedisDto.setLng(lng);
                logger.info("GPS data found and set for device {}: lat={}, lng={}", deviceId, lat, lng);
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

        // 하루치 사고 데이터를 Redis 리스트에 저장 (자동 만료: 2일)
        Long siteId = accidentHistoryRedisDto.getConstructionSitesId();
        String redisKey = String.format("accident:%d:%s", siteId, LocalDate.now());

        // 저장 전 데이터 최종 점검
        logger.info("Saving accident data to Redis: key={}, data={}", redisKey,
                String.format("siteId=%d, type=%s, lat=%.4f, lng=%.4f, weather=%s",
                        accidentHistoryRedisDto.getConstructionSitesId(),
                        accidentHistoryRedisDto.getAccidentType(),
                        accidentHistoryRedisDto.getLat(),
                        accidentHistoryRedisDto.getLng(),
                        accidentHistoryRedisDto.getWeather()));

        objectRedisTemplate.opsForList().rightPush(redisKey, accidentHistoryRedisDto);
        objectRedisTemplate.expire(redisKey, Duration.ofDays(2));

        // GPS 정보 테스트 목적으로 저장 (실제 환경에서는 제거할 것)
        if (gpsMap == null || gpsMap.isEmpty()) {
            String gpsTestKey = "gps " + deviceId;
            redisTemplate.opsForHash().put(gpsTestKey, "lat", "37.5013");
            redisTemplate.opsForHash().put(gpsTestKey, "lng", "127.0396");
            redisTemplate.expire(gpsTestKey, Duration.ofHours(1));
            logger.info("Test GPS data set in Redis: key={}, lat=37.5013, lng=127.0396", gpsTestKey);
        }

        // 이미지(영상) 관련 로직: 사고 발생 시 영상 생성 및 DB 기록
        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideo(deviceId, accidentHistoryRedisDto.getConstructionSitesId());
        if (accidentVideo != null) {
            logger.info("AccidentVideo saved in DB: accidentVideoId={}, videoUrl={}",
                    accidentVideo.getAccidentVideoId(), accidentVideo.getVideoUrl());
        } else {
            logger.info("Accident event processed without AccidentVideo.");
        }

        // SSE를 통한 실시간 알림 전송을 위해 Redis DTO를 AccidentHistory 엔티티로 변환
        AccidentHistory accidentHistoryForSse = convertToAccidentHistory(accidentHistoryRedisDto);

        // DB에 사고기록 저장하지 않았으므로 임시 ID 생성 (필요시)
        // Redis에서는 ID가 없으므로, 임시 ID를 생성해 SSE 전송용으로 사용
        if (accidentHistoryForSse.getAccidentId() == null) {
            accidentHistoryForSse.setAccidentId(Math.abs(UUID.randomUUID().getLeastSignificantBits()));
            logger.info("Temporary accident ID generated for SSE: {}", accidentHistoryForSse.getAccidentId());
        }

        // SSE 알림 전송 (프론트엔드로 실시간 사고/알림 전달)
        accidentSseEmitterHandler.sendAccidentToClients(accidentHistoryForSse, accidentVideo);
        logger.info("SSE notification sent for accident");
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