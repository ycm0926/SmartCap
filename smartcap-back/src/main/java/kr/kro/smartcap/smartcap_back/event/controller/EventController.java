package kr.kro.smartcap.smartcap_back.event.controller;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentVideoRepository;
import kr.kro.smartcap.smartcap_back.accident.service.AccidentProcessingService;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import kr.kro.smartcap.smartcap_back.alarm.service.AlarmProcessingService;
import kr.kro.smartcap.smartcap_back.event.dto.*;

import kr.kro.smartcap.smartcap_back.event.dto.stat.StatResponseDto;
import kr.kro.smartcap.smartcap_back.event.service.EventService;
import org.locationtech.jts.geom.Point;
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
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired
    public EventController(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Autowired
    private AccidentHistoryRepository accidentHistoryRepository;

    @Autowired
    private AlarmHistoryRepository alarmHistoryRepository;

    @Autowired
    private EventService eventService;

    @Autowired
    private AccidentProcessingService accidentProcessingService;

    @Autowired
    private AlarmProcessingService alarmProcessingService;

    @Autowired
    private AccidentVideoRepository accidentVideoRepository;

    /**
     * 대시보드용 데이터를 제공하는 엔드포인트
     */

    @GetMapping("/dashboard")
    public StatResponseDto getDashboardData() {
        return eventService.getDashboardSummary();
    }


    /**
     * 지도 화면용 데이터를 제공하는 엔드포인트
     */
    @GetMapping("/map")
    public MapDataResponse getMapData() {
        // EventController.java의 getMapData 메서드 시작 부분에 추가
        try {
            // 테스트: 첫 번째 알람 레코드의 GPS 확인
            Optional<AlarmHistory> testAlarm = alarmHistoryRepository.findById(1L);
            if (testAlarm.isPresent() && testAlarm.get().getGps() != null) {
                Point gps = testAlarm.get().getGps();
                System.out.println("테스트 알람 GPS: X=" + gps.getX() + ", Y=" + gps.getY() + ", Type=" + gps.getGeometryType());
            } else {
                System.out.println("테스트 알람 GPS 없음");
            }
        } catch (Exception e) {
            System.err.println("GPS 테스트 오류: " + e.getMessage());
            e.printStackTrace();
        }


        // 1. DB에서 최근 7일간의 알람 데이터 가져오기
        List<AlarmDTO> recentAlarms = new ArrayList<>();

        try {
            // AlarmHistoryRepository의 findRecentAlarms 메서드를 사용해 최근 알람을 가져옴
            List<AlarmHistory> recentAlarmEntities = alarmHistoryRepository.findRecentAlarms(100); // 최근 100개 알람

            // 7일 이내의 알람만 필터링
            LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);

            recentAlarms = recentAlarmEntities.stream()
                    .filter(alarm -> {
                        LocalDateTime alarmTime = alarm.getCreatedAt().toLocalDateTime();
                        return alarmTime.isAfter(sevenDaysAgo);
                    })
                    .map(this::convertToAlarmDTO)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Error fetching alarm data: " + e.getMessage());
            e.printStackTrace();
        }

        // 2. DB에서 사고 데이터 가져오기
        List<AccidentDTO> accidentDTOs = new ArrayList<>();

        try {
            List<AccidentHistory> accidentEntities = accidentHistoryRepository.findAll();

            // 사고 영상 데이터 미리 로드
            List<AccidentVideo> allVideos = accidentVideoRepository.findAll();
            Map<Long, AccidentVideo> videoMap = allVideos.stream()
                    .collect(Collectors.toMap(
                            video -> video.getAccidentId(),
                            video -> video,
                            (v1, v2) -> v1 // 충돌 시 첫 번째 값 사용
                    ));

            accidentDTOs = accidentEntities.stream()
                    .map(accident -> convertToAccidentDTO(accident, videoMap))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Error fetching accident data: " + e.getMessage());
            e.printStackTrace();
        }

        // 3. 응답 반환
        return MapDataResponse.builder()
                .recentAlarms(recentAlarms)
                .fallingAccidents(accidentDTOs)
                .build();
    }

    /**
     * AlarmHistory 엔티티를 AlarmDTO로 변환
     */
    private AlarmDTO convertToAlarmDTO(AlarmHistory alarm) {
        AlarmDTO dto = new AlarmDTO();
        dto.setAlarm_id(alarm.getAlarmId());
        dto.setConstruction_sites_id(alarm.getConstructionSitesId());
        // device_id 필드는 DB에 없으므로 설정하지 않음
        dto.setAlarm_type(alarm.getAlarmType());
        dto.setRecognized_type(alarm.getRecognizedType());
        dto.setWeather(alarm.getWeather());
        dto.setCreated_at(alarm.getCreatedAt().toLocalDateTime());

        // 하드코딩된 추가 정보 (SSE와 일치하도록)
        dto.setSite_name("역삼역 공사장"); // 현장 이름 하드코딩
        dto.setConstruction_status("진행중"); // 현장 상태 하드코딩

        // GPS 정보 설정
        if (alarm.getGps() != null) {
            GpsDTO gps = new GpsDTO();
            gps.setType("Point");
            gps.setCoordinates(new double[]{alarm.getGps().getX(), alarm.getGps().getY()});
            dto.setGps(gps);
        } else {
            // 기본 GPS 값 설정 (데이터가 없는 경우)
            GpsDTO gps = new GpsDTO();
            gps.setType("Point");
            gps.setCoordinates(new double[]{126.9780, 37.5665}); // 서울시청 좌표
            dto.setGps(gps);
        }

        return dto;
    }

    /**
     * AccidentHistory 엔티티를 AccidentDTO로 변환
     * @param accident 사고 이력 엔티티
     * @param videoMap 사고 ID를 키로 하는 비디오 맵 (성능 향상을 위해 미리 로드)
     */
    private AccidentDTO convertToAccidentDTO(AccidentHistory accident, Map<Long, AccidentVideo> videoMap) {
        AccidentDTO dto = new AccidentDTO();

        // AlarmDTO의 기본 필드 설정
        dto.setAlarm_id(accident.getAccidentId()); // 사고 ID를 알람 ID로 사용
        dto.setAccident_id(accident.getAccidentId());
        dto.setConstruction_sites_id(accident.getConstructionSitesId());
        // device_id 필드는 DB에 없으므로 설정하지 않음
        dto.setAlarm_type("Accident"); // 사고는 항상 "Accident" 타입
        dto.setRecognized_type(accident.getAccidentType()); // 사고 유형을 인식 유형으로 사용
        dto.setWeather(accident.getWeather() != null ? accident.getWeather() : "맑음");
        dto.setCreated_at(accident.getCreatedAt().toLocalDateTime());

        // 하드코딩된 추가 정보 (SSE와 일치하도록)
        dto.setSite_name("역삼역 공사장"); // 현장 이름 하드코딩
        dto.setConstruction_status("진행중"); // 현장 상태 하드코딩

        // GPS 정보 설정
        if (accident.getGps() != null) {
            GpsDTO gps = new GpsDTO();
            gps.setType("Point");
            gps.setCoordinates(new double[]{accident.getGps().getX(), accident.getGps().getY()});
            dto.setGps(gps);
        } else {
            // 기본 GPS 값 설정 (데이터가 없는 경우)
            GpsDTO gps = new GpsDTO();
            gps.setType("Point");
            gps.setCoordinates(new double[]{126.9780, 37.5665}); // 서울시청 좌표
            dto.setGps(gps);
        }

        // 비디오 정보 설정 (미리 로드된 맵 사용)
        AccidentVideo video = videoMap.get(accident.getAccidentId());
        if (video != null) {
            dto.setAccident_video_id(video.getAccidentVideoId());
            dto.setVideo_url(video.getVideoUrl());
        } else {
            // 기본 비디오 정보 설정 (데이터가 없는 경우)
            dto.setAccident_video_id(accident.getAccidentId() + 500); // 임의의 비디오 ID
            dto.setVideo_url("/sample-fall-video.mp4"); // 기본 샘플 비디오 URL
        }

        return dto;
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
}