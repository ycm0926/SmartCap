package kr.kro.smartcap.smartcap_back.alarm.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@EnableScheduling
@Slf4j
public class AlarmSseConnectionHealthMonitor {

    private final AlarmSseEmitterHandler alarmSseEmitterHandler;

    public AlarmSseConnectionHealthMonitor(AlarmSseEmitterHandler alarmSseEmitterHandler) {
        this.alarmSseEmitterHandler = alarmSseEmitterHandler;
    }

    /**
     * 5분마다 실행되어 모든 연결에 하트비트 전송
     */
    @Scheduled(fixedRate = 300000)
    public void sendHeartbeats() {
        Map<String, SseEmitter> activeEmitters = alarmSseEmitterHandler.getEmitters();
        if (activeEmitters.isEmpty()) {
            return;
        }

        ConcurrentHashMap<String, SseEmitter> deadEmitters = new ConcurrentHashMap<>();
        int successCount = 0;

        // 모든 연결에 하트비트 메시지 전송하여 상태 확인
        for (Map.Entry<String, SseEmitter> entry : activeEmitters.entrySet()) {
            String clientId = entry.getKey();
            SseEmitter emitter = entry.getValue();

            try {
                emitter.send(SseEmitter.event()
                        .name("heartbeat")
                        .data("ping_" + System.currentTimeMillis()));
                successCount++;
            } catch (IOException e) {
                log.warn("Failed to send heartbeat to client {}: {}", clientId, e.getMessage());
                deadEmitters.put(clientId, emitter);
                try {
                    // SSE 연결 자체를 종료 (서버의 데이터 구조에서는 제거하지 않음)
                    emitter.complete();
                } catch (Exception ex) {
                    log.debug("Error completing emitter for client {}: {}", clientId, ex.getMessage());
                }
            }
        }

        // 실패한 이미터 제거(서버의 이미터 컬렉션 구조에서 제거)
        for (String clientId : deadEmitters.keySet()) {
            alarmSseEmitterHandler.removeEmitter(clientId);
            log.info("Removed dead emitter during heartbeat for client: {}", clientId);
        }

        log.debug("Heartbeat sent to {}/{} clients, removed {} dead connections",
                successCount, activeEmitters.size(), deadEmitters.size());
    }
}
