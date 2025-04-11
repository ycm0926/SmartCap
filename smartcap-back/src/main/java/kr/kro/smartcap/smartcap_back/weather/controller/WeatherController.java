package kr.kro.smartcap.smartcap_back.weather.controller;

import kr.kro.smartcap.smartcap_back.weather.dto.WeatherDTO;
import kr.kro.smartcap.smartcap_back.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    @GetMapping
    public ResponseEntity<String> getWeatherStatus(
            @RequestParam("lat") double lat,
            @RequestParam("lon") double lon
    ) {
        String weatherStatus = weatherService.getWeatherStatusByCoordinates(lat, lon);
        return ResponseEntity.ok(weatherStatus);
    }

    @GetMapping("/wkt")
    public ResponseEntity<String> getWeatherStatusByWkt(
            @RequestParam("point") String wktPoint
    ) {
        String weatherStatus = weatherService.getCurrentWeatherStatus(wktPoint);
        return ResponseEntity.ok(weatherStatus);
    }

    // 원래 API 호환성을 위해 WeatherDTO를 반환하는 메소드 유지 (필요한 경우)
    @GetMapping("/details")
    public ResponseEntity<WeatherDTO> getWeatherDetails(
            @RequestParam("lat") double lat,
            @RequestParam("lon") double lon
    ) {
        String weatherStatus = weatherService.getWeatherStatusByCoordinates(lat, lon);

        // 현재 API에서는 날씨 상태만 가져오므로 나머지 정보는 더미 데이터 사용
        WeatherDTO weatherDTO = WeatherDTO.builder()
                .location(String.format("%.2f,%.2f", lat, lon))
                .weatherMain(weatherStatus)
                .weatherDesc(weatherStatus)
                .temperature(0.0)
                .humidity(0.0)
                .windSpeed(0.0)
                .timestamp(LocalDateTime.now().toString())
                .build();

        return ResponseEntity.ok(weatherDTO);
    }
}