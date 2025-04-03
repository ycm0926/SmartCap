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

    private static final String WEATHER_KEY = "current:weather";

    @Transactional
    public AlarmHistory processAlarm(AlarmHistoryDto dto) {
        AlarmHistory alarmHistory = new AlarmHistory();
        alarmHistory.setAlarmType(dto.getAlarmType());
        alarmHistory.setRecognizedType(dto.getRecognizedType());
        alarmHistory.setCreatedAt(Timestamp.from(Instant.now()));

        // 디폴트 현장 ID 설정
        alarmHistory.setConstructionSitesId(1L);

        // Redis에서 GPS 정보 조회
        setGpsFromRedis(alarmHistory);

        // Redis에서 날씨 정보 조회
        setWeatherFromRedis(alarmHistory);

        // DB에 저장
        AlarmHistory savedAlarm = alarmHistoryRepository.save(alarmHistory);
        logger.info("AlarmHistory saved: alarmId={}, constructionSitesId={}",
                savedAlarm.getAlarmId(), savedAlarm.getConstructionSitesId());

        // SSE 전송
        alarmSseEmitterHandler.sendAlarmToClients(savedAlarm);

        return savedAlarm;
    }

    private void setGpsFromRedis(AlarmHistory alarmHistory) {
        String redisKey = "gps";
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(redisKey);

        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                double lat = Double.parseDouble(gpsMap.get("lat").toString());
                double lng = Double.parseDouble(gpsMap.get("lng").toString());
                GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
                Point point = gf.createPoint(new Coordinate(lng, lat));
                alarmHistory.setGps(point);
            } catch (Exception e) {
                logger.warn("Failed to parse GPS data from Redis: {}", e.getMessage());
            }
        } else {
            GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
            Point defaultPoint = gf.createPoint(new Coordinate(126.9780, 37.5665));
            alarmHistory.setGps(defaultPoint);
            logger.info("No GPS data found in Redis. Default GPS set.");
        }
    }

    private void setWeatherFromRedis(AlarmHistory alarmHistory) {
        String weather = redisTemplate.opsForValue().get(WEATHER_KEY);

        if (weather != null && !weather.isEmpty()) {
            alarmHistory.setWeather(weather);
        } else {
            alarmHistory.setWeather("맑음");
            logger.info("No weather data found in Redis. Default weather set: 맑음");
        }
    }
}
