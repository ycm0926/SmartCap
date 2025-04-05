package kr.kro.smartcap.smartcap_back.stats.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
public class StatSseEmitterManager {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.add(emitter);

        // 초기 연결 관련 로깅
        log.info("New SSE subscriber added. Current emitter count: {}", emitters.size());

        // 타임아웃 시 처리
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            log.warn("SSE emitter timed out. Removed from list. Current emitter count: {}", emitters.size());
        });

        // SSE 연결 완료(종료) 시 처리
        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            log.info("SSE emitter completed. Removed from list. Current emitter count: {}", emitters.size());
        });

        // SSE 연결 에러 시 처리
        emitter.onError(e -> {
            emitters.remove(emitter);
            log.error("SSE emitter error occurred: {}. Removed from list. Current emitter count: {}",
                    e.getMessage(), emitters.size());
        });

        // 초기 연결 시 “init” 이벤트 전송
        try {
            emitter.send(SseEmitter.event()
                    .name("init")
                    .data("connected"));
            log.info("Successfully sent 'init' event to new subscriber.");
        } catch (IOException e) {
            emitters.remove(emitter);
            log.warn("Failed to send initial SSE event: {}. Current emitter count: {}",
                    e.getMessage(), emitters.size());
        }

        return emitter;
    }

    public <T> void broadcast(String eventName, T data) {
        log.info("Broadcasting event '{}' to {} emitters with data: {}",
                eventName, emitters.size(), data);

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
                log.debug("Sent event '{}' to one emitter successfully.", eventName);
            } catch (IOException e) {
                emitters.remove(emitter);
                log.warn("SSE emitter removed due to error sending '{}': {}. Current emitter count: {}",
                        eventName, e.getMessage(), emitters.size());
            }
        }

        log.info("Broadcast of event '{}' completed.", eventName);
    }
}
