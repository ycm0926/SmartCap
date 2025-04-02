package kr.kro.smartcap.smartcap_back.accident.service;

import kr.kro.smartcap.smartcap_back.accident.dto.AccidentHistoryDto;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentHistory;
import kr.kro.smartcap.smartcap_back.accident.entity.AccidentVideo;
import kr.kro.smartcap.smartcap_back.accident.repository.AccidentHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AccidentProcessingService {

    private final AccidentHistoryRepository accidentHistoryRepository;
    private final AccidentVideoService accidentVideoService;

    private static final Logger logger = LoggerFactory.getLogger(AccidentProcessingService.class);

    @Transactional
    public void processAccident(int deviceId, AccidentHistoryDto dto) {
        // 1. 사고 기록 저장 (AccidentHistory는 항상 저장됨)
        AccidentHistory accidentHistory = new AccidentHistory();
        accidentHistory.setConstructionSitesId(dto.getConstructionSitesId());
        accidentHistory.setAccidentType(dto.getAccidentType());
        accidentHistory.setCreatedAt(Timestamp.from(Instant.now()));
        AccidentHistory savedHistory = accidentHistoryRepository.save(accidentHistory);
        logger.info("AccidentHistory saved: accidentId={}, constructionSitesId={}",
                savedHistory.getAccidentId(), savedHistory.getConstructionSitesId());

        // 2. Redis에 이미지가 있다면 사고 영상 생성 및 저장
        AccidentVideo accidentVideo = accidentVideoService.createAccidentVideo(deviceId, savedHistory.getAccidentId());
        if (accidentVideo != null) {
            logger.info("AccidentVideo saved in DB: accidentVideoId={}, videoUrl={}",
                    accidentVideo.getAccidentVideoId(), accidentVideo.getVideoUrl());
        }
    }
}
