package kr.kro.smartcap.smartcap_back.alarm.controller;

import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryDto;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.service.AlarmProcessingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/alarm")
@RequiredArgsConstructor
public class AlarmController {

    private final AlarmProcessingService alarmProcessingService;

    @PostMapping("/{deviceId}/notify")
    public ResponseEntity<?> notifyAlarm(
            @PathVariable int deviceId,
            @RequestBody AlarmHistoryDto dto
    ) {
        try {
            alarmProcessingService.processAlarm(deviceId, dto);

            return ResponseEntity.ok("Accident data saved successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to process alarm: " + e.getMessage());
        }
    }
}