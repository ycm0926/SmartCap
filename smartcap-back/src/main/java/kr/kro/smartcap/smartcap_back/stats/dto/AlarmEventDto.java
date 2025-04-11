package kr.kro.smartcap.smartcap_back.stats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmEventDto {
    private Long constructionSitesId;
    private String gps; // 임시 문자열 표현 (예: "POINT(127.0 37.5)")
    private String alarmType;
    private String recognizedType;
    private String weather;
    private LocalDateTime createdAt;
}