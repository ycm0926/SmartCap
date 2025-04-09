package kr.kro.smartcap.smartcap_back.alarm.controller;

import kr.kro.smartcap.smartcap_back.accident.schedule.AccidentRedisScheduler;
import kr.kro.smartcap.smartcap_back.alarm.schedule.AlarmRedisScheduler;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test/scheduler")
@RequiredArgsConstructor
public class SchedulerTestController {

    private final AlarmRedisScheduler alarmRedisScheduler;
    private final AccidentRedisScheduler accidentRedisScheduler;

    private static final Logger logger = LoggerFactory.getLogger(SchedulerTestController.class);

    @PostMapping("/run")
    public String runBothSchedulers() {
        logger.info("👉 [테스트] 사고/알람 스케줄러 수동 실행 요청됨");

        alarmRedisScheduler.processAlarmDataFromRedis();
        accidentRedisScheduler.processAccidentDataFromRedis();

        return "사고 및 알람 스케줄러 수동 실행 완료!";
    }
}
