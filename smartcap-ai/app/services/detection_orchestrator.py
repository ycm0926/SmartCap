import concurrent.futures
from app.core.image_preprocessing import preprocess_frame
from app.services.pipelines.risk_detection import run_risk_detection_pipeline
from app.services.pipelines.incident_detection import run_incident_detection_pipeline
from app.config import RiskSeverity
from app.config import RiskTypeOffset


def run_model(preprocessed_frame, frame_count):
    """
    이미지 전처리된 프레임 받아 위험 감지, 사고 판단 비동기 처리 메인 메서드
    
    Parameter:
    - preprocessed_frame: 웹소켓으로 받은 이미지의 프레임 데이터
    - frame_count: 현재 프레임 번호 (우험 감지 및 사고 판단 로직에서 연속된 프레임인지 확인)
    
    Return:
    - risk_result: 위험 단계 (0, 1, 2) 또는 사고 발생 (3)
    """
    
    # ThreadPoolExecutor 생성
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # 위험 감지, 사고 판단 비동기 파이프라인 시작
        risk_future = executor.submit(
            run_risk_detection_pipeline, 
            preprocessed_frame.copy(), 
            frame_count
        )
        incident_future = executor.submit(
            run_incident_detection_pipeline, 
            preprocessed_frame.copy(), 
            frame_count
        )
        
        # 결과 받기
        risk_result = risk_future.result()
        incident_result = incident_future.result()
    
    # 사고 발생 시(3) 조건에 따른 반환
    if incident_result == RiskSeverity.INCIDENT:
        # UNKNOWN 사고(10) 반환
        if risk_result == RiskSeverity.SAFE:
            return RiskTypeOffset.UNKNOWN
        
        # 건설 자재 사고(3) 반환
        elif risk_result < RiskTypeOffset.FALL_ZONE:
            return incident_result + RiskTypeOffset.MATERIAL
        
        # 낙상 사고(6) 반환
        elif risk_result < RiskTypeOffset.VEHICLE: 
            return incident_result + RiskTypeOffset.FALL_ZONE
        
        # 차량 사고(9) 반환
        else:
            return incident_result + RiskTypeOffset.VEHICLE
    else:
        return risk_result