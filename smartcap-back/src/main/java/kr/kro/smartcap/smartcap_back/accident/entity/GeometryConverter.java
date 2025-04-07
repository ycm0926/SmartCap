package kr.kro.smartcap.smartcap_back.accident.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKTReader;

@Converter(autoApply = true)
public class GeometryConverter implements AttributeConverter<Point, String> {
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Override
    public String convertToDatabaseColumn(Point attribute) {
        if (attribute == null) {
            return null;
        }
        return "SRID=4326;" + attribute.toText().replace("POINT (", "POINT(");
    }

    @Override
    public Point convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }

        try {
            // WKB 형식 처리를 위한 로직 추가
            if (dbData.startsWith("0101000020E6100000")) {
                // WKB to Geometry 변환
                byte[] wkb = hexStringToByteArray(dbData);
                WKBReader reader = new WKBReader(geometryFactory);
                Geometry geometry = reader.read(wkb);

                if (geometry instanceof Point) {
                    Point point = (Point) geometry;
                    point.setSRID(4326);
                    return point;
                }
            }

            // 기존 WKT 처리 로직
            String wkt = dbData;
            if (wkt.startsWith("SRID=4326;")) {
                wkt = wkt.substring("SRID=4326;".length());
            }

            if (!wkt.toUpperCase().startsWith("POINT")) {
                return null;
            }

            WKTReader reader = new WKTReader(geometryFactory);
            Point point = (Point) reader.read(wkt);
            point.setSRID(4326);
            return point;
        } catch (Exception e) {
            System.err.println("지오메트리 변환 오류: " + dbData + " - " + e.getMessage());
            return null;
        }
    }

    // 16진수 문자열을 바이트 배열로 변환하는 헬퍼 메서드
    private byte[] hexStringToByteArray(String hexString) {
        int len = hexString.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hexString.charAt(i), 16) << 4)
                    + Character.digit(hexString.charAt(i+1), 16));
        }
        return data;
    }
}