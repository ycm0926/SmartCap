# app/models/run_model.py
import random

def run_model(frame):
    """
    테스트용 run_model 함수.
    입력받은 frame을 처리하여 5% 확률로 1, 2, 3 중 랜덤값을 리턴하고, 95% 확률로 0을 리턴합니다.
    
    Args:
        frame: 분석할 영상 프레임
        
    Returns:
        int: 분석 결과 (0 또는 1, 2, 3)
    """
    if random.random() < 0.05:
        return random.choice([1, 2, 3])
    else:
        return 0
