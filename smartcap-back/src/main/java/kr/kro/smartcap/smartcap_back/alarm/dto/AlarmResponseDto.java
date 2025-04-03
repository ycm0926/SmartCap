package kr.kro.smartcap.smartcap_back.alarm.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.Map;

@Getter
@Setter
@Builder
public class AlarmResponseDto {
    private Long alarmId;
    private Long constructionSitesId;
    private Map<String, Object> gps;
    private String alarmType;
    private String recognizedType;
    private String createdAt;
    private String weather;
    private String siteName;
    private String constructionStatus;
}