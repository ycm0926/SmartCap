package kr.kro.smartcap.smartcap_back.accident.schedule;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
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
public class AccidentRedisScheduler {

    private final RedisTemplate<String, Object> objectRedisTemplate;
    private final AccidentHistoryRepository accidentHistoryRepository;

    private static final Logger logger = LoggerFactory.getLogger(AccidentRedisScheduler.class);
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Scheduled(cron = "0 0 0 * * *") // 매일 자정
    public void processAccidentDataFromRedis() {
        String yesterday = LocalDate.now().minusDays(1).format(formatter);
        String pattern = "accident:*:" + yesterday;

        Set<String> keys = objectRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            logger.info("[사고] 어제 날짜 Redis 데이터 없음. pattern={}", pattern);
            return;
        }

        for (String key : keys) {
            Long size = objectRedisTemplate.opsForList().size(key);
            logger.info("[사고] Redis key: {}, 항목 수: {}", key, size);

            List<Object> list = objectRedisTemplate.opsForList().range(key, 0, -1);
            if (list != null) {
                for (Object obj : list) {
                    try {
                        AccidentHistoryRedisDto dto = (AccidentHistoryRedisDto) obj;

                        AccidentHistory entity = new AccidentHistory();
                        entity.setConstructionSitesId(dto.getConstructionSitesId());
                        entity.setAccidentType(dto.getAccidentType());
                        entity.setWeather(dto.getWeather());
                        entity.setCreatedAt(dto.getCreatedAt());

                        // GPS 세팅 (lat/lng → Point)
                        Point point = geometryFactory.createPoint(new Coordinate(dto.getLng(), dto.getLat()));
                        entity.setGps(point);

                        accidentHistoryRepository.save(entity);

                    } catch (ClassCastException e) {
                        logger.warn("[사고] 캐스팅 실패: {}", e.getMessage());
                    } catch (Exception e) {
                        logger.error("[사고] 저장 중 예외 발생: {}", e.getMessage(), e);
                    }
                }
            }
        }
    }
}
