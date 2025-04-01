import concurrent.futures
from app.core.image_preprocessing import preprocess_frame
from app.services.pipelines.risk_detection import run_risk_detection_pipeline
from app.services.pipelines.incident_detection import run_incident_detection_pipeline


def run_model(binary_data, frame_count):
    """
    바이너리 데이터를 받아 이미지 전처리 후 위험 감지, 사고 판단 비동기 처리 메인 메서드
    
    Parameter:
    - binary_data: 웹소켓으로 받은 이미지의 바이너리 데이터
    - frame_count: 현재 프레임 번호 (우험 감지 및 사고 판단 로직에서 연속된 프레임인지 확인)
    
    Return:
    - risk_result: 위험 단계 (0, 1, 2) 또는 사고 발생 (3)
    """

    # 공통 전처리
    preprocessed_frame = preprocess_frame(binary_data)
    
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
    
    # 조건에 따른 반환
    if incident_result == 3:
        return 3
    else:
        return risk_result