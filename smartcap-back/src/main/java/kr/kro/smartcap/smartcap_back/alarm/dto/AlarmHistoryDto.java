package kr.kro.smartcap.smartcap_back.alarm.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AlarmHistoryDto {
    private String recognizedType;  // 인식된 객체 (차량, 추락, 건설자재 등)
    private int alarmType;       // 알람 단계 (1-9)
}