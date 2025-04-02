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
    private static final Logger logger = LoggerFactory.getLogger(AlarmController.class);

    @PostMapping("/notify")
    public ResponseEntity<?> notifyAlarm(@RequestBody AlarmHistoryDto dto) {
        try {
            logger.info("Received alarm notification for device ID: {}, type: {}",
                    dto.getDeviceId(), dto.getAlarmType());

            AlarmHistory alarm = alarmProcessingService.processAlarm(dto);

            return ResponseEntity.ok("Alarm processed successfully with ID: " + alarm.getAlarmId());
        } catch (Exception e) {
            logger.error("Failed to process alarm: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body("Failed to process alarm: " + e.getMessage());
        }
    }
}