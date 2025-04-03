package kr.kro.smartcap.smartcap_back.accident.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AccidentHistoryDto {
    private Long constructionSitesId;
    private int accidentType;  // 사고 유형 (1-9)
}
