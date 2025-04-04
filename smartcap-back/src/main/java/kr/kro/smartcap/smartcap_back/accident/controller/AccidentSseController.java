package kr.kro.smartcap.smartcap_back.accident.controller;

import kr.kro.smartcap.smartcap_back.accident.sse.AccidentSseEmitterHandler;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/accident")
@RequiredArgsConstructor
public class AccidentSseController {

    private final AccidentSseEmitterHandler sseEmitterHandler;
    private static final Logger logger = LoggerFactory.getLogger(AccidentSseController.class);

    @CrossOrigin(origins = "https://j12a102.p.ssafy.io")
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        String clientId = UUID.randomUUID().toString();
        logger.info("New client subscribing to accident events: {}", clientId);
        return sseEmitterHandler.createEmitter(clientId);
    }

    @GetMapping(value = "/subscribe/{clientId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeWithId(@PathVariable String clientId) {
        logger.info("Client with ID {} subscribing to accident events", clientId);
        return sseEmitterHandler.createEmitter(clientId);
    }
}