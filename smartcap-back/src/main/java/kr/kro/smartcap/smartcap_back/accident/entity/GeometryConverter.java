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
        if (dbData == null) {
            return null;
        }
        String wkt = dbData;
        if (wkt.startsWith("SRID=4326;")) {
            wkt = wkt.substring("SRID=4326;".length());
        }
        try {
            WKTReader reader = new WKTReader(geometryFactory);
            Point point = (Point) reader.read(wkt);
            point.setSRID(4326);
            return point;
        } catch (Exception e) {
            throw new RuntimeException("Error converting String to Point", e);
        }
    }
}
