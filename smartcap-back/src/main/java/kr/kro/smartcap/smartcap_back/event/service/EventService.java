package kr.kro.smartcap.smartcap_back.event.service;

import kr.kro.smartcap.smartcap_back.event.dto.stat.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {
    private final RedisTemplate<String, String> redisTemplate;

    public StatResponseDto getDashboardSummary() {
        List<StatGroupDto> hourlyStats = getStatGroups("alarm:", "hour");
        List<StatGroupDto> dailyStats = getStatGroups("summary:day:", "day");
        List<StatGroupDto> monthlyStats = getStatGroups("summary:month:", "month");

        return StatResponseDto.builder()
                .hourlyStats(hourlyStats)
                .dailyStats(dailyStats)
                .monthlyStats(monthlyStats)
                .build();
    }


    private List<StatGroupDto> getStatGroups(String keyPrefix, String scope) {
        Set<String> keys = redisTemplate.keys(keyPrefix + "*");
        if (keys == null) return Collections.emptyList();

        List<StatGroupDto> result = new ArrayList<>();
        HashOperations<String, String, String> hashOps = redisTemplate.opsForHash();

        for (String key : keys) {
            Map<String, String> statMap = hashOps.entries(key);
            List<StatEntryDto> stats = statMap.entrySet().stream()
                    .map(entry -> StatEntryDto.builder()
                            .field(entry.getKey())
                            .count(Long.parseLong(entry.getValue()))
                            .build())
                    .collect(Collectors.toList());
            result.add(StatGroupDto.builder()
                    .key(key.replace(keyPrefix, ""))
                    .scope(scope)
                    .stats(stats)
                    .build());
        }
        return result;
    }
}
