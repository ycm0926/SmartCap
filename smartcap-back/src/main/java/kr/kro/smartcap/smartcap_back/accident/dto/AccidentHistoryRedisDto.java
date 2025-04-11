package kr.kro.smartcap.smartcap_back.accident.dto;

import lombok.Data;

import java.sql.Timestamp;

@Data
public class AccidentHistoryRedisDto {
    private Long constructionSitesId;
    private String accidentType;
    private String weather;
    private Timestamp createdAt;
    private double lat;
    private double lng;
}
