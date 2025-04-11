package kr.kro.smartcap.smartcap_back.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventSummaryResponse {
    // 최근 알람 목록
    private List<AlarmDTO> recentAlarms;

    // 월간 사고 위험 순위 (Recognized Type별 집계)
    private Map<String, Integer> monthlyDangerRanking;

    // 일/주/월별 알람 통계
    private Map<String, Integer> dailyAlarmCounts;
    private Map<String, Integer> weeklyAlarmCounts;
    private Map<String, Integer> monthlyAlarmCounts;

    // 알람 타입별 집계
    private Map<String, Integer> alarmTypeCounts;

    // 위험 유형별 발생 현황 (기간별, 위험도별)
    private Map<String, Map<String, Integer>> accidentTypeTrend;
}