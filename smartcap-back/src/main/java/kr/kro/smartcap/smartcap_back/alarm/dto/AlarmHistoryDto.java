package kr.kro.smartcap.smartcap_back.alarm.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AlarmHistoryDto {
    private Long constructionSitesId;
    private int alarmType;  // 사고 유형 (1-9)
}