package kr.kro.smartcap.smartcap_back.accident.repository;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccidentVideoRepository extends JpaRepository<AccidentVideo, Long> {
    Optional<AccidentVideo> findByAccidentId(Long accidentId);

}
