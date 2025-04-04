package kr.kro.smartcap.smartcap_back.accident.repository;

import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AccidentHistoryRepository extends JpaRepository<AccidentHistory, Long> {
    @Query("""
    SELECT ah.accidentType, COUNT(ah)
    FROM AccidentHistory ah
    WHERE ah.createdAt BETWEEN :start AND :end
    GROUP BY ah.accidentType
""")
    List<Object[]> countAccidentsGroupedByType(LocalDateTime start, LocalDateTime end);

    @Query("SELECT MIN(a.createdAt) FROM AccidentHistory a")
    Optional<LocalDateTime> findEarliestCreatedAt();
}
