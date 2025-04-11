import cv2
import numpy as np

# 카메라 캘리브레이션 파라미터 설정
# sensor_width_mm = 3.6     # 센서 너비
# sensor_height_mm = 2.7    # 센서 높이
# image_width_px = 640      # 사용 중인 해상도
# image_height_px = 480
# EFL_mm = 1.7              # 초점 거리

# 카메라 내부 파라미터 행렬 (Camera Intrinsic Matrix)
# fx = (EFL_mm * image_width_px) / sensor_width_mm  = 302.22
# fy = (EFL_mm * image_height_px) / sensor_height_mm = 302.22
# cx = image_width_px / 2 = 320
# cy = image_height_px / 2 = 240

K = np.array([
    [302.22,   0.0,    320.0], # fx, 0, cx
    [0.0,    302.22,   240.0], # 0, fy, cy
    [0.0,      0.0,      1.0]  # 0, 0, 1
])

class AngleHistogramTracker:
    """
    디바이스의 각도를 추적하고 통계를 관리하는 클래스
    각도의 히스토그램을 구성하여 가장 자주 나타나는 각도를 파악
    """
    def __init__(self):
        self.angle_stats = {}   # {각도(int): 누적 프레임 수(int)} - 각도별 빈도수 기록
        self.homography_val = None  # 현재 저장된 호모그래피 행렬
        self.max_angle = None  # 현재 가장 오래 머문 각도
        self.max_angle_count = 0  # 가장 오래 머문 각도의 누적 프레임 수
        self.current_angle = None  # 현재 프레임의 실제 각도(실수형)
    
    def set_homography(self, H):
        """
        현재 프레임의 호모그래피 행렬 설정
        
        Parameters:
            H: 호모그래피 행렬 (3x3 numpy array)
        """
        self.homography_val = H    
        
        
    def update(self, current_angle):
        """
        현재 각도를 기록하고 통계 업데이트
        각도는 10도 단위로 반올림하여 기록
        
        Parameters:
            current_angle: 현재 측정된 각도(도 단위, 실수형)
        """
        angle = int(round(current_angle / 10.0)) * 10
        self.current_angle = current_angle

        if angle not in self.angle_stats:
            self.angle_stats[angle] = 0

        self.angle_stats[angle] += 1
        
        # 최빈 각도 갱신 여부 판단
        if self.angle_stats[angle] > self.max_angle_count:
            self.max_angle = angle
            self.max_angle_count = self.angle_stats[angle]


    def update_with_homography(self):
        """
        저장된 Homography 행렬에서 roll angle을 계산하고 통계 업데이트
        호모그래피가 없는 경우 아무 작업도 수행하지 않음
        """
        if self.homography_val is None:
            return  # 저장된 homography가 없으면 아무 것도 안 함

        # 호모그래피에서 롤 각도 추출
        roll_angle = get_roll_angle_from_homography(self.homography_val)
        if roll_angle is not None:
            self.update(roll_angle)


    def get_most_common_angle(self):
        """
        가장 빈번하게 나타난 각도 반환 (즉시 반환, O(1) 시간 복잡도)
        
        Returns:
            int: 가장 자주 나타난 각도, 없으면 0
        """
        return self.max_angle if self.max_angle is not None else 0
    
    def get_current_angle(self):
        """
        현재 프레임에서 계산된 실수형 roll angle 반환
        
        Returns:
            int: 현재 각도, 없으면 None
        """
        return self.current_angle

    def get_stats(self):
        """
        모든 각도 통계를 정렬하여 반환
        
        Returns:
            dict: 각도를 키로, 빈도수를 값으로 하는 정렬된 딕셔너리
        """
        return dict(sorted(self.angle_stats.items()))


def get_roll_angle_from_homography(H):
    """
    호모그래피 행렬로부터 롤 각도(z축 회전)를 계산
    
    Paramters:
        H: 3x3 호모그래피 행렬
        
    Returns:
        float: 롤 각도(도 단위), 계산 실패 시 None
    """
    try:
        # cv2.decomposeHomographyMat: 호모그래피를 회전, 평행이동 등으로 분해
        _, R, _, _ = cv2.decomposeHomographyMat(H, K)
        R = R[0] # 첫 번째 가능한 회전 행렬 사용
         # R 행렬에서 롤 각도 계산 (도 단위로 변환)
        roll_angle = np.arctan2(R[2, 1], R[2, 2]) * 180 / np.pi
        return roll_angle
    except:
        return None


angle_trackers = {}


def get_tracker(device_id):
    """
    특정 디바이스의 각도 추적기를 가져오거나 새로 생성
    
    Paramters:
        device_id: 디바이스 고유 식별자
        
    Returns:
        AngleHistogramTracker: 해당 디바이스의 각도 추적기 객체
    """
    if device_id not in angle_trackers:
        angle_trackers[device_id] = AngleHistogramTracker()
    return angle_trackers[device_id]