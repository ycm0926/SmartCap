import os
import cv2
import re
import glob
import logging
from datetime import datetime

# ✅ 로그 설정
logging.basicConfig(
    filename="video_generation.log",
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# ✅ 영상 저장 폴더 설정
VIDEO_DIR = "app/videos"
os.makedirs(VIDEO_DIR, exist_ok=True)  # ✅ videos 폴더 없으면 생성


def sort_key(path):
    # 숫자 추출해서 정렬 기준으로 삼음
    filename = os.path.basename(path)
    numbers = re.findall(r'\d+', filename)
    return int(numbers[0]) if numbers else 0


def create_video_from_images(folder_path: str, duration: float):
    """
    선택한 폴더의 모든 이미지로 10fps 영상 생성
    :param folder_path: 이미지가 저장된 폴더 경로 (app/src/YYYY-MM-DD_HH-MM-SS/)
    """
    try:
        # ✅ 해당 폴더가 존재하는지 확인
        if not os.path.exists(folder_path):
            logging.error(f"❌ 폴더 없음: {folder_path}")
            return

        # ✅ 이미지 파일 가져오기 (jpg, png 지원)
        image_files = glob.glob(os.path.join(folder_path, "*.jpg")) + \
              glob.glob(os.path.join(folder_path, "*.png"))
        image_files = sorted(image_files, key=sort_key)

        frame_count = len(image_files)

        # ✅ 이미지가 부족할 경우 오류 처리
        if len(image_files) < 1:
            logging.error("❌ 영상 생성 실패: 이미지 파일이 없습니다.")
            return

        logging.info(f"📷 {len(image_files)}개의 이미지 발견")

        # ✅ 첫 번째 이미지에서 프레임 크기 가져오기
        first_frame = cv2.imread(image_files[0])
        height, width, layers = first_frame.shape

        fps = max(1, min(frame_count / duration, 30))

        # ✅ 저장할 비디오 파일명 설정 (app/videos/YYYY-MM-DD_HH-MM-SS.mp4)
        timestamp = os.path.basename(folder_path)  # 폴더 이름 (YYYY-MM-DD_HH-MM-SS)
        video_path = os.path.join(VIDEO_DIR, f"{timestamp}.mp4")

        # ✅ VideoWriter 객체 생성 (코덱: MP4V, 5fps)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(video_path, fourcc, fps, (width, height))  # ✅ FPS: 10

        # ✅ 모든 이미지 순서대로 추가
        for image_file in image_files:
            frame = cv2.imread(image_file)
            if frame is not None:
                video_writer.write(frame)

        video_writer.release()
        logging.info(f"✅ 영상 생성 완료: {video_path} (FPS: {fps:.2f}, Duration: {duration:.2f}s)")

    except Exception as e:
        logging.error(f"❌ 영상 생성 오류: {e}")
