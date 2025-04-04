package kr.kro.smartcap.smartcap_back.stats.service;

import kr.kro.smartcap.smartcap_back.stats.dto.StatUpdateDto;
import kr.kro.smartcap.smartcap_back.stats.sse.StatSseEmitterManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisStatService {

    private final RedisTemplate<String, String> redisTemplate;
    private final StatSseEmitterManager statSseEmitterManager;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("HH");
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    public void incrementStats(LocalDateTime timestamp, String objectType, String alarmType) {
        String field = formatField(objectType, alarmType);

        applyStats(timestamp, field, 1, true);
    }

    public void setStats(LocalDateTime timestamp, String objectType, String alarmType, long count) {
        String field = formatField(objectType, alarmType);

        applyStats(timestamp, field, count, false);
    }

    private void applyStats(LocalDateTime timestamp, String field, long count, boolean isIncrement) {
        String date = timestamp.format(DATE_FORMAT);
        String hour = timestamp.format(HOUR_FORMAT);
        String month = timestamp.format(MONTH_FORMAT);

        processStat("summary:hour:" + date + ":" + hour, field, count, 4, TimeUnit.DAYS, "hour", isIncrement);
        processStat("summary:day:" + date, field, count, 120, TimeUnit.DAYS, "day", isIncrement);
        processStat("summary:month:" + month, field, count, null, null, "month", isIncrement);
    }

    private void processStat(String key, String field, long count, Integer ttl, TimeUnit unit, String scope, boolean isIncrement) {
        HashOperations<String, String, String> hashOps = redisTemplate.opsForHash();
        Long newValue;

        if (isIncrement) {
            newValue = hashOps.increment(key, field, count);
        } else {
            hashOps.put(key, field, String.valueOf(count));
            newValue = count;
        }

        if (ttl != null && Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
            redisTemplate.expire(key, ttl, unit);
        }

        statSseEmitterManager.broadcast("stat_update", StatUpdateDto.builder()
                .scope(scope)
                .key(key)
                .field(field)
                .newValue(newValue != null ? newValue : 0L)
                .build());
    }

    private String formatField(String objectType, String alarmType) {
        return objectType + ":" + alarmType;
    }

    public void clearAllStats() {
        Set<String> keys = redisTemplate.keys("summary:*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }
}
