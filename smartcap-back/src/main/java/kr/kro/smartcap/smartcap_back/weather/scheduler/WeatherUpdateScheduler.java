package kr.kro.smartcap.smartcap_back.weather.scheduler;

import kr.kro.smartcap.smartcap_back.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherUpdateScheduler {

    private final WeatherService weatherService;

    /**
     * 캐싱된 모든 위치의 날씨 정보를 1시간마다 업데이트합니다.
     */
    @Scheduled(fixedDelayString = "${weather.update.interval}")
    public void updateWeatherData() {
        log.info("Scheduled weather update started");
        weatherService.updateAllCachedWeatherLocations();
        log.info("Scheduled weather update completed");
    }
}