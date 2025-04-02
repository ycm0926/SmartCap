package kr.kro.smartcap.smartcap_back.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmDTO {
    private Long alarm_id;
    private Long construction_sites_id;
    private Long weather_id;
    private Long device_id;       // 안전모 ID
    private GpsDTO gps;
    private String alarm_type;    // Warning, Danger, Accident
    private String recognized_type; // Material, Vehicle, Falling 등
    private LocalDateTime created_at;
    private Long accident_id;     // 사고 ID (사고 발생 시에만)
    private String site_name;     // 현장 이름
    private String construction_status; // 현장 상태
    private String weather;       // 날씨 문자열 (맑음, 흐림, 비, 눈, 안개)
}