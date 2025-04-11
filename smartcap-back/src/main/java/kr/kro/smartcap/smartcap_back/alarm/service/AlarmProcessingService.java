package kr.kro.smartcap.smartcap_back.alarm.service;

import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryDto;
import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import kr.kro.smartcap.smartcap_back.alarm.sse.AlarmSseEmitterHandler;
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

@Service
@RequiredArgsConstructor
public class AlarmProcessingService {

    private final AlarmHistoryRepository alarmHistoryRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final RedisTemplate<String, Object> objectRedisTemplate;
    private final AlarmSseEmitterHandler alarmSseEmitterHandler;
    private final RedisStatService redisStatService;


    private static final Logger logger = LoggerFactory.getLogger(AlarmProcessingService.class);

    private static final String WEATHER_KEY = "current:weather";

    @Transactional
    public void processAlarm(int deviceId, AlarmHistoryDto dto) {
        AlarmHistoryRedisDto alarmHistoryRedisDto = new AlarmHistoryRedisDto();

        CategoryInfo info = AlarmCategoryMapper.map(dto.getAlarmType());

        alarmHistoryRedisDto.setAlarmType(info.getCode());
        alarmHistoryRedisDto.setRecognizedType(info.getCategory());

        LocalDateTime ldt = LocalDateTime.now();
        alarmHistoryRedisDto.setCreatedAt(Timestamp.valueOf(ldt));

        // 디폴트 현장 ID 설정
        alarmHistoryRedisDto.setConstructionSitesId(1L);

        // Redis에서 "gps {deviceId}" 형식의 키로 gps 정보 조회
        String redisKey = "gps " + deviceId;
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(redisKey);
        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                alarmHistoryRedisDto.setLat(lat);
                alarmHistoryRedisDto.setLng(lng);
            } catch (Exception e) {
                logger.warn("Failed to parse GPS data from Redis for device {}: {}", deviceId, e.getMessage());
            }
        } else {
            logger.info("No GPS data found in Redis for device {}. GPS not set.", deviceId);
        }

        // Redis에서 날씨 정보 조회
        setWeatherFromRedis(alarmHistoryRedisDto);

        // Redis에 저장
        Long siteId = alarmHistoryRedisDto.getConstructionSitesId();
        String key = String.format("alarm:%d:%s", siteId, LocalDate.now());
        objectRedisTemplate.opsForList().rightPush(key, alarmHistoryRedisDto);
        objectRedisTemplate.expire(key, Duration.ofDays(2));

        // 레디스 통계 업데이트
        redisStatService.incrementStats(
                alarmHistoryRedisDto.getCreatedAt().toLocalDateTime(),
                alarmHistoryRedisDto.getRecognizedType(),
                alarmHistoryRedisDto.getAlarmType()
        );

        // SSE 전송
        alarmSseEmitterHandler.sendAlarmToClients(alarmHistoryRedisDto);

    }

    private void setDefaultGps(AlarmHistory alarmHistory) {
        // 기본 GPS 정보 설정 메서드 추출
        GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
        Point defaultPoint = gf.createPoint(new Coordinate(126.9780, 37.5665));
        alarmHistory.setGps(defaultPoint);
    }

    private void setWeatherFromRedis(AlarmHistoryRedisDto alarmHistory) {
        String weather = redisTemplate.opsForValue().get(WEATHER_KEY);

        if (weather != null && !weather.isEmpty()) {
            alarmHistory.setWeather(weather);
        } else {
            alarmHistory.setWeather("맑음");
            logger.info("No weather data found in Redis. Default weather set: 맑음");
        }
    }
}