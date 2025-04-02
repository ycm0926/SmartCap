package kr.kro.smartcap.smartcap_back.alarm.sse;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AlarmSseEmitterHandler {

    private static final Logger logger = LoggerFactory.getLogger(AlarmSseEmitterHandler.class);
    private static final Long SSE_TIMEOUT = 60 * 60 * 1000L; // 1시간
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

    public void sendAlarmToClients(AlarmHistory alarm) {
        if (emitters.isEmpty()) {
            logger.info("No active SSE connections to notify for alarm ID: {}", alarm.getAlarmId());
            return;
        }

        try {
            String alarmJson = objectMapper.writeValueAsString(convertToResponse(alarm));

            emitters.forEach((clientId, emitter) -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("alarm")
                            .data(alarmJson));
                    logger.debug("Sent alarm notification to client {}", clientId);
                } catch (IOException e) {
                    logger.error("Error sending alarm notification to client {}: {}", clientId, e.getMessage());
                    emitter.complete();
                    emitters.remove(clientId);
                }
            });

            logger.info("Alarm notification sent to {} clients", emitters.size());
        } catch (Exception e) {
            logger.error("Error preparing alarm notification: {}", e.getMessage(), e);
        }
    }

    // 알람 엔티티를 프론트엔드에 적합한 응답 형식으로 변환
    private Map<String, Object> convertToResponse(AlarmHistory alarm) {
        Map<String, Object> response = new ConcurrentHashMap<>();
        response.put("alarm_id", alarm.getAlarmId());
        response.put("construction_sites_id", alarm.getConstructionSitesId());
        response.put("device_id", alarm.getDeviceId());

        // GPS 정보 변환
        if (alarm.getGps() != null) {
            Map<String, Object> gpsInfo = new ConcurrentHashMap<>();
            gpsInfo.put("type", "Point");
            double[] coordinates = {alarm.getGps().getX(), alarm.getGps().getY()};
            gpsInfo.put("coordinates", coordinates);
            response.put("gps", gpsInfo);
        }

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
}