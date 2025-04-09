package kr.kro.smartcap.smartcap_back.accident.entity;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKBWriter;

import java.io.Serializable;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

public class PointType implements UserType<Point> {

    @Override
    public int getSqlType() {
        return Types.OTHER;
    }

    @Override
    public Class<Point> returnedClass() {
        return Point.class;
    }

    @Override
    public boolean equals(Point x, Point y) {
        return x != null && x.equals(y);
    }

    @Override
    public int hashCode(Point x) {
        return x.hashCode();
    }

    @Override
    public Point nullSafeGet(ResultSet rs, int position, SharedSessionContractImplementor session, Object owner) throws SQLException {
//        byte[] bytes = rs.getBytes("gps");
        String gps = rs.getString("gps");
        System.out.println(gps);

//        byte[] bytes = hexStringToByteArray(gps);


        if (gps == null) {
            return null;
        }
        WKBReader reader = new WKBReader();
        try {
            byte[] bytes = hexToBytes(gps);
            System.out.println(111111);

            Geometry geometry = reader.read(bytes);
            System.out.println(222222);

//            Geometry geometry = reader.read(bytes);
            System.out.println(33333);
            System.out.println(geometry.equals(null));

            System.out.println(44444);

            return (Point) geometry;
        } catch (Exception e) {
            throw new SQLException("Failed to convert WKB to Point", e);
        }
    }

    @Override
    public void nullSafeSet(PreparedStatement st, Point value, int index, SharedSessionContractImplementor session) throws SQLException {
        if (value == null) {
            st.setNull(index, Types.OTHER);
        } else {
            WKBWriter writer = new WKBWriter();
            st.setBytes(index, writer.write(value));
        }
    }

    @Override
    public Point deepCopy(Point value) {
        return (Point) value.copy();
    }

    @Override
    public boolean isMutable() {
        return true;
    }

    @Override
    public Serializable disassemble(Point value) {
        return deepCopy(value);
    }

    @Override
    public Point assemble(Serializable cached, Object owner) {
        return deepCopy((Point) cached);
    }

    private byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
