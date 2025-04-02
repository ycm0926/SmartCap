package kr.kro.smartcap.smartcap_back.accident.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AccidentHistoryDto {
    private Long constructionSitesId;
    private String gps;      // 위치 정보 (문자열)
    private String accidentType;  // 사고 유형
}
