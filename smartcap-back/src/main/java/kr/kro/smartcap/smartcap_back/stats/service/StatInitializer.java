package kr.kro.smartcap.smartcap_back.stats.service;

import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import kr.kro.smartcap.smartcap_back.alarm.repository.AlarmHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class StatInitializer {

    private final AlarmHistoryRepository alarmHistoryRepository;
    private final AccidentHistoryRepository accidentHistoryRepository;
    private final RedisStatService redisStatService;

    public void initializeAllStats() {
        log.info("🚀 [초기 통계 생성] 시작");
        redisStatService.clearAllStats();

        LocalDate today = LocalDate.now();

        // ===============================
        // 1. 시간별: 최근 5일
        // ===============================
        LocalDateTime hourStart = today.minusDays(5).atStartOfDay();
        LocalDateTime hourEnd = LocalDateTime.now().truncatedTo(ChronoUnit.HOURS);

        log.info("🕐 시간별 통계: {} ~ {}", hourStart, hourEnd);

        while (hourStart.isBefore(hourEnd)) {
            LocalDateTime next = hourStart.plusHours(1);
            writeStats(hourStart, next);
            hourStart = next;
        }

        // ===============================
        // 2. 일별: 최근 5개월
        // ===============================
        LocalDate dayStart = today.minusMonths(5);
        LocalDate dayEnd = today;

        log.info("📅 일별 통계: {} ~ {}", dayStart, dayEnd);

        while (!dayStart.isAfter(dayEnd)) {
            LocalDateTime start = dayStart.atStartOfDay();
            LocalDateTime end = start.plusDays(1);
            writeStats(start, end);
            dayStart = dayStart.plusDays(1);
        }

        // ===============================
        // 3. 월별: 전체 범위
        // ===============================
        LocalDate earliest = getEarliestDate();
        LocalDate monthStart = LocalDate.of(earliest.getYear(), earliest.getMonth(), 1);
        LocalDate thisMonth = LocalDate.of(today.getYear(), today.getMonth(), 1);

        log.info("📆 월별 통계: {} ~ {}", monthStart, thisMonth);

        while (!monthStart.isAfter(thisMonth)) {
            LocalDateTime start = monthStart.atStartOfDay();
            LocalDateTime end = start.plusMonths(1);
            writeStats(start, end);
            monthStart = monthStart.plusMonths(1);
        }

        log.info("✅ [초기 통계 생성] 완료");
    }

    private void writeStats(LocalDateTime start, LocalDateTime end) {
        // 알람
        List<Object[]> alarmStats = alarmHistoryRepository.countAlarmsGroupedByType(start, end);
        for (Object[] row : alarmStats) {
            String recognizedType = (String) row[0];
            String alarmType = (String) row[1];
            Long count = (Long) row[2];

            redisStatService.setStats(start, recognizedType, alarmType, count);
        }

        // 사고 → alarmType = "3"으로 통일해서 알람처럼 처리
        List<Object[]> accidentStats = accidentHistoryRepository.countAccidentsGroupedByType(start, end);
        for (Object[] row : accidentStats) {
            String accidentType = (String) row[0];  // ex: "추락", "충돌"
            Long count = (Long) row[1];

            redisStatService.setStats(start, accidentType, "3", count);
        }
    }

    private LocalDate getEarliestDate() {
        LocalDate alarmMin = alarmHistoryRepository.findEarliestCreatedAt()
                .map(LocalDateTime::toLocalDate)
                .orElse(LocalDate.now());

        LocalDate accidentMin = accidentHistoryRepository.findEarliestCreatedAt()
                .map(LocalDateTime::toLocalDate)
                .orElse(LocalDate.now());

        return alarmMin.isBefore(accidentMin) ? alarmMin : accidentMin;
    }
}
