from collections import deque
from typing import Dict, List, Any
from app.config import RiskSeverity

# 경고 레벨 임계값 설정
WARNING_THRESHOLD = 0.3    # 초기 크기가 증가하면 1차 경고 
DANGER_THRESHOLD = 0.6      # 초기 크기가 증가하면 2차 경고
MIN_DETECTION_CONFIDENCE = 0.5 # 차량 감지 신뢰도 임계값
USER_LOOKED_AWAY_FRAMES = 7      # 약 1초 (7fps 기준) 사용자가 잠시 시선을 돌렸다고 판단하는 프레임 수
TRACKER_MAX_AGE = 30             # 트래커 최대 수명 (프레임 단위)
MIN_VALID_FRAMES = 2           # 차량 높이 측정에 필요한 최소 유효 프레임 수

class VehicleTracker:
    """개별 차량 추적 및 위험도 판단 클래스"""
    
    def __init__(self, track_id, initial_height):
        self.track_id = track_id
        self.initial_height = max(initial_height, 1)  
        self.max_alert_level = RiskSeverity.SAFE  # 지금까지의 최대 경고 레벨
        self.consecutive_misses = 0  # 연속으로 감지되지 않은 프레임 수
        self.last_seen_frame = 0  # 마지막으로 감지된 프레임 번호
        self.valid_frames = 0  # 유효한 측정을 가진 프레임 수

        print(f"NEW TRACKER - Track ID {track_id}: Initial height {initial_height:.2f}px")

    def is_approaching(self, curr_height):
        """
        차량 접근 위험도 판단 - 초기 높이 대비 현재 높이 변화를 기준으로 판단
        현재 상태(SAFE/WARNING/DANGER)에 따라 다음 단계의 경고 발생 여부를 결정
        """
                
        # 초기 높이 대비 증가율 계산
        height_increase = (curr_height - self.initial_height) / self.initial_height
        
        # 현재 상태에 따른 위험도 판단
        if self.max_alert_level == RiskSeverity.SAFE:
            # 1차 경고 임계값 체크
            if height_increase > WARNING_THRESHOLD:
                self.max_alert_level = RiskSeverity.WARNING
                print(f"1차 알림: 초기 높이 대비 {height_increase:.2%} 증가")
                return RiskSeverity.WARNING
                
        elif self.max_alert_level == RiskSeverity.WARNING:
            # 2차 경고 임계값 체크
            # 초기 높이 대비 40% 이상 증가 시 DANGER로 전환
            if height_increase > DANGER_THRESHOLD:
                self.max_alert_level = RiskSeverity.DANGER
                print(f"2차 알림: 초기 높이 대비 {height_increase:.2%} 증가 ")
                return RiskSeverity.DANGER
                
        # 현재 상태 유지
        return self.max_alert_level
    
    def update(self, frame_count, height):
        """차량 정보 업데이트 및 위험도 계산"""
        # 감지 기록 업데이트
        self.last_seen_frame = frame_count
        self.consecutive_misses = 0  # 감지되었으므로 미감지 카운터 초기화

        # 유효한 높이 값 확인
        if height <= 0:
            return self.max_alert_level  # 현재 상태 유지

        # 유효한 프레임 카운트 증가
        self.valid_frames += 1

        if self.valid_frames >= MIN_VALID_FRAMES:
            # 위험도 판단
            current_risk = self.is_approaching(height)
            
            # 최대 알림 레벨 업데이트
            if current_risk > self.max_alert_level:
                self.max_alert_level = current_risk
        else:
            current_risk = self.max_alert_level
            
        return current_risk

    def mark_missing(self):
        """프레임에서 감지되지 않은 경우"""
        # 연속 미감지 카운터 증가
        self.consecutive_misses += 1
        
        # 일정 이상 연속 감지 실패 시 사용자가 뒤돌아본 것으로 판단
        if self.consecutive_misses == USER_LOOKED_AWAY_FRAMES:
            # 상태 초기화 (방향 전환 감지)
            self.max_alert_level = RiskSeverity.SAFE  # 경고 레벨 초기화

# 차량 추적기 인스턴스 저장
vehicle_trackers = {}  # track_id: VehicleTracker 인스턴스

def detect_vehicle_risks(tracked_vehicles: List[Dict[str, Any]], frame_count: int) -> int:
    """
    차량의 접근 위험을 감지합니다.
    바운딩 박스 높이 변화를 추적하여 카메라 방향으로 접근하는 차량을 감지합니다.
    
    Parameters:
        tracked_vehicles: 추적된 차량 객체 리스트
        frame_count: 현재 프레임 번호

    Returns:
        risk_level: 위험 감지 결과 알림 레벨 (RiskSeverity.SAFE, RiskSeverity.WARNING, RiskSeverity.DANGER)
    """
    risk_level = RiskSeverity.SAFE
    current_track_ids = set()  # 프레임에서 감지된 객체들의 ID 집합
    
    # 현재 프레임의 모든 차량에 대해 처리
    for vehicle in tracked_vehicles:
        track_id = vehicle['track_id']
        current_track_ids.add(track_id)
        
        # 신뢰도가 낮은 경우 건너뜀
        if vehicle.get('score', 0) < MIN_DETECTION_CONFIDENCE:
            continue

        # 높이 추출
        height = None
        if 'tlbr' in vehicle:
            height = vehicle['tlbr'][3] - vehicle['tlbr'][1]  # y2 - y1
        elif 'bbox' in vehicle:
            height = vehicle['bbox'][3] - vehicle['bbox'][1]  # y2 - y1
        else:
            continue  # 높이 정보가 없으면 건너뜀
        
        # 트래커 초기화 또는 업데이트
        if track_id not in vehicle_trackers:
            # 새 트래커 생성
            vehicle_trackers[track_id] = VehicleTracker(track_id, height)
            current_risk = RiskSeverity.SAFE
        else:
            # 기존 트래커 업데이트
            tracker = vehicle_trackers[track_id]
            current_risk = tracker.update(frame_count, height)
        
        # 가장 높은 위험 레벨 저장
        risk_level = max(risk_level, current_risk)

    # 현재 프레임에 없는 객체는 missing으로 표시
    for track_id, tracker in vehicle_trackers.items():
        if track_id not in current_track_ids:
            tracker.mark_missing()
    
    # 오래된 트래커 제거
    clean_old_trackers(frame_count)
    
    return risk_level  # 최종 위험 레벨 반환

def clean_old_trackers(current_frame):
    """오래된 트래커 제거"""
    track_ids_to_remove = []
    
    for track_id, tracker in vehicle_trackers.items():
        # 일정 프레임 이상 감지되지 않은 트래커 제거
        if current_frame - tracker.last_seen_frame > TRACKER_MAX_AGE:
            track_ids_to_remove.append(track_id)
    
    for track_id in track_ids_to_remove:
        del vehicle_trackers[track_id]

def reset_trackers():
    """모든 트래커 초기화 (시스템 재시작 등에 사용)"""
    vehicle_trackers.clear()