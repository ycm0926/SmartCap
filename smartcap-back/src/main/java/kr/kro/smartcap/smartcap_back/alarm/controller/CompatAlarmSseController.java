package kr.kro.smartcap.smartcap_back.alarm.controller;

import kr.kro.smartcap.smartcap_back.alarm.sse.AlarmSseEmitterHandler;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * 프론트엔드와의 호환성을 위한 추가 SSE 엔드포인트
 */
@RestController
@RequiredArgsConstructor
public class CompatAlarmSseController {

    private final AlarmSseEmitterHandler sseEmitterHandler;
    private static final Logger logger = LoggerFactory.getLogger(CompatAlarmSseController.class);

    /**
     * 프론트엔드 코드와 호환되는 SSE 구독 엔드포인트
     */
    @CrossOrigin(origins = "https://j12a102.p.ssafy.io")
    @GetMapping(value = "/alarms", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeCompat() {
        String clientId = UUID.randomUUID().toString();
        logger.info("Frontend client subscribing to alarm events with compatibility endpoint: {}", clientId);
        return sseEmitterHandler.createEmitter(clientId);
    }
}