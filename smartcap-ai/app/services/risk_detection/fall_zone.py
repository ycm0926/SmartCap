import numpy as np
from app.config import RiskSeverity
import math

# 계단 위험 감지 설정
FIRST_ALERT_SCORE_THRESHOLD = 2  # 1차 알림 프레임 임계값: 하행 계단은 가파르기 때문에 인지 후, 점수가 2점 이상인 경우 알림
BOTTOM_POINT_DISAPPEAR_THRESHOLD = 0.99  # 밑면 꼭짓점 소실 임계값 (화면 높이 대비)
MAX_MISSING_FRAMES = 14  # 연속으로 미탐지 시 초기화할 프레임 수
BOTTOM_POINT_DISTANCE = 15 # 밑면 꼭짓점 이동 거리 임계값 (픽셀)
IMG_HEIGHT = 640 # 이미지 높이
# 계단 물리적 특성
STAIR_ANGLE_DEG = 35  # 계단 최대 경사각 -> 단높이 18cm / 단너비 26cm (35도)
# 직각삼각형 성질 이용 -> 35도 각도, 높이 3m = 빗변 5.23m
# 픽셀과 어안렌즈 보정 값 계산 = 287px
STAIR_LANDING_HEIGHT = 287  # 계단참 설치 높이 (px)


