package kr.kro.smartcap.smartcap_back.event.dto.stat;

import kr.kro.smartcap.smartcap_back.event.dto.stat.StatEntryDto;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StatGroupDto {
    private String key;                   // 예: "2025-04-01:15" (시간), "2025-04-01" (일), "2025-04" (월)
    private String scope; // "month"
    private List<StatEntryDto> stats;     // 각 필드별 통계
}
