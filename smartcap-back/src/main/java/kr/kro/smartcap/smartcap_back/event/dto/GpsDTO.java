package kr.kro.smartcap.smartcap_back.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GpsDTO {
    private String type;         // "Point"
    private double[] coordinates; // [경도, 위도] 순서
}