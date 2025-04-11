package kr.kro.smartcap.smartcap_back.alarm.sse;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AlarmSseEmitterHandler {

    private static final Logger logger = LoggerFactory.getLogger(AlarmSseEmitterHandler.class);
    private static final Long SSE_TIMEOUT = 15 * 60 * 1000L; // 15분
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public AlarmSseEmitterHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SseEmitter createEmitter(String clientId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        emitter.onCompletion(() -> {
            logger.info("SSE connection completed for client: {}", clientId);
            emitters.remove(clientId);
        });

        emitter.onTimeout(() -> {
            logger.info("SSE connection timeout for client: {}", clientId);
            emitter.complete();
            emitters.remove(clientId);
        });

        emitter.onError((e) -> {
            logger.error("SSE connection error for client {}: {}", clientId, e.getMessage());
            emitter.complete();
            emitters.remove(clientId);
        });

        // 초기 연결 확인 이벤트 전송
        try {
            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data("Connected successfully"));
        } catch (IOException e) {
            logger.error("Error sending initial SSE event to client {}: {}", clientId, e.getMessage());
            emitter.complete();
            return emitter;
        }

        emitters.put(clientId, emitter);
        logger.info("SSE emitter created for client: {}", clientId);
        return emitter;
    }

    public void sendAlarmToClients(AlarmHistoryRedisDto alarm) {
        if (emitters.isEmpty()) {
            logger.info("No active SSE connections to notify for alarm");
            return;
        }

        try {
            String alarmJson = objectMapper.writeValueAsString(convertToResponse(alarm));
            logger.debug("Serialized alarm notification: {}", alarmJson);

            // 제거해야 할 클라이언트 ID 목록
            ConcurrentHashMap<String, SseEmitter> deadEmitters = new ConcurrentHashMap<>();
            int successCount = 0;

            // emitters를 직접 순회하여 개별적으로 처리
            for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
                String clientId = entry.getKey();
                SseEmitter emitter = entry.getValue();

                try {
                    // 테스트 메시지 먼저 전송하여 연결 상태 확인
                    emitter.send(SseEmitter.event()
                            .name("test")
                            .data("Test message before alarm data"));

                    // 실제 알람 메시지 전송
                    emitter.send(SseEmitter.event()
                            .name("alarm")
                            .data(alarmJson));

                    logger.debug("Sent alarm notification to client {}", clientId);
                    successCount++;
                } catch (IOException e) {
                    logger.error("Error sending alarm notification to client {}: {}", clientId, e.getMessage());
                    deadEmitters.put(clientId, emitter);
                    try {
                        emitter.complete();
                    } catch (Exception ex) {
                        logger.debug("Error completing emitter for client {}: {}", clientId, ex.getMessage());
                    }
                }
            }

            // 실패한 이미터 제거 (루프 종료 후 안전하게 제거)
            for (String clientId : deadEmitters.keySet()) {
                emitters.remove(clientId);
                logger.info("Removed dead emitter for client: {}", clientId);
            }

            logger.info("Alarm notification sent to {}/{} clients, removed {} dead connections",
                    successCount, emitters.size() + deadEmitters.size(), deadEmitters.size());
        } catch (Exception e) {
            logger.error("Error preparing alarm notification: {}", e.getMessage(), e);
        }
    }

    // 알람 엔티티를 프론트엔드에 적합한 응답 형식으로 변환
    private Map<String, Object> convertToResponse(AlarmHistoryRedisDto alarm) {
        Map<String, Object> response = new ConcurrentHashMap<>();
//        response.put("alarm_id", alarm.getAlarmId());
        response.put("construction_sites_id", alarm.getConstructionSitesId());

        // GPS 정보 변환
//        if (alarm.getLng() != 0 && ) {
            Map<String, Object> gpsInfo = new ConcurrentHashMap<>();
            gpsInfo.put("type", "Point");
            double[] coordinates = {alarm.getLat(), alarm.getLng()};
            gpsInfo.put("coordinates", coordinates);
            response.put("gps", gpsInfo);
//        }

        response.put("alarm_type", alarm.getAlarmType());
        response.put("recognized_type", alarm.getRecognizedType());
        response.put("created_at", alarm.getCreatedAt().toInstant().toString());
        response.put("weather", alarm.getWeather());

        // 하드코딩 필요한 추가 데이터 (예시)
        // TODO: 추후 실제 데이터로 대체
        response.put("site_name", "역삼역 공사장");
        response.put("construction_status", "진행중");

        return response;
    }

    // SSE 연결된 클라이언트 목록 반환
    public Map<String, SseEmitter> getEmitters() {
        return Collections.unmodifiableMap(emitters);
    }

    // 클라이언트 ID로 SSE 연결 종료
    public void removeEmitter(String clientId) {
        SseEmitter emitter = emitters.remove(clientId);
        if (emitter != null) {
            try {
                emitter.complete();
            } catch (Exception e) {
                logger.warn("Error completing emitter for client: {}", clientId);
            }
        }
    }
}