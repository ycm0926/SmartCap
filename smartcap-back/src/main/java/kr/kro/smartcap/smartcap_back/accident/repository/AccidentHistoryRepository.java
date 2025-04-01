package kr.kro.smartcap.smartcap_back.accident.repository;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccidentHistoryRepository extends JpaRepository<AccidentHistory, Long> {
}