class FallZoneTracker:
    """
    계단 영역 추적 및 위험 감지 클래스
    
    계단의 방향(상행/하행)을 감지하고, 하행 계단에서 사용자의 위험 상태를 추적
    소실점과 사다리꼴 꼭짓점 분석을 통해 위험 단계를 Safe -> Warning -> Danger로 업데이트
    """
    def __init__(self, tracker_id):
        # 트래커 식별 및 상태 관련 변수
        self.tracker_id = tracker_id
        self.status = RiskSeverity.SAFE
        
        # 방향 탐지 관련 변수
        self.is_descending = None  # True: 하행, False: 상행, None: 미정
        self.descending_score = 0  # 양수: 하행, 음수: 상행
        
        # 프레임 카운트 관련 변수
        self.missing_frame_count = 0
        self.last_seen_frame = 0
        
        # 위험 감지 정보
        self.first_alert_bottom_points = None  # 1차 알림 시점의 밑면 꼭짓점 위치
        self.last_bottom_points = None  # 1차 알림까지의 밑면 꼭짓점 히스토리
        
        
    def update_direct(self, trapezoid_pts, frame_count):
        """
        사다리꼴 정보로부터 계단 방향 업데이트
        
        Parameters:
            trapezoid_pts: 사다리꼴의 4개 꼭지점 좌표
            frame_count: 현재 프레임 번호
        """
        # 미탐지 카운트 초기화 및 마지막 탐지 프레임 업데이트
        self.missing_frame_count = 0
        self.last_seen_frame = frame_count
        
        # 소실점 계산
        vanishing_point = calculate_vanishing_point_from_trapezoid(trapezoid_pts)
        if vanishing_point is None:  # 소실점이 존재하지 않으면 update 종료
            return
           
        # 계단 최대 경사각(35도) 기준 설정
        theta_rad = math.radians(STAIR_ANGLE_DEG)

        # 밑변 두 점
        bottom_left = trapezoid_pts[3]
        bottom_right = trapezoid_pts[2]

        # 밑변 중심 좌표
        cx = (bottom_left[0] + bottom_right[0]) / 2
        cy = (bottom_left[1] + bottom_right[1]) / 2
        
        # 계단참 높이 기준으로 기준선 계산 (3m마다 계단참 설치)
        length = STAIR_LANDING_HEIGHT
        
        # 경사각에 따른 기준선 끝점 계산
        dy = length * math.sin(theta_rad)
        
        # 기준선 끝점 (상향 방향)
        reference_y = int(IMG_HEIGHT/2 - (IMG_HEIGHT- cy) - dy)        
        
        # 소실점
        vp_y = vanishing_point[1]
        
        # 소실점과 기준점 비교로 계단 방향 결정
        if reference_y < vp_y:
            # 소실점이 기준점보다 아래에 있음 -> 하행 계단
            self.descending_score += 1
        else:
            # 소실점이 기준점보다 위에 있음 -> 상행 계단
            self.descending_score -= 1
            
        # 방향 결정 (양수: 하행, 음수: 상행)
        if self.descending_score > 0:
            self.is_descending = True
        elif self.descending_score < 0:
            self.is_descending = False
        
        # 하행 계단이고 아직 1차 알림이 아닌 경우, 밑면 꼭짓점 히스토리에 추가
        if self.is_descending is True and self.status == RiskSeverity.SAFE and trapezoid_pts[2] is not None and trapezoid_pts[3] is not None:
            self.last_bottom_points = (trapezoid_pts[2].copy(), trapezoid_pts[3].copy())  # bottom_right, bottom_left
            
            
    def update_risk_status(self, trapezoid_pts):
        """
        현재 상태에 따라 계단 위험 상태 업데이트 (1차/2차 알림 처리)
        
        Parameters:
            trapezoid_pts: 사다리꼴의 4개 꼭지점 좌표
        """
        # 상행 계단이면 안전 상태 유지
        if self.is_descending is False:
            self.status = RiskSeverity.SAFE
            return
            
        # 하행 계단인 경우 처리
        if self.is_descending is True:
            # 1차 알림: 하행 계단으로 FIRST_ALERT_SCORE_THRESHOLD점 이상 인식된 경우
            if self.status == RiskSeverity.SAFE and self.descending_score >= FIRST_ALERT_SCORE_THRESHOLD:
                self.status = RiskSeverity.WARNING

                # 1차 알림 시점의 밑면 꼭짓점 위치 저장
                if trapezoid_pts is not None:
                    self.first_alert_bottom_points = (trapezoid_pts[2].copy(), trapezoid_pts[3].copy())
                else:
                    # 현재 사다리꼴이 없는 경우 마지막으로 저장된 꼭짓점 사용
                    self.first_alert_bottom_points = self.last_bottom_points
                return
                           
            # 1차 알림 이후 위험 상태 업데이트
            elif self.status == RiskSeverity.WARNING and self.first_alert_bottom_points is not None:
                # 현재 밑면 꼭짓점
                current_bottom_right = trapezoid_pts[2]
                current_bottom_left = trapezoid_pts[3]
                
                # 1차 알림 시점의 밑면 꼭짓점
                first_bottom_right, first_bottom_left = self.first_alert_bottom_points
                
                # 화면 높이 기준 임계값
                threshold_y = int(IMG_HEIGHT * BOTTOM_POINT_DISAPPEAR_THRESHOLD)
                
                # 2차 알림(위험) 조건: 
                # 1) 밑면 꼭짓점이 화면 아래쪽 임계값을 넘어가거나
                # 2) 1차 알림 때보다 밑면 꼭짓점이 일정 거리 이상 위로 이동
                if (current_bottom_left[1] >= threshold_y or current_bottom_right[1] >= threshold_y or
                    first_bottom_left[1] - current_bottom_left[1] >= BOTTOM_POINT_DISTANCE or
                    first_bottom_right[1] - current_bottom_right[1] >= BOTTOM_POINT_DISTANCE):
                    self.status = RiskSeverity.DANGER
    
    
    def handle_missing_detection(self):
        """
        탐지 실패 시 연속으로 일정 프레임 이상 미탐지되면 초기화
        """
        self.missing_frame_count += 1
        
        # 연속으로 MAX_MISSING_FRAMES 이상 미탐지되면 초기화
        if self.missing_frame_count >= MAX_MISSING_FRAMES:
            self.is_descending = None
            self.descending_score = 0
            self.status = RiskSeverity.SAFE
            self.missing_frame_count = 0
        
        
