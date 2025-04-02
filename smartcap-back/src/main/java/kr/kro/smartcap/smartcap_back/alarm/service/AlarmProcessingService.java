package kr.kro.smartcap.smartcap_back.alarm.service;

import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryDto;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import kr.kro.smartcap.smartcap_back.alarm.sse.AlarmSseEmitterHandler;
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
public class AlarmProcessingService {

    private final AlarmHistoryRepository alarmHistoryRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final AlarmSseEmitterHandler alarmSseEmitterHandler;

    private static final Logger logger = LoggerFactory.getLogger(AlarmProcessingService.class);

    // 사이트 ID 조회용 키 접두사 (Redis)
    private static final String DEVICE_SITE_KEY_PREFIX = "device:";
    private static final String DEVICE_SITE_KEY_SUFFIX = ":site";
    // 날씨 정보 저장 키 (Redis)
    private static final String WEATHER_KEY = "current:weather";

    @Transactional
    public AlarmHistory processAlarm(AlarmHistoryDto dto) {
        AlarmHistory alarmHistory = new AlarmHistory();
        alarmHistory.setDeviceId(dto.getDeviceId());
        alarmHistory.setAlarmType(dto.getAlarmType());
        alarmHistory.setRecognizedType(dto.getRecognizedType());
        alarmHistory.setCreatedAt(Timestamp.from(Instant.now()));

        // 1. Redis에서 디바이스의 현장 ID 조회
        Long constructionSiteId = getConstructionSiteId(dto.getDeviceId());
        alarmHistory.setConstructionSitesId(constructionSiteId);

        // 2. Redis에서 GPS 정보 조회
        setGpsFromRedis(alarmHistory, dto.getDeviceId());

        // 3. Redis에서 날씨 정보 조회
        setWeatherFromRedis(alarmHistory);

        // 4. DB에 저장
        AlarmHistory savedAlarm = alarmHistoryRepository.save(alarmHistory);
        logger.info("AlarmHistory saved: alarmId={}, deviceId={}, constructionSitesId={}",
                savedAlarm.getAlarmId(), savedAlarm.getDeviceId(), savedAlarm.getConstructionSitesId());

        // 5. SSE로 실시간 알림 전송
        alarmSseEmitterHandler.sendAlarmToClients(savedAlarm);

        return savedAlarm;
    }

    private Long getConstructionSiteId(Integer deviceId) {
        // Redis에서 디바이스 ID로 현장 ID 조회
        String deviceSiteKey = DEVICE_SITE_KEY_PREFIX + deviceId + DEVICE_SITE_KEY_SUFFIX;
        String siteIdStr = redisTemplate.opsForValue().get(deviceSiteKey);

        // 기본 현장 ID (Redis에 없을 경우)
        Long defaultSiteId = 1L;

        if (siteIdStr != null) {
            try {
                return Long.parseLong(siteIdStr);
            } catch (NumberFormatException e) {
                logger.warn("Invalid construction site ID format in Redis for device {}: {}", deviceId, siteIdStr);
            }
        } else {
            logger.info("No construction site ID found in Redis for device {}. Using default: {}", deviceId, defaultSiteId);
        }

        return defaultSiteId;
    }

    private void setGpsFromRedis(AlarmHistory alarmHistory, Integer deviceId) {
        // Redis에서 GPS 정보 조회
        String redisKey = "gps " + deviceId;
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(redisKey);

        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
                // JTS에서는 좌표 순서가 (x, y) 즉, (lng, lat)
                Point point = gf.createPoint(new Coordinate(lng, lat));
                alarmHistory.setGps(point);
            } catch (Exception e) {
                logger.warn("Failed to parse GPS data from Redis for device {}: {}", deviceId, e.getMessage());
            }
        } else {
            // 기본 GPS 좌표 설정 (서울 시청)
            GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
            Point defaultPoint = gf.createPoint(new Coordinate(126.9780, 37.5665));
            alarmHistory.setGps(defaultPoint);
            logger.info("No GPS data found in Redis for device {}. Default GPS set.", deviceId);
        }
    }

    private void setWeatherFromRedis(AlarmHistory alarmHistory) {
        // Redis에서 날씨 정보 조회
        String weather = redisTemplate.opsForValue().get(WEATHER_KEY);

        if (weather != null && !weather.isEmpty()) {
            alarmHistory.setWeather(weather);
        } else {
            // 기본 날씨 설정
            alarmHistory.setWeather("맑음");
            logger.info("No weather data found in Redis. Default weather set: 맑음");
        }
    }
}