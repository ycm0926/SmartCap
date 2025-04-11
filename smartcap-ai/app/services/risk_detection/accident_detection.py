import cv2
import numpy as np
from collections import deque
from app.config import RiskSeverity
from app.core.angle_tracker import get_tracker

class AccidentDetector:
    def __init__(self):
        self.prev_frame = None # 이전 프레임
        self.prev_gray = None # 1차원 백터로 변환한 이전 프레임

        self.old_points = None  # 특징점 추적을 위한 이전 프레임의 특징점들
        
        self.flow_history = deque(maxlen=20)  # 20프레임 이력 저장
        
        # 기준 프레임 간격 (초당 7프레임)
        self.base_frame_interval_ms = 1000.0 / 7.0  # 약 142.85ms

        # 사고 감지 상태
        self.accident_detected = RiskSeverity.SAFE

        # 사고 감지 후 안전 상태로 돌아가기 위한 카운터
        self.safe_counter = 0
        self.safe_threshold = 15  # 15프레임 연속으로 안전하면 상태 초기화

        # 특징점 추적 매개변수
        self.feature_params = dict(
            maxCorners=300,
            qualityLevel=0.1,
            minDistance=7,
            blockSize=7
        )

        # 광학 흐름 매개변수
        self.lk_params = dict(
            winSize=(15, 15),
            maxLevel=2,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03)
        )

        # 사고 감지 임계값
        self.accident_threshold = {
            'motion_magnitude': 75.0   # 급격한 움직임 임계값
        }

        # 감지 결과 기록
        self.detection_results = []


    def detect_accident(self, frame, timestamp_ms=None):
        """
        프레임과 타임스탬프(ms)를 기반으로 사고를 감지합니다.
        
        Args:
            frame: 현재 비디오 프레임
            timestamp_ms: 현재 프레임의 타임스탬프 (밀리초)
            
        Returns:
            RiskSeverity: 사고 감지 상태 (SAFE, INCIDENT)
        """
        # 간격이 제공되지 않으면 기준 간격 사용
        if timestamp_ms is None or timestamp_ms <= 0:
            timestamp_ms = self.base_frame_interval_ms

        # 무색의 1차원 행렬 값으로 변경
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 첫 프레임 처리
        if self.prev_gray is None:
            self._initialize_first_frame(gray)
            return RiskSeverity.SAFE

        # 광학 흐름과 특징점 추적 처리
        motion_magnitude = self._process_optical_flow(gray)
        
        # 특징점 추적에 실패한 경우
        if motion_magnitude is None:
            return self.accident_detected
        
        # 움직임 크기를 정규화하고 이력에 저장
        normalized_magnitude = self._normalize_and_store_magnitude(motion_magnitude, timestamp_ms)
        
        # 프레임 업데이트
        self._update_frame_data(gray)
        
        # 사고 감지 상태 업데이트
        self._update_accident_status()
        
        return self.accident_detected
    

    def _initialize_first_frame(self, gray):
        """첫 번째 프레임 초기화"""
        self.prev_gray = gray
        self.old_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
    

    def _process_optical_flow(self, gray):
        """
        광학 흐름 처리 및 특징점 추적
        
        Returns:
            float or None: 평균 움직임 크기, 실패시 None
        """
        # 광학 흐름으로 특징점 추적
        new_points, status, error = cv2.calcOpticalFlowPyrLK(
            self.prev_gray, gray, self.old_points, None, **self.lk_params)
        
        # 유효한 점만 선택 (status가 1인 점들)
        old_valid = self.old_points[status == 1]
        new_valid = new_points[status == 1]
        
        # 추적에 성공한 점이 충분한지 확인
        if len(old_valid) < 10 or new_valid is None or len(new_valid) < 4:
            # 특징점 재추출 시도
            return self._retry_feature_tracking(gray, old_valid, new_valid)
        
        # 호모그래피 계산 및 움직임 벡터 분석
        return self._calculate_motion_magnitude(old_valid, new_valid)
    

    def _retry_feature_tracking(self, gray, old_valid, new_valid):
        """특징점 추적 실패 시 재시도"""
        # 이전 프레임에서 새로운 특징점 추출 시도
        self.old_points = cv2.goodFeaturesToTrack(self.prev_gray, mask=None, **self.feature_params)
        
        # 새로 추출한 특징점으로 다시 옵티컬 플로우 계산
        new_points, status, error = cv2.calcOpticalFlowPyrLK(
            self.prev_gray, gray, self.old_points, None, **self.lk_params)
        
        # 다시 유효한 점 선택
        old_valid = self.old_points[status == 1]
        new_valid = new_points[status == 1]
        
        # 재시도 후에도 충분한 점이 없으면 포기
        if len(old_valid) < 10 or new_valid is None or len(new_valid) < 4:
            self.prev_gray = gray
            self.old_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
            return None
        
        # 호모그래피 계산 및 움직임 벡터 분석
        return self._calculate_motion_magnitude(old_valid, new_valid)
    

    def _calculate_motion_magnitude(self, old_valid, new_valid):
        """
        호모그래피 계산 및 움직임 벡터 크기 계산
        
        Returns:
            float: 평균 움직임 크기
        """
        # RANSAC을 이용한 호모그래피 계산 및 이상치 제거
        H, mask = cv2.findHomography(
            old_valid, new_valid, 
            method=cv2.RANSAC,
            ransacReprojThreshold=20.0,
            maxIters=100,
            confidence=0.8
        )
        
        if H is not None:
            self._update_tracker_with_homography(H)
        
        # RANSAC 결과로 인라이어만 선택
        inliers_mask = mask.ravel() == 1

        # 인라이어 점이 충분한지 확인
        if np.sum(inliers_mask) < 10:
            # 인라이어가 너무 적으면 모든 점 사용
            old_inliers = old_valid
            new_inliers = new_valid
        else:
            # 인라이어 점만 사용
            old_inliers = old_valid[inliers_mask]
            new_inliers = new_valid[inliers_mask]
        
        # 움직임 벡터 계산
        motion_vectors = new_inliers - old_inliers

        # 움직임 벡터의 크기 계산
        magnitude = np.sqrt(motion_vectors[:, 0]**2 + motion_vectors[:, 1]**2)
        return np.mean(magnitude)


    def _update_tracker_with_homography(self, H, device_id=23):
        if H is not None:
            tracker = get_tracker(device_id)
            tracker.set_homography(H)
             

    def _normalize_and_store_magnitude(self, mean_magnitude, timestamp_ms):
        """
        움직임 크기를 정규화하고 이력에 저장
        
        Returns:
            float: 정규화된 움직임 크기
        """
        # 정규화된 움직임 계산
        normalized_magnitude = mean_magnitude * (self.base_frame_interval_ms / timestamp_ms)

        # 이력 저장
        self.flow_history.append({
            'magnitude': normalized_magnitude
        })
        
        return normalized_magnitude
    

    def _update_frame_data(self, gray):
        """다음 프레임 처리를 위한 데이터 업데이트"""
        self.prev_gray = gray
        self.old_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
    

    def _update_accident_status(self):
        """사고 감지 상태 업데이트"""
        # 사고 감지 로직 - 이전 5프레임의 평균 magnitude 계산
        if len(self.flow_history) >= 5:
            # 최근 5프레임의 magnitude 값 추출
            recent_magnitudes = [flow_data['magnitude'] for flow_data in list(self.flow_history)[-5:]]
            
            # 평균 magnitude 계산
            avg_magnitude = sum(recent_magnitudes) / len(recent_magnitudes)
            
            # 임계값과 비교하여 사고 여부 결정
            if avg_magnitude > self.accident_threshold['motion_magnitude']:
                # 사고 감지
                self.accident_detected = RiskSeverity.INCIDENT
                self.safe_counter = 0  # 안전 카운터 리셋
            elif self.accident_detected == RiskSeverity.INCIDENT:
                # 사고 상태에서 안전한 상태로 복귀하기 위한 카운터 증가
                self.safe_counter += 1
                
                # 안전 카운터가 임계값을 넘으면 안전 상태로 복귀
                if self.safe_counter >= self.safe_threshold:
                    self.accident_detected = RiskSeverity.SAFE
                    self.safe_counter = 0


class AccidentService:
    def __init__(self):
        # 서비스 초기화
        self.device_detectors = {}  # 디바이스 ID를 키로 사용
    
    def get_detector(self, device_id: str) -> AccidentDetector:
        """디바이스 ID에 해당하는 사고 감지기 반환 또는 새로 생성"""
        if device_id not in self.device_detectors:
            self.device_detectors[device_id] = AccidentDetector()
        return self.device_detectors[device_id]


# 싱글톤 인스턴스 생성
accident_service = AccidentService()
