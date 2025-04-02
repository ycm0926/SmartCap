package kr.kro.smartcap.smartcap_back.alarm.repository;

import kr.kro.smartcap.smartcap_back.alarm.entity.AlarmHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AlarmHistoryRepository extends JpaRepository<AlarmHistory, Long> {
    // 가장 최근 알람 조회 (필요시 사용)
    @Query(value = "SELECT * FROM alarm_history ORDER BY created_at DESC LIMIT ?1", nativeQuery = true)
    List<AlarmHistory> findRecentAlarms(int limit);
}