def extract_trapezoid_from_mask(mask):
    """
    세그멘테이션 마스크에서 직접 사다리꼴 꼭지점을 추출
    빗변이 90도 이상인 경우 None 반환
    
    Parameters:
        mask: 2차원 배열, 계단 영역이 표시된 이진 마스크
    
    Returns:
        numpy.ndarray: 사다리꼴의 4개 꼭지점 좌표 [top_left, top_right, bottom_right, bottom_left]
                       또는 유효한 마스크가 없거나 빗변이 90도 이상인 경우 None
    """
    
    # 마스크에 픽셀이 없으면 처리 불가
    if np.sum(mask) == 0:
        return None
    
    # 마스크에서 픽셀 좌표 추출
    y_indices, x_indices = np.where(mask > 0)
    
    # 마스크의 바운딩 박스 찾기
    min_x, min_y = np.min(x_indices), np.min(y_indices)
    max_x, max_y = np.max(x_indices), np.max(y_indices)
    
    # 각 사분면에서 점 추출을 위한 중심점 계산
    center_x, center_y = (min_x + max_x) // 2, (min_y + max_y) // 2
    
    # 마스크 픽셀 좌표들을 사분면으로 분류
    quadrant1 = [(x, y) for x, y in zip(x_indices, y_indices) if x >= center_x and y <= center_y]
    quadrant2 = [(x, y) for x, y in zip(x_indices, y_indices) if x < center_x and y <= center_y]
    quadrant3 = [(x, y) for x, y in zip(x_indices, y_indices) if x < center_x and y > center_y]
    quadrant4 = [(x, y) for x, y in zip(x_indices, y_indices) if x >= center_x and y > center_y]
    
    # 각 사분면에서 극단값을 가진 점 찾기
    top_left = min(quadrant2, key=lambda p: p[0] + p[1]) if quadrant2 else (min_x, min_y)
    top_right = min(quadrant1, key=lambda p: -p[0] + p[1]) if quadrant1 else (max_x, min_y)
    bottom_left = min(quadrant3, key=lambda p: p[0] - p[1]) if quadrant3 else (min_x, max_y)
    bottom_right = max(quadrant4, key=lambda p: p[0] + p[1]) if quadrant4 else (max_x, max_y)

    # 빗변의 각도 계산
    # 왼쪽 빗변 (top_left -> bottom_left)
    dx_left = bottom_left[0] - top_left[0]
    dy_left = bottom_left[1] - top_left[1]
    left_angle_rad = np.arctan2(dy_left, dx_left)
    left_angle_deg = np.degrees(left_angle_rad)

    # 오른쪽 빗변 (top_right -> bottom_right)
    dx_right = bottom_right[0] - top_right[0]
    dy_right = bottom_right[1] - top_right[1]
    right_angle_rad = np.arctan2(dy_right, dx_right)
    right_angle_deg = np.degrees(right_angle_rad)

    # 계단 사다리꼴의 유효성 검사
    # 왼쪽 빗변: 우상향(0도에서 90도 사이)
    # 오른쪽 빗변: 좌상향(90도와 180도 사이 또는 -180도와 -90도 사이)
    right_valid = 0 <= right_angle_deg <= 90
    left_valid = (90 <= left_angle_deg <= 180) or (-180 <= left_angle_deg <= -90)

    if not (left_valid and right_valid):
        return None

    # 초기 사다리꼴 꼭지점
    trapezoid_pts = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.int32)

    return trapezoid_pts


