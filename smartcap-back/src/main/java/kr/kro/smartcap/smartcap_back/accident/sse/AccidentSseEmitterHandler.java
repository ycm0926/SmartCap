package kr.kro.smartcap.smartcap_back.accident.sse;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AccidentSseEmitterHandler {

    private static final Logger logger = LoggerFactory.getLogger(AccidentSseEmitterHandler.class);
    private static final Long SSE_TIMEOUT = 60 * 60 * 1000L; // 1시간
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public AccidentSseEmitterHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SseEmitter createEmitter(String clientId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        emitter.onCompletion(() -> {
            logger.info("Accident SSE connection completed for client: {}", clientId);
            emitters.remove(clientId);
        });

        emitter.onTimeout(() -> {
            logger.info("Accident SSE connection timeout for client: {}", clientId);
            emitter.complete();
            emitters.remove(clientId);
        });

        emitter.onError((e) -> {
            logger.error("Accident SSE connection error for client {}: {}", clientId, e.getMessage());
            emitter.complete();
            emitters.remove(clientId);
        });

        // 초기 연결 확인 이벤트 전송
        try {
            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data("Connected to accident notification stream"));
            logger.info("Initial connect event sent to client: {}", clientId);
        } catch (IOException e) {
            logger.error("Error sending initial accident SSE event to client {}: {}", clientId, e.getMessage());
            emitter.complete();
            return emitter;
        }

        emitters.put(clientId, emitter);
        logger.info("Accident SSE emitter created for client: {}. Total connections: {}", clientId, emitters.size());
        return emitter;
    }

    public void sendAccidentToClients(AccidentHistory accident, AccidentVideo video) {
        if (emitters.isEmpty()) {
            logger.info("No active SSE connections to notify for accident");
            return;
        }

        try {
            Map<String, Object> response = convertToResponse(accident, video);
            logger.debug("Preparing accident notification with data: {}", response);

            String accidentJson = objectMapper.writeValueAsString(response);
            logger.debug("Serialized accident notification: {}", accidentJson);

            int successCount = 0;
            for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
                String clientId = entry.getKey();
                SseEmitter emitter = entry.getValue();

                try {
                    // 테스트 메시지 먼저 전송
                    emitter.send(SseEmitter.event()
                            .name("test")
                            .data("Test message before accident data"));

                    // 실제 사고 알림 전송 (더 단순한 형식의 문자열로 전송)
                    emitter.send(SseEmitter.event()
                            .name("accident")
                            .data(accidentJson, MediaType.APPLICATION_JSON));

                    logger.info("Sent accident notification to client {}", clientId);
                    successCount++;
                } catch (IOException e) {
                    logger.error("Error sending accident notification to client {}: {}", clientId, e.getMessage());
                    emitter.complete();
                    emitters.remove(clientId);
                }
            }

            logger.info("Accident notification sent to {}/{} clients", successCount, emitters.size());
        } catch (Exception e) {
            logger.error("Error preparing accident notification: {}", e.getMessage(), e);
        }
    }

    // 사고 엔티티를 프론트엔드에 적합한 응답 형식으로 변환
    private Map<String, Object> convertToResponse(AccidentHistory accident, AccidentVideo video) {
        Map<String, Object> response = new ConcurrentHashMap<>();

        // 기본 사고 정보
        response.put("accident_id", accident.getAccidentId());
        response.put("construction_sites_id", accident.getConstructionSitesId());

        // 임의의 디바이스 ID 설정 (실제 구현에서는 적절히 조정)
        response.put("device_id", 23); // 테스트에 사용된 디바이스 ID

        // GPS 정보 변환
        if (accident.getGps() != null) {
            Map<String, Object> gpsInfo = new ConcurrentHashMap<>();
            gpsInfo.put("type", "Point");
            double[] coordinates = {accident.getGps().getX(), accident.getGps().getY()};
            gpsInfo.put("coordinates", coordinates);
            response.put("gps", gpsInfo);

            // 프론트엔드 편의를 위해 직접적인 좌표도 포함
            response.put("lat", accident.getGps().getY());
            response.put("lng", accident.getGps().getX());
        } else {
            // GPS가 없을 경우 기본 좌표
            response.put("lat", 37.5013);
            response.put("lng", 127.0396);

            Map<String, Object> gpsInfo = new ConcurrentHashMap<>();
            gpsInfo.put("type", "Point");
            double[] coordinates = {127.0396, 37.5013};
            gpsInfo.put("coordinates", coordinates);
            response.put("gps", gpsInfo);
        }

        // 사고 유형을 알람 유형으로 변환 (프론트엔드 형식에 맞게)
        response.put("alarm_type", "Accident"); // 사고는 항상 "Accident" 타입

        // 알람 유형 체크 및 설정 (null 체크 강화)
        String accidentType = accident.getAccidentType();
        if (accidentType == null || accidentType.isEmpty()) {
            accidentType = "낙상사고"; // 기본값
            logger.warn("Empty accident type found. Using default type: {}", accidentType);
        }
        response.put("recognized_type", accidentType);

        // 프론트엔드 호환성을 위해 보통 사용하는 필드명도 추가
        response.put("type", accidentType);
        response.put("alarm_category", accidentType);
        response.put("created_at", accident.getCreatedAt().toInstant().toString());
        response.put("weather", accident.getWeather() != null ? accident.getWeather() : "맑음");

        // 비디오 정보 추가
        if (video != null) {
            response.put("accident_video_id", video.getAccidentVideoId());
            response.put("video_url", video.getVideoUrl());
        } else {
            // 비디오 없을 경우 더미 URL 제공
            response.put("video_url", "https://example.com/no-video-available.mp4");
        }

        // 하드코딩된 추가 데이터
        response.put("site_name", "역삼역 공사장");
        response.put("construction_status", "진행중");

        return response;
    }
}