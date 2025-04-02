package kr.kro.smartcap.smartcap_back.accident.controller;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.service.AccidentVideoService;
import kr.kro.smartcap.smartcap_back.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.io.WKTReader;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;

@RestController
@RequestMapping("/api/accident")
@RequiredArgsConstructor
public class AccidentVideoController {

    private final AccidentHistoryRepository accidentHistoryRepository;
    private final AccidentVideoService accidentVideoService;
    private final WeatherService weatherService;  // 날씨 서비스 추가

    @PostMapping("/{deviceId}/notify")
    public ResponseEntity<?> notifyAccident(
            @PathVariable int deviceId,
            @RequestBody AccidentHistoryDto dto
    ) {
        try {
            AccidentHistory accidentHistory = new AccidentHistory();
            accidentHistory.setConstructionSitesId(dto.getConstructionSitesId());

            // GPS 문자열을 JTS Point 객체로 변환 (SRID 4326 지정)
            GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
            WKTReader reader = new WKTReader(geometryFactory);
            Point jtsPoint = (Point) reader.read(dto.getGps());
            jtsPoint.setSRID(4326);
            accidentHistory.setGps(jtsPoint);

            // 현재 위치의 실시간 날씨 정보 가져오기
            String currentWeather = weatherService.getCurrentWeatherStatus(dto.getGps());
            accidentHistory.setWeather(currentWeather);

            accidentHistory.setAccidentType(dto.getAccidentType());
            accidentHistory.setCreatedAt(Timestamp.from(Instant.now()));

            accidentHistory = accidentHistoryRepository.save(accidentHistory);

            AccidentVideo savedVideo = accidentVideoService.createAccidentVideo(deviceId, accidentHistory.getAccidentId());

            return ResponseEntity.ok(savedVideo);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to process accident: " + e.getMessage());
        }
    }
}