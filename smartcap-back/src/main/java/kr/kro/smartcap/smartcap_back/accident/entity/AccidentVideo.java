package kr.kro.smartcap.smartcap_back.accident.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "accident_videos")
public class AccidentVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "accident_video_id")
    private Long accidentVideoId; // PK

    @Column(name = "accident_id", nullable = false)
    private Long accidentId;      // 사고기록 테이블의 PK 참조 (JOIN 사용 가능)

    @Column(name = "video_url", length = 255, nullable = false)
    private String videoUrl;      // S3 업로드 후의 영상 경로
}
