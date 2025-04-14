package kr.kro.smartcap.smartcap_back.event.controller;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryRedisDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentVideoRepository;
import kr.kro.smartcap.smartcap_back.accident.service.AccidentProcessingService;
import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import kr.kro.smartcap.smartcap_back.alarm.service.AlarmProcessingService;
import kr.kro.smartcap.smartcap_back.event.dto.*;
import kr.kro.smartcap.smartcap_back.alarm.dto.AlarmHistoryRedisDto;

import kr.kro.smartcap.smartcap_back.event.dto.stat.StatResponseDto;
import kr.kro.smartcap.smartcap_back.event.service.EventService;
import org.locationtech.jts.geom.Point;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.security.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
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
        // 기존 알람 데이터 목록 초기화
        List<AlarmDTO> recentAlarms = new ArrayList<>();

        // 현재 날짜 기준 7일 전 날짜 계산
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        LocalDate today = LocalDate.now();

        try {
            // 1. Redis에서 오늘의 사고 데이터 가져오기
            Set<String> accidentRedisKeys = redisTemplate.keys("accident:*:" + today);

            if (accidentRedisKeys != null && !accidentRedisKeys.isEmpty()) {
                for (String key : accidentRedisKeys) {
                    List<Object> todayAccidentsObj = redisTemplate.opsForList().range(key, 0, -1);
                    if (todayAccidentsObj != null) {
                        for (Object obj : todayAccidentsObj) {
                            // Redis DTO를 AlarmDTO로 변환
                            AlarmDTO alarmDto = convertRedisObjectToAlarmDTO(obj);
                            if (alarmDto != null) {
                                // 고유한 ID 생성 (timestamp + constructionSiteId + hashCode)
                                long timestamp = System.currentTimeMillis();
                                int hashCode = (alarmDto.getAlarm_type() + alarmDto.getCreated_at().toString()).hashCode();
                                alarmDto.setAlarm_id(timestamp * 100 + Math.abs(hashCode % 100));

                                recentAlarms.add(alarmDto);
                            }
                        }
                    }
                }
            }

            // 2. Redis에서 오늘의 알람 데이터 가져오기 (기존 코드 유지)
            Set<String> alarmRedisKeys = redisTemplate.keys("alarm:*:" + today);

            if (alarmRedisKeys != null && !alarmRedisKeys.isEmpty()) {
                for (String key : alarmRedisKeys) {
                    List<Object> todayAlarmsObj = redisTemplate.opsForList().range(key, 0, -1);
                    List<AlarmHistoryRedisDto> todayAlarms = new ArrayList<>();

                    if (todayAlarmsObj != null) {
                        for (Object obj : todayAlarmsObj) {
                            if (obj instanceof AlarmHistoryRedisDto) {
                                todayAlarms.add((AlarmHistoryRedisDto) obj);
                            } else if (obj instanceof Map) {
                                // Map으로 저장된 경우 수동 변환
                                Map<String, Object> map = (Map<String, Object>) obj;
                                AlarmHistoryRedisDto dto = new AlarmHistoryRedisDto();

                                if (map.containsKey("constructionSitesId")) {
                                    dto.setConstructionSitesId(Long.valueOf(map.get("constructionSitesId").toString()));
                                }
                                if (map.containsKey("alarmType")) {
                                    dto.setAlarmType((String) map.get("alarmType"));
                                }
                                if (map.containsKey("recognizedType")) {
                                    dto.setRecognizedType((String) map.get("recognizedType"));
                                }
                                if (map.containsKey("weather")) {
                                    dto.setWeather((String) map.get("weather"));
                                }
                                if (map.containsKey("createdAt")) {
                                    Object createdAtObj = map.get("createdAt");
                                    if (createdAtObj instanceof java.sql.Timestamp) {
                                        dto.setCreatedAt((java.sql.Timestamp) createdAtObj);
                                    } else if (createdAtObj instanceof String) {
                                        try {
                                            Instant instant = Instant.parse((String) createdAtObj);
                                            dto.setCreatedAt(new java.sql.Timestamp(instant.toEpochMilli()));
                                        } catch (Exception e) {
                                            dto.setCreatedAt(new java.sql.Timestamp(System.currentTimeMillis()));
                                        }
                                    }
                                }
                                if (map.containsKey("lat")) {
                                    dto.setLat(Double.parseDouble(map.get("lat").toString()));
                                }
                                if (map.containsKey("lng")) {
                                    dto.setLng(Double.parseDouble(map.get("lng").toString()));
                                }

                                todayAlarms.add(dto);
                            }
                        }
                    }

                    if (todayAlarms != null && !todayAlarms.isEmpty()) {
                        for (AlarmHistoryRedisDto redisDto : todayAlarms) {
                            // Redis DTO를 AlarmDTO로 변환
                            AlarmDTO alarmDto = new AlarmDTO();

                            // 고유한 ID 생성
                            long timestamp = System.currentTimeMillis();
                            int hashCode = (redisDto.getAlarmType() + redisDto.getCreatedAt().toString()).hashCode();
                            alarmDto.setAlarm_id(timestamp * 100 + Math.abs(hashCode % 100));

                            alarmDto.setConstruction_sites_id(redisDto.getConstructionSitesId());

                            // GPS 데이터 설정
                            if (redisDto.getLat() != 0.0 && redisDto.getLng() != 0.0) {
                                GpsDTO gpsDto = new GpsDTO();
                                gpsDto.setType("Point");
                                gpsDto.setCoordinates(new double[] {redisDto.getLng(), redisDto.getLat()});
                                alarmDto.setGps(gpsDto);
                            }

                            alarmDto.setAlarm_type(redisDto.getAlarmType());
                            alarmDto.setRecognized_type(redisDto.getRecognizedType());
                            alarmDto.setWeather(redisDto.getWeather());

                            // 날짜 변환
                            if (redisDto.getCreatedAt() != null) {
                                alarmDto.setCreated_at(redisDto.getCreatedAt().toLocalDateTime());
                            } else {
                                alarmDto.setCreated_at(LocalDateTime.now());
                            }

                            // 추가 정보
                            alarmDto.setSite_name("역삼역 공사장");
                            alarmDto.setConstruction_status("진행중");

                            recentAlarms.add(alarmDto);
                        }
                    }
                }
            }


            // 3. DB에서 과거 사고 데이터 가져오기 (최근 7일 데이터만)
            List<AccidentHistory> accidentEntities = accidentHistoryRepository.findAll();

            // 3-1. 사고 ID를 키로 비디오 정보를 맵으로 미리 로드 (성능 최적화)
            List<AccidentVideo> videos = accidentVideoRepository.findAll();
            Map<Long, AccidentVideo> videoMap = videos.stream()
                    .collect(Collectors.toMap(
                            AccidentVideo::getAccidentId,
                            video -> video,
                            (v1, v2) -> v1  // 중복 키가 있을 경우 첫 번째 값 유지
                    ));

            // 4. DB 사고 데이터를 AccidentDTO로 변환
            List<AccidentDTO> accidentDTOs = accidentEntities.stream().map(entity -> {
                AccidentDTO dto = new AccidentDTO();
                dto.setAccident_id(entity.getAccidentId());
                dto.setAlarm_id(entity.getAccidentId()); // 알람 ID로도 사용
                dto.setConstruction_sites_id(entity.getConstructionSitesId());
                dto.setAlarm_type("3");
                dto.setRecognized_type(entity.getAccidentType());
                dto.setWeather(entity.getWeather());
                dto.setCreated_at(entity.getCreatedAt().toLocalDateTime());

                // GPS
                if (entity.getGps() != null) {
                    GpsDTO gps = new GpsDTO();
                    gps.setType("Point");
                    gps.setCoordinates(new double[]{entity.getGps().getX(), entity.getGps().getY()});
                    dto.setGps(gps);
                }


                // 비디오 정보 설정 (미리 로드된 맵 사용)
                AccidentVideo video = videoMap.get(entity.getAccidentId());
                if (video != null) {
                    dto.setAccident_video_id(video.getAccidentVideoId());
                    dto.setVideo_url(video.getVideoUrl());
                } else {
                    // 기본 비디오 정보 설정 (데이터가 없는 경우)
                    dto.setAccident_video_id(entity.getAccidentId() + 500); // 임의의 비디오 ID
                    dto.setVideo_url("https://smartcap102.s3.ap-northeast-2.amazonaws.com/accident_video/device_23_1744609514210.mp4"); // 기본 샘플 비디오 URL
                }

                return dto;
            }).collect(Collectors.toList());

            //7일치 알람 가져오기

            // 3. DB에서 과거 알람 데이터 가져오기 (최근 7일 데이터만)
            List<AlarmHistory> alarms = alarmHistoryRepository.findAllFromLast7Days(sevenDaysAgo);

            // 4. DB 사고 데이터를 AccidentDTO로 변환
            List<AccidentDTO> alarmDTOs = alarms.stream().map(entity -> {
                AccidentDTO dto = new AccidentDTO();
                dto.setAlarm_id(entity.getAlarmId());
                dto.setConstruction_sites_id(entity.getConstructionSitesId());
                dto.setAlarm_type(entity.getAlarmType());
                dto.setRecognized_type(entity.getRecognizedType());
                dto.setWeather(entity.getWeather());
                dto.setCreated_at(entity.getCreatedAt().toLocalDateTime());

                // GPS
                if (entity.getGps() != null) {
                    GpsDTO gps = new GpsDTO();
                    gps.setType("Point");
                    gps.setCoordinates(new double[]{entity.getGps().getX(), entity.getGps().getY()});
                    dto.setGps(gps);
                }



                return dto;
            }).collect(Collectors.toList());

            accidentDTOs.addAll(alarmDTOs);

            // 5. 최종 응답 생성 전 필터링 및 제한
            List<AlarmDTO> filteredAlarms = recentAlarms.stream()
                    .filter(alarm -> alarm.getCreated_at() != null && alarm.getCreated_at().isAfter(sevenDaysAgo))
                    .limit(10000) // 최대 10000개로 제한
                    .collect(Collectors.toList());

            return MapDataResponse.builder()
                    .recentAlarms(filteredAlarms)
                    .fallingAccidents(accidentDTOs)
                    .build();
        } catch (Exception e) {
            // 오류 로깅
            System.err.println("지도 데이터 조회 중 오류 발생: " + e.getMessage());
            e.printStackTrace();

            // 빈 응답 반환
            return MapDataResponse.builder()
                    .recentAlarms(new ArrayList<>())
                    .fallingAccidents(new ArrayList<>())
                    .build();
        }
    }

    @GetMapping("/video/{id}")
    public ResponseEntity<?> getVideoData(@PathVariable Long id) {
        try {
            // 사고 ID로 AccidentVideo 조회
            Optional<AccidentVideo> videoOpt = accidentVideoRepository.findById(id);

            // AccidentVideo가 없으면 사고 ID로 직접 검색
            if (videoOpt.isEmpty()) {
                videoOpt = accidentVideoRepository.findByAccidentId(id);
            }

            if (videoOpt.isPresent()) {
                AccidentVideo video = videoOpt.get();
                Map<String, Object> response = new HashMap<>();
                response.put("accident_video_id", video.getAccidentVideoId());
                response.put("accident_id", video.getAccidentId());
                response.put("video_url", video.getVideoUrl());

                return ResponseEntity.ok(response);
            } else {
                // 비디오가 없는 경우 기본 응답
                Map<String, Object> response = new HashMap<>();
                response.put("accident_video_id", id + 500); // 임의 ID
                response.put("accident_id", id);
                response.put("video_url", "https://smartcap102.s3.ap-northeast-2.amazonaws.com/accident_video/device_23_1744609514210.mp4");

                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving video data: " + e.getMessage());
        }
    }

    // Redis 객체를 AlarmDTO로 변환하는 헬퍼 메소드
    private AlarmDTO convertRedisObjectToAlarmDTO(Object obj) {
        try {
            if (obj instanceof AccidentHistoryRedisDto) {
                // AccidentHistoryRedisDto 처리
                AccidentHistoryRedisDto redisDto = (AccidentHistoryRedisDto) obj;
                AlarmDTO alarmDto = new AlarmDTO();

                alarmDto.setConstruction_sites_id(redisDto.getConstructionSitesId());

                // GPS 데이터 설정
                if (redisDto.getLat() != 0.0 && redisDto.getLng() != 0.0) {
                    GpsDTO gpsDto = new GpsDTO();
                    gpsDto.setType("Point");
                    gpsDto.setCoordinates(new double[] {redisDto.getLng(), redisDto.getLat()});
                    alarmDto.setGps(gpsDto);
                }

                alarmDto.setAlarm_type("Accident");
                alarmDto.setRecognized_type(redisDto.getAccidentType());
                alarmDto.setWeather(redisDto.getWeather());

                // 날짜 변환
                if (redisDto.getCreatedAt() != null) {
                    alarmDto.setCreated_at(redisDto.getCreatedAt().toLocalDateTime());
                } else {
                    alarmDto.setCreated_at(LocalDateTime.now());
                }

                // 추가 정보
                alarmDto.setSite_name("역삼역 공사장");
                alarmDto.setConstruction_status("진행중");

                return alarmDto;
            } else if (obj instanceof Map) {
                // Map으로 저장된 경우 처리
                Map<String, Object> map = (Map<String, Object>) obj;
                AlarmDTO alarmDto = new AlarmDTO();

                if (map.containsKey("constructionSitesId")) {
                    alarmDto.setConstruction_sites_id(Long.valueOf(map.get("constructionSitesId").toString()));
                }

                // GPS 데이터 설정
                double lat = 0, lng = 0;
                if (map.containsKey("lat")) {
                    lat = Double.parseDouble(map.get("lat").toString());
                }
                if (map.containsKey("lng")) {
                    lng = Double.parseDouble(map.get("lng").toString());
                }

                if (lat != 0 && lng != 0) {
                    GpsDTO gpsDto = new GpsDTO();
                    gpsDto.setType("Point");
                    gpsDto.setCoordinates(new double[] {lng, lat});
                    alarmDto.setGps(gpsDto);
                }

                if (map.containsKey("alarmType")) {
                    alarmDto.setAlarm_type((String) map.get("alarmType"));
                } else if (map.containsKey("accidentType")) {
                    alarmDto.setAlarm_type("Accident");
                } else {
                    alarmDto.setAlarm_type("Warning");
                }

                if (map.containsKey("recognizedType")) {
                    alarmDto.setRecognized_type((String) map.get("recognizedType"));
                } else if (map.containsKey("accidentType")) {
                    alarmDto.setRecognized_type((String) map.get("accidentType"));
                }

                if (map.containsKey("weather")) {
                    alarmDto.setWeather((String) map.get("weather"));
                }

                // 날짜 설정
                if (map.containsKey("createdAt")) {
                    Object createdAtObj = map.get("createdAt");
                    if (createdAtObj instanceof java.sql.Timestamp) {
                        alarmDto.setCreated_at(((java.sql.Timestamp) createdAtObj).toLocalDateTime());
                    } else if (createdAtObj instanceof String) {
                        try {
                            Instant instant = Instant.parse((String) createdAtObj);
                            alarmDto.setCreated_at(LocalDateTime.ofInstant(instant, ZoneId.systemDefault()));
                        } catch (Exception e) {
                            alarmDto.setCreated_at(LocalDateTime.now());
                        }
                    }
                } else {
                    alarmDto.setCreated_at(LocalDateTime.now());
                }

                // 추가 정보
                alarmDto.setSite_name("역삼역 공사장");
                alarmDto.setConstruction_status("진행중");

                return alarmDto;
            }
        } catch (Exception e) {
            System.err.println("Redis 객체 변환 중 오류: " + e.getMessage());
        }
        return null;
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
}