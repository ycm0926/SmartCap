package kr.kro.smartcap.smartcap_back.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MapDataResponse {
    // 최근 7일간의 알람 목록 (1단계, 2단계)
    private List<AlarmDTO> recentAlarms;

    // 모든 낙상 사고 데이터
    private List<AccidentDTO> fallingAccidents;
}