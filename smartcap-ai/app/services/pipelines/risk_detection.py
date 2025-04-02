from app.services.object_tracking import track_objects_for_risk_detection
from app.services.risk_detection.materials import detect_material_risks
from app.config import RiskLevel
from app.services.pipelines.harzard_model_runner import run_inference


def run_risk_detection_pipeline(frame, frame_count):
    """
    위험 감지 파이프라인을 실행합니다.
    
    파이프라인 단계:
    1. YOLO 모델로 객체 감지
    2. ByteTrack으로 객체 추적
    3. 각 위험 유형별 감지 수행 (차량, 자재, 낙상)
    4. 위험 수준 결정 및 반환
    
    Parameters:
        frame: 처리할 영상 프레임 (전처리된 상태)
        frame_count: 프레임 번호
        
    Returns:
        int: 위험 수준 (0: 안전, 1: 주의, 2: 위험)
    """
    # 현재 프레임 번호
    frame_count = frame_count
    
    # 1. YOLO 모델로 객체 감지
    yolo_results = run_inference(frame)
    
    # 2. 객체 추적
    tracked_objects = track_objects_for_risk_detection(yolo_results[0])
    
    # 추적된 객체가 없으면 SAFE 반환
    if not tracked_objects:
        return RiskLevel.SAFE
    
    # 3. 각 위험 유형별 감지 수행
    material_risks, shorter_side = detect_material_risks(tracked_objects.get('material', []), frame_count)
    
    # 최고 위험 수준 반환 (위험이 없으면 SAFE)
    max_risk_level = max(material_risks, RiskLevel.SAFE)
    
    return max_risk_level