package kr.kro.smartcap.smartcap_back.event.dto.stat;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StatEntryDto {
    private String field;           // 예: "car:fire"
    private long count;             // 발생 횟수
}
