# ByteTrack시 Segmentation 마스크를 사용할 클래스
SPECIFIC_CLASSES = {3}

# 위치 정보(중심점 거리)에 부여할 가중치
POSITION_WEIGHT = 0.4

# 두 객체 중심점 간의 최대 허용 거리
MAX_CENTER_DIST = 80

# 중장비 차량 추적 로직을 사용할 클래스
VEHICLE_CLASSES = {1, 2}

# 건설 자재 추적 로직을 사용할 클래스
MATERIAL_CLASSES = {3}

# 낙상 감지 추적 로직을 사용할 클래스
FALL_ZONE_CLASSES = {4, 5}