from collections import deque
from typing import Dict, List, Tuple, Any
from app.config import RiskSeverity

# 자재 위험 감지 설정
HISTORY_SIZE = 30  # 추적할 최대 프레임 수
MIN_FRAMES_FOR_DETECTION = 5  # 접근 감지를 위한 최소 프레임 수
FIRST_ALERT_THRESHOLD = 1.1  # 1차 알림 임계값: 10% 이상 크기 증가
SECOND_ALERT_THRESHOLD = 1.35  # 2차 알림 임계값: 35% 이상 크기 증가
MIN_DETECTION_CONFIDENCE = 0.7  # 자재 크기를 신뢰할 최소 신뢰도 점수
CONSECUTIVE_FRAMES_REQUIRED = 3  # 위험 상태 변경을 위한 연속 프레임 수


# 각 자재별 추적 데이터
class MaterialTracker:
    def __init__(self, track_id):
        self.track_id = track_id # 객체의 추적 ID
        self.size_history = deque(maxlen=HISTORY_SIZE) # 프레임별 객체 크기(작은 변) 기록 리스트 - (frame_count, shorter_side) 형태
        self.detection_history = deque(maxlen=HISTORY_SIZE) # 프레임별 객체 감지 여부 리스트 - (frame_count, is_detected) 형태
        self.last_seen_frame = 0 # 마지막으로 객체가 감지된 프레임 번호
        self.status = RiskSeverity.SAFE # 현재 알림 상태 (SAFE, WARNING, DANGER)

        self.initial_reference_size = None # 사분위수 범위로 이상치를 제거한 초기 객체의 크기
        self.first_alert_reference_size = None  # 1차 알림 시 기준 크기

        self.warning_frame_count = 0  # 1차 알림 임계값을 초과한 연속된 프레임 수
        self.danger_frame_count = 0   # 2차 알림 임계값을 초과한 연속된 프레임 수
        self.consecutive_misses = 0  # 연속으로 감지되지 않은 프레임 수 (RiskSeverity 초기화)
        

    def update(self, frame_count, shorter_side):
        """새 프레임 데이터로 업데이트"""
        self.last_seen_frame = frame_count

        # 객체가 감지되었으므로 연속 미감지 카운터 초기화
        self.consecutive_misses = 0

        # 크기 기록 저장 (필터링 없이 원본 값 저장)
        self.size_history.append((frame_count, shorter_side))
        self.detection_history.append((frame_count, True))

        # 안정화 기간 처리
        if len(self.size_history) <= MIN_FRAMES_FOR_DETECTION:
            # 안정화 기간 중이면 필터링된 값 계산만 하고 위험 감지는 하지 않음
            if len(self.size_history) == MIN_FRAMES_FOR_DETECTION:
                # 안정화 기간이 끝나면 초기 기준 크기 설정
                self._establish_baseline_size()
            return self.status
        
        # 위험 상태 확인
        return self._check_risk_status()
    

    def _establish_baseline_size(self):
        """안정화 기간이 끝난 후 기준 크기 설정"""
        # 안정화 기간 동안의 값들 수집
        values = [size for _, size in self.size_history]
        
        # 이상치 제거 (사분위수 범위 방법 사용)
        values.sort()
        q1 = values[len(values) // 4]
        q3 = values[3 * len(values) // 4]
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        filtered_values = [v for v in values if lower_bound <= v <= upper_bound]
        
        if filtered_values:
            # 이상치 제거 후 중앙값 사용
            baseline_size = filtered_values[len(filtered_values) // 2]
        else:
            # 이상치 제거 후 데이터가 없으면 원본 중앙값 사용
            baseline_size = values[len(values) // 2]
        
        # 위험 감지 시작을 위한 초기 크기 설정
        self.initial_reference_size = baseline_size


    def mark_missing(self, frame_count):
        """프레임에서 감지되지 않은 경우"""
        self.detection_history.append((frame_count, False))
        
        # 연속 미감지 카운터 증가
        self.consecutive_misses += 1
        
        # 일정 이상 연속 감지 실패 시 추적 초기화 (사용자가 뒤돌아본 상태)
        if self.consecutive_misses >= 10:  # 약 1-2초 (초당 6-8프레임 기준)
            self.status = RiskSeverity.SAFE
            self.first_alert_reference_size = None
            
        return None
    

    def _check_risk_status(self):
        """위험 상태 확인하고 위험 감지 정보 반환"""
            
        # 최소 필요 프레임 수 이상의 데이터가 있고 초기 기준 크기가 설정되었을 때만 위험 계산
        if len(self.size_history) >= MIN_FRAMES_FOR_DETECTION and self.initial_reference_size:
            # 현재 최신 크기 가져오기
            latest_size = self.size_history[-1][1]
            
            # 초기 기준 크기 대비 현재 크기의 비율 계산
            current_approach_ratio = latest_size / self.initial_reference_size
            
            # 현재 상태에 따른 위험 판단
            if self.status == RiskSeverity.SAFE:
                # 1차 알림 임계값 확인
                if current_approach_ratio >= FIRST_ALERT_THRESHOLD:
                    # 연속 프레임 카운터 증가
                    self.warning_frame_count += 1

                    # 연속 3프레임 이상 임계값 초과 시 상태 변경
                    if self.warning_frame_count >= CONSECUTIVE_FRAMES_REQUIRED:
                        self.status = RiskSeverity.WARNING
                        self.first_alert_reference_size = latest_size  # 1차 알림 시점의 크기 저장
                        # 카운터 초기화
                        self.warning_frame_count = 0
                        return RiskSeverity.WARNING
                else:
                    # 임계값 미만이면 연속 카운터 초기화
                    self.warning_frame_count = 0
                    
            elif self.status == RiskSeverity.WARNING:
                # 1차 알림 상태일 때 2차 알림 임계값 확인
                if self.first_alert_reference_size:
                    second_alert_ratio = latest_size / self.first_alert_reference_size
                    
                    # 1차 알림 발송 이후 추가로 25% 이상 더 접근 or 초기 대비 총 35% 이상 접근한 경우 2차 알림
                    if second_alert_ratio >= 1.25 or current_approach_ratio >= SECOND_ALERT_THRESHOLD:
                        # 연속 프레임 카운터 증가
                        self.danger_frame_count += 1
                        
                        # 연속 3프레임 이상 임계값 초과 시 상태 변경
                        if self.danger_frame_count >= CONSECUTIVE_FRAMES_REQUIRED:
                            self.status = RiskSeverity.DANGER
                            # 카운터 초기화
                            self.danger_frame_count = 0
                            return RiskSeverity.DANGER
                    else:
                        # 임계값 미만이면 연속 카운터 초기화
                        self.danger_frame_count = 0
                else:
                    # 1차 알림 기준 크기가 없는 경우(비정상 상황)
                    self.danger_frame_count = 0
        
        return self.status


# 전체 트래커 관리
material_trackers = {}  # track_id: MaterialTracker


def get_rotated_rect_sides(rotated_box) -> Tuple[float, float]:
    """
    회전된 사각형의 짧은 변과 긴 변의 길이를 반환합니다.
    
    Parameters:
        rotated_box: OpenCV의 cv2.minAreaRect() 반환값
        형태: ((cx, cy), (width, height), angle)
        
    Returns:
        (shorter_side, longer_side): 짧은 변과 긴 변의 길이
    """

    # 너비와 높이 추출 (minAreaRect 반환값 기준)
    width, height = rotated_box[1]

    shorter_side = min(width, height)
    longer_side = max(width, height)
    return shorter_side, longer_side


def get_highest_risk_level(material_trackers):
    if not material_trackers:  # 딕셔너리가 비어있는 경우
        return RiskSeverity.SAFE  # 기본값 0 (SAFE) 반환
    
    # 모든 MaterialTracker 객체의 status 값 중에서 최댓값 찾기
    highest_risk = max(tracker.status for tracker in material_trackers.values())
    return highest_risk


def detect_material_risks(tracked_materials: List[Dict[str, Any]], frame_count: int) -> int:
    """
    건설 자재의 접근 위험을 감지합니다.
    작은 변의 길이 변화를 추적하여 카메라 방향으로 접근하는 자재를 감지합니다.
    
    Parameters:
        tracked_materials: ByteTrack으로 추적된 자재 객체 리스트
        frame_count: 현재 프레임 번호
        
    Returns:
        risk_level: 위험 감지 결과 알림 레벨
    """
    risk_level = get_highest_risk_level(material_trackers)
    current_track_ids = set()
    shorter_side = 0
    
    # 현재 프레임의 모든 자재에 대해 처리
    for material in tracked_materials:
        track_id = material['track_id']
        current_track_ids.add(track_id)
        
        # 신뢰도가 낮거나 rotated_box가 없는 경우 크기 업데이트를 건너뜀
        if material['score'] < MIN_DETECTION_CONFIDENCE or 'rotated_box' not in material:
            continue
        
        rotated_box = material['rotated_box']
        shorter_side, longer_side = get_rotated_rect_sides(rotated_box)
        
        # 트래커 업데이트 or 초기화
        if track_id not in material_trackers:
            material_trackers[track_id] = MaterialTracker(track_id)
        
        tracker = material_trackers[track_id]
        risk_level = max(risk_level, tracker.update(frame_count, shorter_side))
    
    # 현재 프레임에 없는 객체는 missing으로 표시
    for track_id, tracker in material_trackers.items():
        if track_id not in current_track_ids:
            tracker.mark_missing(frame_count)
    
    # 오래된 트래커 제거 (일정 시간 이상 감지되지 않은 경우)
    clean_old_trackers(frame_count)
    
    return risk_level


def clean_old_trackers(current_frame, max_age=60):
    """오래된 트래커 제거"""
    track_ids_to_remove = []
    
    for track_id, tracker in material_trackers.items():
        # 일정 프레임 이상 감지되지 않은 트래커 제거
        if current_frame - tracker.last_seen_frame > max_age:
            track_ids_to_remove.append(track_id)
    
    for track_id in track_ids_to_remove:
        del material_trackers[track_id]


def reset_trackers():
    """모든 트래커 초기화 (시스템 재시작 등에 사용)"""
    material_trackers.clear()
