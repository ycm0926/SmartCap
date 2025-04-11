# ByteTrack시 Segmentation 마스크를 사용할 클래스
SPECIFIC_CLASSES = {0}

# 위치 정보(중심점 거리)에 부여할 가중치
POSITION_WEIGHT = 0.4

# 두 객체 중심점 간의 최대 허용 거리
MAX_CENTER_DIST = 80

# 중장비 차량 추적 로직을 사용할 클래스
VEHICLE_CLASSES = {3, 4}

# 건설 자재 추적 로직을 사용할 클래스
MATERIAL_CLASSES = {0}

# 낙상 감지 추적 로직을 사용할 클래스
FALL_ZONE_CLASSES = {1, 2}

# 위험 단계 (정확한 위험의 심각도)
class RiskSeverity:
    SAFE = 0      # 안전한 상태
    WARNING = 1   # 1차 알림 발송 상태
    DANGER = 2    # 2차 알림 발송 상태
    INCIDENT = 3  # 사고 발생 상태
    
# 위험 유형별 기준값 (코드 오프셋)
class RiskTypeOffset:
    MATERIAL = 0   # 건설 자재: 0 + 위험단계 = 1, 2, 3
    FALL_ZONE = 3  # 낙상: 3 + 위험단계 = 4, 5, 6
    VEHICLE = 6    # 차량: 6 + 위험단계 = 7, 8, 9
    UNKNOWN = 10   # 원인 불명 사고: 항상 10