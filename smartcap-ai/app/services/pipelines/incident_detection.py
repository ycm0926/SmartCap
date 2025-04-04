from app.services.risk_detection.accident_detection import accident_service

def run_incident_detection_pipeline(frame, device_id=23, timestamp_ms=143):
    # 디바이스에 해당하는 사고 감지기 가져오기
    detector = accident_service.get_detector(device_id)

     # 사고 감지 실행
    risk_status = detector.detect_accident(frame, timestamp_ms)
    
    return risk_status