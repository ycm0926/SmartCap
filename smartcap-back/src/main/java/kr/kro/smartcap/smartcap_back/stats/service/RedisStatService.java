package kr.kro.smartcap.smartcap_back.stats.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.kro.smartcap.smartcap_back.stats.dto.AlarmEventDto;
import kr.kro.smartcap.smartcap_back.stats.dto.StatUpdateDto;
import kr.kro.smartcap.smartcap_back.stats.sse.StatSseEmitterManager;
import kr.kro.smartcap.smartcap_back.stats.dto.AlarmTestRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisStatService {

    private final RedisTemplate<String, String> redisTemplate;
    private final StatSseEmitterManager statSseEmitterManager;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("HH");
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    public void incrementStats(LocalDateTime timestamp, String objectType, String alarmType) {
        String field = objectType + ":" + alarmType;

        String date = timestamp.format(DATE_FORMAT);
        String hour = timestamp.format(HOUR_FORMAT);
        String month = timestamp.format(MONTH_FORMAT);

        // 시간별 통계 (4일 TTL)
        String hourKey = "alarm:" + date + ":" + hour;
        incrementAndBroadcast(hourKey, field, 4, TimeUnit.DAYS, "hour");

        // 일별 통계 (4개월 TTL)
        String dayKey = "summary:day:" + date;
        incrementAndBroadcast(dayKey, field, 120, TimeUnit.DAYS, "day");

        // 월별 통계 (TTL 없음)
        String monthKey = "summary:month:" + month;
        incrementAndBroadcast(monthKey, field, null, null, "month");
    }

    public void storeAlarmAndBroadcast(AlarmTestRequestDto alarm) throws JsonProcessingException {
        String key = "alarms:" + alarm.getCreatedAt(); // alarms:2025-04-01
        redisTemplate.opsForList().rightPush(key, objectMapper.writeValueAsString(alarm));
        redisTemplate.expire(key, 7, TimeUnit.DAYS); // 일주일치만 유지

        statSseEmitterManager.broadcast("stat_update", AlarmEventDto.builder()
                .constructionSitesId(alarm.getConstructionSitesId())
                .gps(alarm.getGps())
                .alarmType(alarm.getAlarmType())
                .recognizedType(alarm.getRecognizedType())
                .weather(alarm.getWeather())
                .createdAt(alarm.getCreatedAt())
                .build());
    }

    private void incrementAndBroadcast(String key, String field, Integer ttl, TimeUnit timeUnit, String scope) {
        HashOperations<String, String, String> hashOps = redisTemplate.opsForHash();
        Long newValue = hashOps.increment(key, field, 1);

        if (ttl != null && Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
            redisTemplate.expire(key, ttl, timeUnit);
        }

        statSseEmitterManager.broadcast("stat_update", StatUpdateDto.builder()
                .scope(scope)
                .key(key)
                .field(field)
                .newValue(newValue != null ? newValue : 0L)
                .build());
    }
}
