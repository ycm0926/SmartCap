package kr.kro.smartcap.smartcap_back.accident.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.locationtech.jts.geom.Point;
import java.sql.Timestamp;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "accident_history")
public class AccidentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "accident_id")
    private Long accidentId;

    @Column(name = "construction_sites_id", nullable = false)
    private Long constructionSitesId;

    @Convert(converter = GeometryConverter.class)
    @Column(name = "gps", columnDefinition = "geometry(Point,4326)")
    private Point gps;

    @Column(name = "weather")
    private String weather;

    @Column(name = "accident_type")
    private String accidentType;

    @Column(name = "created_at", nullable = false)
    private Timestamp createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) {
            createdAt = Timestamp.from(Instant.now());
        }
    }
}
