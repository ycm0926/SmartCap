package kr.kro.smartcap.smartcap_back.weather.scheduler;

import kr.kro.smartcap.smartcap_back.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherUpdateScheduler {

    private final WeatherService weatherService;
    private final RedisTemplate<String, String> redisTemplate;

    // Redis에 저장될 날씨 상태 키
    private static final String CURRENT_WEATHER_KEY = "current:weather";

    // ✅ 역삼 멀티캠퍼스 GPS 좌표
    private static final double FIXED_LAT = 37.501263;
    private static final double FIXED_LNG = 127.039615;

    /**
     * 매 시간마다 고정된 위치(역삼 멀티캠퍼스)의 날씨를 조회하여 Redis에 저장합니다.
     */
    @Scheduled(fixedDelayString = "${weather.update.interval}")
    public void updateWeatherData() {
        log.info("🔄 Scheduled weather update started");

        try {
            // 날씨 정보 조회
            String weatherStatus = weatherService.getWeatherStatusByCoordinates(FIXED_LAT, FIXED_LNG);
            log.info("📍 Fetched weather for 역삼 멀티캠퍼스 (lat={}, lng={}): {}", FIXED_LAT, FIXED_LNG, weatherStatus);

            // Redis에 저장
            redisTemplate.opsForValue().set(CURRENT_WEATHER_KEY, weatherStatus);
            log.info("✅ Updated Redis key '{}': {}", CURRENT_WEATHER_KEY, weatherStatus);
        } catch (Exception e) {
            log.error("❌ Failed to update weather data: {}", e.getMessage(), e);
        }

        log.info("✅ Scheduled weather update completed");
    }
}
