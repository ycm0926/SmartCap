package kr.kro.smartcap.smartcap_back.weather.scheduler;

import kr.kro.smartcap.smartcap_back.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherUpdateScheduler {

    private final WeatherService weatherService;
    private final RedisTemplate<String, String> redisTemplate;

    // 현재 날씨 저장을 위한 Redis 키
    private static final String CURRENT_WEATHER_KEY = "current:weather";

    /**
     * 모든 디바이스의 GPS 정보를 기반으로 날씨 정보를 1시간마다 업데이트합니다.
     */
    @Scheduled(fixedDelayString = "${weather.update.interval}")
    public void updateWeatherData() {
        log.info("Scheduled weather update started");

        // 모든 디바이스의 GPS 키 패턴
        String gpsPattern = "gps *";
        Set<String> gpsKeys = redisTemplate.keys(gpsPattern);

        if (gpsKeys == null || gpsKeys.isEmpty()) {
            log.info("No device GPS information found in Redis");
            return;
        }

        // 기본 위치 (서울시청) - 디바이스가 없을 경우 사용
        double defaultLat = 37.5665;
        double defaultLng = 126.9780;

        // 모든 디바이스 중 첫 번째 디바이스의 위치 정보 사용 (간단한 구현을 위해)
        String firstGpsKey = gpsKeys.iterator().next();
        Map<Object, Object> gpsMap = redisTemplate.opsForHash().entries(firstGpsKey);

        double lat = defaultLat;
        double lng = defaultLng;

        if (gpsMap != null && !gpsMap.isEmpty()) {
            try {
                lat = Double.parseDouble(gpsMap.get("lat").toString());
                lng = Double.parseDouble(gpsMap.get("lng").toString());
                log.info("Using GPS from device key: {}, lat: {}, lng: {}", firstGpsKey, lat, lng);
            } catch (Exception e) {
                log.error("Failed to parse GPS data from Redis: {}", e.getMessage());
            }
        } else {
            log.info("No valid GPS data found, using default location (Seoul City Hall)");
        }

        // 날씨 정보 가져오기
        String weatherStatus = weatherService.getWeatherStatusByCoordinates(lat, lng);
        log.info("Current weather status: {}", weatherStatus);

        // 전체 시스템에서 사용할 현재 날씨 상태를 Redis에 저장
        redisTemplate.opsForValue().set(CURRENT_WEATHER_KEY, weatherStatus);
        log.info("Current weather status updated in Redis: {}", weatherStatus);

        log.info("Scheduled weather update completed");
    }
}