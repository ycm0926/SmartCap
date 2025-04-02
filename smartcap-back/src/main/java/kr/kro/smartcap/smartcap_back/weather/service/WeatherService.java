package kr.kro.smartcap.smartcap_back.weather.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestTemplate restTemplate;
    private final StringRedisTemplate stringRedisTemplate; // StringRedisTemplate 사용

    @Value("${weather.api.key}")
    private String apiKey;

    @Value("${weather.api.url}")
    private String apiUrl;

    @Value("${weather.redis.ttl}")
    private long redisTtl;

    /**
     * 좌표(위도, 경도)로 날씨 상태를 가져옵니다.
     * @param lat 위도
     * @param lon 경도
     * @return 날씨 상태 (예: 맑음, 비, 구름 등)
     */
    public String getWeatherStatusByCoordinates(double lat, double lon) {
        // 레디스 키 생성 (위도 경도를 소수점 두자리까지만 사용해 넓은 범위로 캐싱)
        String locationKey = String.format("weather:status:%.2f:%.2f", lat, lon);

        // 레디스에서 캐싱된 날씨 상태 확인
        String cachedWeatherStatus = stringRedisTemplate.opsForValue().get(locationKey);
        if (cachedWeatherStatus != null) {
            log.info("Cache hit for weather status at location {}", locationKey);
            return cachedWeatherStatus;
        }

        // 날씨 API 호출
        String url = String.format("%s?lat=%f&lon=%f&appid=%s&units=metric", apiUrl, lat, lon, apiKey);
        Map<String, Object> response = restTemplate.getForObject(url, HashMap.class);

        if (response == null) {
            log.error("Failed to get weather data from API");
            return "맑음"; // 기본값 반환
        }

        // 날씨 상태만 추출
        String weatherStatus = extractWeatherStatus(response);

        // 레디스에 날씨 상태만 캐싱
        stringRedisTemplate.opsForValue().set(locationKey, weatherStatus, redisTtl, TimeUnit.SECONDS);
        log.info("Weather status cached for location {} with TTL {} seconds", locationKey, redisTtl);

        return weatherStatus;
    }

    /**
     * JTS Point의 WKT 문자열에서 날씨 상태를 가져옵니다.
     * @param wktPoint WKT 포인트 문자열 (예: "POINT(127.123 37.456)")
     * @return 날씨 상태 (예: 맑음, 비, 구름 등)
     */
    public String getCurrentWeatherStatus(String wktPoint) {
        // WKT 문자열 파싱 (POINT(경도 위도) 형식)
        String coordinatesPart = wktPoint.replace("POINT(", "").replace(")", "");
        String[] coordinates = coordinatesPart.split(" ");

        if (coordinates.length != 2) {
            log.error("Invalid WKT Point format: {}", wktPoint);
            return "맑음"; // 기본값 반환
        }

        double lon = Double.parseDouble(coordinates[0]);
        double lat = Double.parseDouble(coordinates[1]);

        return getWeatherStatusByCoordinates(lat, lon);
    }

    /**
     * 현재 저장된 위치에 대한 날씨 상태를 강제로 업데이트합니다.
     */
    public void updateAllCachedWeatherLocations() {
        log.info("Updating all cached weather locations");
        // 모든 weather:status: 패턴의 키 조회
        var keys = stringRedisTemplate.keys("weather:status:*");
        if (keys == null || keys.isEmpty()) {
            log.info("No cached weather locations to update");
            return;
        }

        keys.forEach(key -> {
            String[] parts = key.split(":");
            if (parts.length >= 4) {
                try {
                    double lat = Double.parseDouble(parts[2]);
                    double lon = Double.parseDouble(parts[3]);
                    getWeatherStatusByCoordinates(lat, lon); // 강제 업데이트
                    log.info("Updated weather status for location {}", key);
                } catch (NumberFormatException e) {
                    log.error("Failed to parse coordinates from key: {}", key, e);
                }
            }
        });
    }

    /**
     * 날씨 API 응답에서 한글 날씨 상태를 추출합니다.
     */
    private String extractWeatherStatus(Map<String, Object> response) {
        try {
            String weatherMain = null;
            if (response.containsKey("weather")) {
                var weatherArray = (java.util.List<Map<String, Object>>) response.get("weather");
                if (!weatherArray.isEmpty()) {
                    Map<String, Object> weather = weatherArray.get(0);
                    weatherMain = (String) weather.get("main");
                }
            }

            return convertToKoreanWeather(weatherMain);
        } catch (Exception e) {
            log.error("Error extracting weather status", e);
            return "맑음"; // 기본값 반환
        }
    }

    /**
     * 영문 날씨 상태를 한글로 변환합니다.
     */
    private String convertToKoreanWeather(String weatherMain) {
        if (weatherMain == null) return "맑음";

        return switch (weatherMain.toLowerCase()) {
            case "clear" -> "맑음";
            case "clouds" -> "구름";
            case "rain", "drizzle" -> "비";
            case "thunderstorm" -> "천둥번개";
            case "snow" -> "눈";
            case "mist", "fog", "haze" -> "안개";
            case "dust", "sand" -> "황사";
            default -> "맑음";
        };
    }
}