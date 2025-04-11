package kr.kro.smartcap.smartcap_back.alarm.repository;

import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AlarmHistoryRepository extends JpaRepository<AlarmHistory, Long> {
    // 가장 최근 알람 조회 (필요시 사용)
    @Query(value = "SELECT * FROM alarm_history ORDER BY created_at DESC LIMIT ?1", nativeQuery = true)
    List<AlarmHistory> findRecentAlarms(int limit);

    @Query("""
    SELECT ah.recognizedType, ah.alarmType, COUNT(ah)
    FROM AlarmHistory ah
    WHERE ah.createdAt BETWEEN :start AND :end
    GROUP BY ah.recognizedType, ah.alarmType
""")
    List<Object[]> countAlarmsGroupedByType(LocalDateTime start, LocalDateTime end);


    @Query("SELECT MIN(a.createdAt) FROM AlarmHistory a")
    Optional<LocalDateTime> findEarliestCreatedAt();

    @Query("""
    SELECT a FROM AlarmHistory a
    WHERE a.createdAt >= :sevenDaysAgo
""")
    List<AlarmHistory> findAllFromLast7Days(LocalDateTime sevenDaysAgo);
}