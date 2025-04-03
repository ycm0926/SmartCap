package kr.kro.smartcap.smartcap_back.alarm.dto;

import lombok.Data;
import java.sql.Timestamp;

@Data
public class AlarmHistoryRedisDto {
    private Long constructionSitesId;
    private String alarmType;
    private String recognizedType;
    private String weather;
    private Timestamp createdAt;
    private double lat;
    private double lng;
}
