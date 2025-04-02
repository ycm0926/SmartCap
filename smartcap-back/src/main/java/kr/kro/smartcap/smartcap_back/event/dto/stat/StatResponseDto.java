package kr.kro.smartcap.smartcap_back.event.dto.stat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatResponseDto {
    private List<StatGroupDto> hourlyStats;    // 시간별 통계
    private List<StatGroupDto> dailyStats;     // 일별 통계
    private List<StatGroupDto> monthlyStats;   // 월별 통계
}