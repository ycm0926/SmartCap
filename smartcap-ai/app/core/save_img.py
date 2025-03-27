import os
import logging
import cv2
import numpy as np
from datetime import datetime


# ✅ 새로 저장할 이미지 폴더 생성
def create_image_folder():
    print("create img")
    try:
        base_dir = os.path.abspath("app/src")  # ✅ app 폴더 내부에 src 폴더 지정
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)  # ✅ app/src 폴더가 없으면 생성
        
        folder_name = os.path.join(base_dir, datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))  # ✅ 날짜별 폴더
        os.makedirs(folder_name, exist_ok=True)  # ✅ 폴더 생성 (이미 존재하면 무시)
        
        logging.info(f"✅ 이미지 폴더 생성: {folder_name}")
        return folder_name
    
    except Exception as e:
        logging.error(f"❌ 폴더 생성 실패: {e}")
        return None  # 폴더 생성 실패 시 None 반환

# ✅ 받은 이미지 저장하는 함수
def save_image(folder: str, frame: np.ndarray, count: int):
    try:
        if folder is None:
            logging.error("❌ 저장할 폴더가 없습니다. 이미지 저장 실패!")
            return

        file_path = os.path.join(folder, f"img_{count}.jpg")

        if frame is None:
            logging.error("❌ frame이 None입니다.")
            return

        if not isinstance(frame, np.ndarray):
            logging.error(f"❌ frame 타입이 이상함: {type(frame)}")
            return

        logging.info(f"🧪 frame shape: {getattr(frame, 'shape', 'no shape')}, dtype: {getattr(frame, 'dtype', 'no dtype')}")

        success = cv2.imwrite(file_path, frame)

        if success:
            logging.info(f"✅ 이미지 저장 완료: {file_path}")
        else:
            logging.error(f"❌ 이미지 저장 실패 (cv2.imwrite 반환 False): {file_path}")

    except Exception as e:
        import traceback
        logging.error(f"❌ 이미지 저장 중 오류 발생: {e}")
        logging.debug(traceback.format_exc())