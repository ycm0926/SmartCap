package kr.kro.smartcap.smartcap_back.weather.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeatherDTO {
    private String location;      // 위치 정보
    private String weatherMain;   // 날씨 메인 (Clear, Rain, etc)
    private String weatherDesc;   // 날씨 상세 설명
    private Double temperature;   // 온도
    private Double humidity;      // 습도
    private Double windSpeed;     // 풍속
    private String timestamp;     // 데이터 갱신 시간 (LocalDateTime 대신 String으로 변경)

    // 한국어 날씨 변환 (UI 표시용)
    public String getKoreanWeather() {
        if (weatherMain == null) return "알 수 없음";

        return switch (weatherMain.toLowerCase()) {
            case "clear" -> "맑음";
            case "clouds" -> "구름";
            case "rain", "drizzle" -> "비";
            case "thunderstorm" -> "천둥번개";
            case "snow" -> "눈";
            case "mist", "fog", "haze" -> "안개";
            case "dust", "sand" -> "황사";
            default -> weatherMain;
        };
    }
}