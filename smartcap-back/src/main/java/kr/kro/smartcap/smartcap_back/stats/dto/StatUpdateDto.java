package kr.kro.smartcap.smartcap_back.stats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE로 프론트에 전송할 통계 변경 정보 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatUpdateDto {
    private String scope;     // "hour", "day", "month"
    private String key;       // Redis 키 (예: summary:day:2025-04-01)
    private String field;     // 알람 또는 사고 필드 (예: car:fire, fall:accident)
    private long newValue;    // 최신 카운트 값
}
