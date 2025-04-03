package kr.kro.smartcap.smartcap_back.accident.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKTReader;

@Converter(autoApply = true)
public class GeometryConverter implements AttributeConverter<Point, String> {

    // SRID 4326을 지정한 GeometryFactory 생성
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Override
    public String convertToDatabaseColumn(Point attribute) {
        if (attribute == null) {
            return null;
        }
        // JTS의 toText() 결과는 "POINT (127.1234 37.5678)" 형태가 나오므로, 공백을 제거하여 "POINT(127.1234 37.5678)"로 변환
        String wktText = attribute.toText().replace("POINT (", "POINT(");
        // EWKT 형식: "SRID=4326;POINT(127.1234 37.5678)"
        return "SRID=4326;" + wktText;
    }

    @Override
    public Point convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }

        // 데이터가 실제로 유효한지 추가 확인
        if (dbData.equals("POINT EMPTY") || dbData.equals("SRID=4326;POINT EMPTY")) {
            return null;
        }

        String wkt = dbData;
        if (wkt.startsWith("SRID=4326;")) {
            wkt = wkt.substring("SRID=4326;".length());
        }

        try {
            // 추가 유효성 검사
            if (!wkt.toUpperCase().startsWith("POINT")) {
                return null;
            }

            WKTReader reader = new WKTReader(geometryFactory);
            Point point = (Point) reader.read(wkt);
            point.setSRID(4326);
            return point;
        } catch (Exception e) {
            // 예외를 던지는 대신 로그를 남기고 null 반환
            System.err.println("지오메트리 변환 오류: " + dbData + " - " + e.getMessage());
            return null;
        }
    }

}
