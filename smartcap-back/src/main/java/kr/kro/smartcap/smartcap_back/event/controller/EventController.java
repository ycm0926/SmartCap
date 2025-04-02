package kr.kro.smartcap.smartcap_back.event.controller;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.event.dto.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final RedisTemplate<String, Object> redisTemplate;

    // SSE 클라이언트 관리
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @Autowired
    public EventController(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Autowired
    private AccidentHistoryRepository accidentHistoryRepository;


    /**
     * 대시보드용 데이터를 제공하는 엔드포인트
     */
    @GetMapping("/dashboard")
    public EventSummaryResponse getDashboardData() {
        // Redis에서 알람 데이터 리스트 가져오기
        List<Map<String, Object>> alarmsList = (List<Map<String, Object>>) redisTemplate.opsForValue().get("alarms_stats");

        if (alarmsList == null) {
            alarmsList = new ArrayList<>();
        }

        // 최근 알람 5개 추출 (시간순 정렬 후)
        List<AlarmDTO> recentAlarms = convertToAlarmDTOs(alarmsList).stream()
                .sorted((a1, a2) -> a2.getCreated_at().compareTo(a1.getCreated_at()))
                .limit(5)
                .collect(Collectors.toList());

        // 인식 타입별 통계 집계
        Map<String, Integer> monthlyDangerRanking = calculateRecognizedTypeStats(alarmsList);

        // 시간별 통계 계산
        Map<String, Integer> dailyAlarmCounts = calculateDailyStats(alarmsList);
        Map<String, Integer> weeklyAlarmCounts = calculateWeeklyStats(alarmsList);
        Map<String, Integer> monthlyAlarmCounts = calculateMonthlyStats(alarmsList);

        // 알람 타입별 통계
        Map<String, Integer> alarmTypeCounts = calculateAlarmTypeStats(alarmsList);

        // 알람 타입 및 인식 타입별 교차 통계
        Map<String, Map<String, Integer>> accidentTypeTrend = calculateCrossStats(alarmsList);

        return EventSummaryResponse.builder()
                .recentAlarms(recentAlarms)
                .monthlyDangerRanking(monthlyDangerRanking)
                .dailyAlarmCounts(dailyAlarmCounts)
                .weeklyAlarmCounts(weeklyAlarmCounts)
                .monthlyAlarmCounts(monthlyAlarmCounts)
                .alarmTypeCounts(alarmTypeCounts)
                .accidentTypeTrend(accidentTypeTrend)
                .build();
    }

    /**
     * 지도 화면용 데이터를 제공하는 엔드포인트
     */
    @GetMapping("/map")
    public MapDataResponse getMapData() {
        // 1. Redis 알람 데이터 가져오기
        List<Map<String, Object>> alarmsList = (List<Map<String, Object>>) redisTemplate.opsForValue().get("alarms_stats");
        if (alarmsList == null) {
            alarmsList = new ArrayList<>();
        }

        // 2. DB에서 사고 데이터 가져오기 (최근 7일 또는 전체 등 기준 정할 수 있음)
        List<AccidentHistory> accidentEntities = accidentHistoryRepository.findAll(); // 또는 findRecentAlarms() 등으로 조건부

        // 3. Redis 알람 → AlarmDTO
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        List<AlarmDTO> recentAlarms = convertToAlarmDTOs(alarmsList).stream()
                .filter(alarm -> alarm.getCreated_at().isAfter(sevenDaysAgo))
                .collect(Collectors.toList());

        // 4. DB 사고 → AccidentDTO
        List<AccidentDTO> accidentDTOs = accidentEntities.stream().map(entity -> {
            AccidentDTO dto = new AccidentDTO();
            dto.setAccident_id(entity.getAccidentId());
            dto.setConstruction_sites_id(entity.getConstructionSitesId());
            dto.setAlarm_type(entity.getAccidentType());
            dto.setWeather(entity.getWeather());
            dto.setCreated_at(entity.getCreatedAt().toLocalDateTime());

            // GPS
            if (entity.getGps() != null) {
                GpsDTO gps = new GpsDTO();
                gps.setType("Point");
                gps.setCoordinates(new double[]{entity.getGps().getX(), entity.getGps().getY()});
                dto.setGps(gps);
            }

            // 필요 시, 영상 ID, URL은 추후 join 해서 추가 가능
            return dto;
        }).collect(Collectors.toList());

        // 5. 응답 반환
        return MapDataResponse.builder()
                .recentAlarms(recentAlarms)
                .fallingAccidents(accidentDTOs)
                .build();
    }


    /**
     * SSE 연결을 설정하는 엔드포인트
     */
    @GetMapping(value = "/alarms", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlarms() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        emitters.add(emitter);

        // 연결 종료 시 emitter 제거
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data("Connected to SSE stream"));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * 새 알람 브로드캐스트
     */
    public void broadcastAlarm(AlarmDTO alarm) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("message")
                        .data(alarm));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        });

        emitters.removeAll(deadEmitters);
    }

    // 유틸리티 메소드: Map 리스트를 AlarmDTO 리스트로 변환
    private List<AlarmDTO> convertToAlarmDTOs(List<Map<String, Object>> alarmsList) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

        return alarmsList.stream().map(map -> {
            AlarmDTO dto = new AlarmDTO();

            // ID 및 기타 필드 설정 (필요에 따라 수정)
            dto.setAlarm_id(alarmsList.indexOf(map) + 1L);  // 임시 ID
            dto.setConstruction_sites_id(Long.valueOf(map.get("constructionSitesId").toString()));

            // GPS 처리 (POINT(127.0 37.5) 형식 파싱)
            String gpsStr = (String) map.get("gps");
            if (gpsStr != null && gpsStr.startsWith("POINT")) {
                String[] coords = gpsStr.substring(6, gpsStr.length() - 1).split(" ");
                double lng = Double.parseDouble(coords[0]);
                double lat = Double.parseDouble(coords[1]);

                // GpsDTO 생성 및 설정
                GpsDTO gpsDto = new GpsDTO();
                gpsDto.setType("Point");
                gpsDto.setCoordinates(new double[] {lng, lat});
                dto.setGps(gpsDto);
            }

            dto.setAlarm_type((String) map.get("alarmType"));
            dto.setRecognized_type((String) map.get("recognizedType"));
            dto.setWeather((String) map.get("weather"));

            // 날짜 처리
            String dateStr = (String) map.get("createdAt");
            if (dateStr != null) {
                dto.setCreated_at(LocalDateTime.parse(dateStr, formatter));
            }

            return dto;
        }).collect(Collectors.toList());
    }

    // 사고 데이터 변환 메소드
    private List<AccidentDTO> convertToAccidentDTOs(List<Map<String, Object>> accidentsList) {
        // 기본 알람 데이터 변환
        List<AlarmDTO> alarmDTOs = convertToAlarmDTOs(accidentsList);

        // AccidentDTO로 변환
        return alarmDTOs.stream().map(alarm -> {
            AccidentDTO accident = new AccidentDTO();
            // 알람 데이터 복사
            accident.setAlarm_id(alarm.getAlarm_id());
            accident.setConstruction_sites_id(alarm.getConstruction_sites_id());
            accident.setWeather_id(alarm.getWeather_id());
            accident.setDevice_id(alarm.getDevice_id());
            accident.setGps(alarm.getGps());
            accident.setAlarm_type(alarm.getAlarm_type());
            accident.setRecognized_type(alarm.getRecognized_type());
            accident.setCreated_at(alarm.getCreated_at());
            accident.setWeather(alarm.getWeather());
            accident.setSite_name(alarm.getSite_name());
            accident.setConstruction_status(alarm.getConstruction_status());

            // 사고 관련 필드 설정
            accident.setAccident_id(alarm.getAlarm_id());  // 임시로 동일하게 설정
            accident.setAccident_video_id(alarm.getAlarm_id() + 100);  // 임시 ID
            accident.setVideo_url("/sample-fall-video.mp4");  // 샘플 비디오 URL

            return accident;
        }).collect(Collectors.toList());
    }

    // 이하 통계 계산 메소드들 (예시)
    private Map<String, Integer> calculateRecognizedTypeStats(List<Map<String, Object>> alarmsList) {
        Map<String, Integer> stats = new HashMap<>();

        for (Map<String, Object> alarm : alarmsList) {
            String type = (String) alarm.get("recognizedType");
            stats.put(type, stats.getOrDefault(type, 0) + 1);
        }

        return stats;
    }

    private Map<String, Integer> calculateDailyStats(List<Map<String, Object>> alarmsList) {
        // 일별 통계 계산 로직
        return new HashMap<>(); // 실제 구현 필요
    }

    private Map<String, Integer> calculateWeeklyStats(List<Map<String, Object>> alarmsList) {
        // 주별 통계 계산 로직
        return new HashMap<>(); // 실제 구현 필요
    }

    private Map<String, Integer> calculateMonthlyStats(List<Map<String, Object>> alarmsList) {
        // 월별 통계 계산 로직
        return new HashMap<>(); // 실제 구현 필요
    }

    private Map<String, Integer> calculateAlarmTypeStats(List<Map<String, Object>> alarmsList) {
        Map<String, Integer> stats = new HashMap<>();

        for (Map<String, Object> alarm : alarmsList) {
            String type = (String) alarm.get("alarmType");
            stats.put(type, stats.getOrDefault(type, 0) + 1);
        }

        return stats;
    }

    private Map<String, Map<String, Integer>> calculateCrossStats(List<Map<String, Object>> alarmsList) {
        Map<String, Map<String, Integer>> crossStats = new HashMap<>();

        for (Map<String, Object> alarm : alarmsList) {
            String alarmType = (String) alarm.get("alarmType");
            String recognizedType = (String) alarm.get("recognizedType");

            if (!crossStats.containsKey(alarmType)) {
                crossStats.put(alarmType, new HashMap<>());
            }

            Map<String, Integer> innerMap = crossStats.get(alarmType);
            innerMap.put(recognizedType, innerMap.getOrDefault(recognizedType, 0) + 1);
        }

        return crossStats;
    }
}