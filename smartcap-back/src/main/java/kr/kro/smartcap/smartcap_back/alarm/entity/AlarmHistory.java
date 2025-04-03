package kr.kro.smartcap.smartcap_back.alarm.entity;

import jakarta.persistence.*;
import kr.kro.smartcap.smartcap_back.accident.entity.GeometryConverter;
import lombok.Getter;
import lombok.Setter;
import org.locationtech.jts.geom.Point;
import java.sql.Timestamp;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "alarm_history")
public class AlarmHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alarm_id")
    private Long alarmId;

    @Column(name = "construction_sites_id", nullable = false)
    private Long constructionSitesId;

    @Convert(converter = GeometryConverter.class)
    @Column(name = "gps", columnDefinition = "geometry(Point,4326)")
    private Point gps;

    @Column(name = "alarm_type", nullable = false, length = 20)
    private String alarmType;

    @Column(name = "recognized_type", nullable = false, length = 20)
    private String recognizedType;

    @Column(name = "weather", length = 50)
    private String weather;

    @Column(name = "created_at", nullable = false)
    private Timestamp createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) {
            createdAt = Timestamp.from(Instant.now());
        }
    }
}