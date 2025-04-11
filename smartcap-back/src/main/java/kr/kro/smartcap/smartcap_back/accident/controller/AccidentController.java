package kr.kro.smartcap.smartcap_back.accident.controller;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.service.AccidentProcessingService;
import kr.kro.smartcap.smartcap_back.common.util.AlarmCategoryMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accident")
@RequiredArgsConstructor
@Slf4j
public class AccidentController {

    private final AccidentProcessingService accidentProcessingService;

    @PostMapping("/{deviceId}/notify")
    public ResponseEntity<?> notifyAccident(
            @PathVariable int deviceId,
            @RequestBody AccidentHistoryDto dto
    ) {
        log.info("Received accident data: {}", dto);
        try {
            String alarmType = AlarmCategoryMapper.map(dto.getAccidentType()).getCode();
            if(!alarmType.equals("3")){
                return ResponseEntity
                        .badRequest()
                        .body("Invalid data received");
            }
            accidentProcessingService.processAccident(deviceId, dto);
            log.info("Accident data saved successfully for deviceId: {}", deviceId);
            return ResponseEntity.ok("Accident data saved successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to process accident: " + e.getMessage());
        }
    }
}
