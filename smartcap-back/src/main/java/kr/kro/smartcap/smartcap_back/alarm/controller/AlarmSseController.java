package kr.kro.smartcap.smartcap_back.alarm.controller;

import kr.kro.smartcap.smartcap_back.alarm.sse.AlarmSseEmitterHandler;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/sse/alarms")
@RequiredArgsConstructor
public class AlarmSseController {

    private final AlarmSseEmitterHandler sseEmitterHandler;
    private static final Logger logger = LoggerFactory.getLogger(AlarmSseController.class);

    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        String clientId = UUID.randomUUID().toString();
        logger.info("New client subscribing to alarm events: {}", clientId);
        return sseEmitterHandler.createEmitter(clientId);
    }

    @GetMapping(value = "/subscribe/{clientId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeWithId(@PathVariable String clientId) {
        logger.info("Client with ID {} subscribing to alarm events", clientId);
        return sseEmitterHandler.createEmitter(clientId);
    }
}