def calculate_vanishing_point_from_trapezoid(trapezoid_pts):
    """
    사다리꼴 측면을 연장하여 소실점을 계산
    
    Parameters:
        trapezoid_pts: 사다리꼴의 4개 꼭지점 좌표 [top_left, top_right, bottom_right, bottom_left]
    
    Returns:
        tuple: 소실점 좌표 (x, y) 또는 계산 실패 시 None
    """
    try:
        # 사다리꼴 점이 4개가 아니면 처리 불가
        if len(trapezoid_pts) != 4:
            return None
             
        # 사다리꼴 각 꼭지점 추출
        top_left, top_right, bottom_right, bottom_left = trapezoid_pts
        
        # 좌측 선분의 기울기 (y = mx + b)
        if top_left[0] != bottom_left[0]:  # x 좌표가 다른 경우
            m_left = (bottom_left[1] - top_left[1]) / (bottom_left[0] - top_left[0])
            b_left = top_left[1] - m_left * top_left[0]
        else:  # 수직선인 경우
            m_left = float('inf')
            b_left = None
            
        # 우측 선분의 기울기 (y = mx + b)
        if top_right[0] != bottom_right[0]:  # x 좌표가 다른 경우
            m_right = (bottom_right[1] - top_right[1]) / (bottom_right[0] - top_right[0])
            b_right = top_right[1] - m_right * top_right[0]
        else:  # 수직선인 경우
            m_right = float('inf')
            b_right = None
            
        # 두 선이 평행한 경우
        if m_left == m_right:
            return None
        
        # 소실점 x, y 좌표 초기화
        x, y = 0, 0
        
        # 두 선 중 하나가 수직선인 경우
        if m_left == float('inf'):
            x = top_left[0]
            y = m_right * x + b_right
        elif m_right == float('inf'):
            x = top_right[0]
            y = m_left * x + b_left
        else:
            # 교차점 계산 (연립방정식 y = m_left * x + b_left, y = m_right * x + b_right)
            x = (b_right - b_left) / (m_left - m_right)
            y = m_left * x + b_left
            
        # 소실점 좌표 반환 (이미지 내부로 제한하지 않음)
        return (int(x), int(y))
            
    except Exception as e:
        print(f"소실점 계산 오류: {e}")
        return None


# 전역 트래커 딕셔너리
fall_zone_trackers = {}


def detect_fall_zone_risks(tracked_stairs, frame_count):
    """
    계단 영역의 위험도를 감지
    
    Parameters:
        tracked_stairs: 추적된 계단 객체 리스트
        frame_count: 현재 프레임 번호
        
    Returns:
        RiskSeverity: 현재 계단 위험 수준
    """
    risk_level = RiskSeverity.SAFE
    current_track_ids = set()

    
    # 각 계단 객체에 대해 처리
    for tracked_stair in tracked_stairs:
        track_id = tracked_stair['track_id']
        mask = tracked_stair['mask']
        
        current_track_ids.add(track_id)
        
        # 마스크에서 사다리꼴 추출
        trapezoid_pts = extract_trapezoid_from_mask(mask)
        if trapezoid_pts is None:
            continue
        
        # 트래커 업데이트 or 초기화
        if track_id not in fall_zone_trackers:
            fall_zone_trackers[track_id] = FallZoneTracker(track_id)
        
        tracker = fall_zone_trackers[track_id]
        
        # 사다리꼴 정보로 방향 업데이트
        tracker.update_direct(trapezoid_pts, frame_count)
        
        # 위험 상태 업데이트
        tracker.update_risk_status(trapezoid_pts)
        
        # 최고 위험 레벨 갱신
        risk_level = max(risk_level, tracker.status)
    
    # 현재 프레임에 없는 객체 처리 및 최고 위험 레벨 유지
    for track_id, tracker in fall_zone_trackers.items():
        if track_id not in current_track_ids:
            tracker.handle_missing_detection()
        
        # 최고 위험 레벨 갱신 유지
        risk_level = max(risk_level, tracker.status)
        
    # 오래된 트래커 제거
    clean_old_trackers(frame_count)
    
    return risk_level


def clean_old_trackers(current_frame_count, max_age = 70):
    """
    오랫동안 감지되지 않은 계단 위험 트래커를 제거
    지정된 max_age 이상 프레임 동안 업데이트되지 않은 트래커를 메모리에서 제거
    
    Parameters:
        current_frame_count (int): 현재 프레임 번호
        max_age (int, optional): 트래커가 유지될 수 있는 최대 프레임 간격. 기본값은 70
    """
    
    old_trackers = []
    
    for track_id, tracker in fall_zone_trackers.items():
        if current_frame_count - tracker.last_seen_frame >= max_age:
            old_trackers.append(track_id)
            
    for track_id in old_trackers:
        del fall_zone_trackers[track_id]


def reset_trackers():
    """모든 트래커 초기화 (시스템 재시작 등에 사용)"""
    fall_zone_trackers.clear()