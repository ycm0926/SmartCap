from app.services.object_tracking import track_objects_for_risk_detection
from app.services.risk_detection.materials import detect_material_risks
from app.config import RiskLevel, RiskBase
from app.services.pipelines.harzard_model_runner import run_inference
from app.services.risk_detection.fall_zone import detect_fall_zone_risks
import concurrent.futures


def run_risk_detection_pipeline(frame, frame_count):
    """
    위험 감지 파이프라인을 실행합니다.
    
    파이프라인 단계:
    1. YOLO 모델로 객체 감지
    2. ByteTrack으로 객체 추적
    3. 각 위험 유형별 감지 수행 (자재, 낙상, 차량)
    4. 위험 단계 결정 및 반환 (0-8)
    
    Parameters:
        frame: 처리할 영상 프레임 (전처리된 상태)
        frame_count: 프레임 번호
        
    Returns:
        int: 위험 단계 (0-8)
            0: 안전
            1-2: 건설 자재 관련 (1: 1차 알림, 2: 2차 알림)
            4-5: 낙상 관련 (4: 1차 알림, 5: 2차 알림)
            7-8: 차량 관련 (7: 1차 알림, 8: 2차 알림)
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
    # 위험 감지 내부에서 3개의 개별 감지 로직을 위한 스레드 풀 생성
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as detection_executor:
        # 3개의 감지 로직 병렬 실행        
        # 자재 위험 감지
        material_risk_future = detection_executor.submit(
            detect_material_risks,
            tracked_objects.get('material', []), 
            frame_count
        )
        
        # 낙상 위험 감지
        fall_zone_risk_future = detection_executor.submit(
            detect_fall_zone_risks,
            tracked_objects.get('fall_zone', []), 
            frame_count
        )
        
        # 자동차 위험 감지
        
        # 결과 받기
        material_risks, shorter_side = material_risk_future.result()
        fall_zone_risks = fall_zone_risk_future.result()
        # vehicle_risks
    
    # 각 위험 유형별 단계 계산 (RiskBase + RiskLevel)
    material_stage = RiskBase.MATERIAL + material_risks if material_risks > RiskLevel.SAFE else RiskLevel.SAFE
    fall_zone_stage = RiskBase.FALL_ZONE + fall_zone_risks if fall_zone_risks > RiskLevel.SAFE else RiskLevel.SAFE
    # vehicle_stage = RiskBase.VEHICLE + vehicle_risks if vehicle_risks > RiskLevel.SAFE else RiskLevel.SAFE
        
    # 모든 위험 수준 중 최고값 찾기
    max_risk_level = max(material_stage, fall_zone_stage, RiskLevel.SAFE)
    
    return max_risk_level