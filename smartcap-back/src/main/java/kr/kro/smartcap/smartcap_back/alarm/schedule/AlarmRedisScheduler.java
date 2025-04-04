package kr.kro.smartcap.smartcap_back.alarm.schedule;

import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class AlarmRedisScheduler {

    private final RedisTemplate<String, Object> objectRedisTemplate;
    private final AlarmHistoryRepository alarmHistoryRepository;

    private static final Logger logger = LoggerFactory.getLogger(AlarmRedisScheduler.class);
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Scheduled(cron = "0 0 0 * * *") // 매일 자정 실행
    public void processAlarmDataFromRedis() {
        String yesterday = LocalDate.now().minusDays(1).format(formatter);
        String pattern = "alarm:*:" + yesterday;

        Set<String> keys = objectRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            logger.info("[알람] 어제 날짜 Redis 데이터 없음. pattern={}", pattern);
            return;
        }

        for (String key : keys) {
            Long size = objectRedisTemplate.opsForList().size(key);
            logger.info("[알람] Redis key: {}, 항목 수: {}", key, size);

            List<Object> list = objectRedisTemplate.opsForList().range(key, 0, -1);
            if (list != null) {
                for (Object obj : list) {
                    try {
                        AlarmHistoryRedisDto dto = (AlarmHistoryRedisDto) obj;

                        AlarmHistory entity = new AlarmHistory();
                        entity.setConstructionSitesId(dto.getConstructionSitesId());
                        entity.setAlarmType(dto.getAlarmType());
                        entity.setRecognizedType(dto.getRecognizedType());
                        entity.setWeather(dto.getWeather());
                        entity.setCreatedAt(dto.getCreatedAt());

                        Point point = geometryFactory.createPoint(new Coordinate(dto.getLng(), dto.getLat()));
                        entity.setGps(point);

                        alarmHistoryRepository.save(entity);
                        logger.info("[알람] 저장 성공: siteId={}, type={}, createdAt={}",
                                entity.getConstructionSitesId(), entity.getAlarmType(), entity.getCreatedAt());

                    } catch (ClassCastException e) {
                        logger.warn("[알람] 캐스팅 실패: {}", e.getMessage());
                    } catch (Exception e) {
                        logger.error("[알람] 저장 중 예외 발생: {}", e.getMessage(), e);
                    }
                }
            }
        }
    }
}
