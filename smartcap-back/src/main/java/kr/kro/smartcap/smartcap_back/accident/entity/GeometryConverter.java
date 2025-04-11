package kr.kro.smartcap.smartcap_back.accident.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKTReader;
import org.postgresql.util.PGobject;

@Converter(autoApply = true)
public class GeometryConverter implements AttributeConverter<Point, Object> {
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    @Override
    public Object convertToDatabaseColumn(Point attribute) {
        if (attribute == null) {
            return null;
        }
        // 저장 시 WKT 형식(또는 hex 문자열 형식 등 원하는 포맷)으로 변환하여 PGobject에 담기
        try {
            PGobject pgObject = new PGobject();
            pgObject.setType("geometry");
            // WKT 형식을 사용한다면 SRID도 포함하여 저장
            pgObject.setValue("SRID=4326;" + attribute.toText().replace("POINT (", "POINT("));
            return pgObject;
        } catch (Exception e) {
            throw new RuntimeException("지오메트리 변환 오류", e);
        }
    }

    @Override
    public Point convertToEntityAttribute(Object dbData) {
        if (dbData == null) {
            return null;
        }
        try {
            String geomStr;
            if (dbData instanceof PGobject) {
                PGobject pg = (PGobject) dbData;
                geomStr = pg.getValue();
            } else if (dbData instanceof String) {
                geomStr = (String) dbData;
            } else {
                // 예상치 못한 타입의 경우 toString 처리
                geomStr = dbData.toString();
            }

            // WKB 형식 처리를 위한 로직 (hex 문자열)
            if (geomStr.startsWith("0101000020E6100000")) {
                byte[] wkb = hexStringToByteArray(geomStr);
                WKBReader wkbReader = new WKBReader(geometryFactory);
                Geometry geometry = wkbReader.read(wkb);
                if (geometry instanceof Point) {
                    Point point = (Point) geometry;
                    point.setSRID(4326);
                    return point;
                }
            }
            // WKT 처리 (SRID 포함 혹은 미포함)
            String wkt = geomStr;
            if (wkt.startsWith("SRID=4326;")) {
                wkt = wkt.substring("SRID=4326;".length());
            }
            if (!wkt.toUpperCase().startsWith("POINT")) {
                return null;
            }
            WKTReader wktReader = new WKTReader(geometryFactory);
            Point point = (Point) wktReader.read(wkt);
            point.setSRID(4326);
            return point;
        } catch (Exception e) {
            System.err.println("지오메트리 변환 오류: " + dbData + " - " + e.getMessage());
            return null;
        }
    }

    private byte[] hexStringToByteArray(String hexString) {
        int len = hexString.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hexString.charAt(i), 16) << 4)
                    + Character.digit(hexString.charAt(i + 1), 16));
        }
        return data;
    }
}
