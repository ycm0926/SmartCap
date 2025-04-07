from ultralytics import YOLO
import os

# 모델 파일 경로 설정 - 위험 감지 세그멘테이션 모델 v1 사용
MODEL_PATH = os.path.join("ai_models", "yolo11n-seg.pt")

# YOLO 모델 로드 - 사전 훈련된 위험 감지 모델 초기화
model = YOLO(MODEL_PATH)

def run_inference(frame):
    """
    입력 프레임에 대해 위험 감지 추론을 실행
    
    Args:
        frame: 처리할 영상 프레임 (전처리된 상태)
        
    Returns:
        results: 모델의 예측 결과 객체 - 감지된 객체, 바운딩 박스, 세그멘테이션 마스크 등 포함
    """
    # 모델을 사용하여 입력 프레임에 대한 예측 실행
    # 사용 가능한 추론 관련 매개변수:
    # - source: 입력 소스 (이미지 경로, 비디오 파일, URL 등), 기본값: 'ultralytics/assets'
    # - conf: 감지 신뢰도 임계값, 기본값: 0.25
    # - iou: NMS를 위한 IoU 임계값, 기본값: 0.7
    # - imgsz: 추론을 위한 이미지 크기 (정수 또는 (높이, 너비) 튜플), 기본값: 640
    # - half: 반정밀도(FP16) 추론 사용 여부, 기본값: False
    # - device: 추론에 사용할 장치 (예: cpu, cuda:0, 0), 기본값: None (자동 선택)
    # - batch: 추론 배치 크기, 기본값: 1
    # - max_det: 이미지당 최대 감지 수, 기본값: 300
    # - vid_stride: 비디오 입력의 프레임 간격, 기본값: 1
    # - stream_buffer: 비디오 스트림의 프레임 대기열 처리 방식, 기본값: False
    # - visualize: 모델 특성 시각화 활성화, 기본값: False
    # - augment: 테스트 타임 증강(TTA) 사용, 기본값: False
    # - agnostic_nms: 클래스 비의존적 NMS 사용, 기본값: False
    # - classes: 특정 클래스 ID만 필터링, 기본값: None (모든 클래스)
    # - retina_masks: 고해상도 세그멘테이션 마스크 반환, 기본값: False
    # - embed: 특성 벡터나 임베딩을 추출할 레이어, 기본값: None
    # - project: 예측 출력을 저장할 프로젝트 디렉토리 이름, 기본값: None
    # - name: 예측 실행 이름, 기본값: None
    # - stream: 메모리 효율적인 처리 사용, 기본값: False
    # - verbose: 자세한 추론 로그 표시 여부, 기본값: True
    results = model.predict(
        frame,
        imgsz=(640, 480),
        verbose = False
    )
    
    # 예측 결과 반환
    return results