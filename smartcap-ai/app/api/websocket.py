import random
import cv2
import base64
import numpy as np
import asyncio
import logging
import os
from collections import deque

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.logging_config import setup_logging
from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images

# 로깅 설정: 콘솔과 파일에 로그가 찍히도록 force=True 옵션 사용
setup_logging()

# 전역 상태 관리
clients = {}          # device_id: WebSocket 객체 저장
frame_queues = {}     # 영상 디바이스(1)의 프레임을 저장하는 deque
processing_tasks = {} # 영상 디바이스(1)의 백그라운드 프레임 처리 작업
MAX_QUEUE_SIZE = 500  # 프레임 큐 최대 크기

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

def save_gps_data(device_id: str, gps_data: str):
    """
    GPS 데이터를 로컬 파일에 저장합니다.
    각 device_id별로 'gps_logs' 폴더 내의 텍스트 파일에 기록합니다.
    
    Args:
        device_id (str): GPS 디바이스 ID (여기서는 "2")
        gps_data (str): 수신한 GPS 데이터 문자열
    """
    folder = "gps_logs"
    if not os.path.exists(folder):
        os.makedirs(folder)
    file_path = os.path.join(folder, f"{device_id}.txt")
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(gps_data + "\n")
    logging.info(f"[Device {device_id}] GPS data saved to {file_path}")

async def process_video_frames(device_id: str):
    """
    영상 디바이스(디바이스 "1")의 프레임 큐를 순차적으로 처리하는 백그라운드 작업 함수.
    각 프레임을 run_model()으로 분석하여 결과가 1,2,3이면,
    연결된 GPS 디바이스(디바이스 "2")로 해당 정수를 전송합니다.
    
    Args:
        device_id (str): 영상 디바이스 ID ("1")
    
    Returns:
        None
    """
    queue = frame_queues[device_id]
    while True:
        if queue:
            frame = queue.popleft()
            try:
                result = run_model(frame)
                logging.info(f"[Device {device_id}] run_model result: {result}")
                # 결과가 1,2,3이면 GPS 디바이스("2")로 전송
                if result in [1, 2, 3]:
                    gps_ws = clients.get("2")
                    if gps_ws and gps_ws.application_state == WebSocketState.CONNECTED:
                        await gps_ws.send_text(str(result))
                        logging.info(f"[Device {device_id}] Sent result {result} to GPS device")
            except Exception as e:
                logging.error(f"[Device {device_id}] run_model error: {e}")
        else:
            await asyncio.sleep(0.05)

async def websocket_endpoint(websocket: WebSocket, device_id: str):
    """
    WebSocket 연결을 수락하고, device_id에 따라 다른 처리를 수행합니다.
    
    [영상 디바이스 ("1")]:
      - 이미지(바이너리 또는 base64 텍스트)를 지속적으로 수신합니다.
      - 수신 시마다 "Received data" 로그를 찍고, 이미지를 로컬에 저장 후 프레임 큐에 추가합니다.
      - 백그라운드에서 프레임 큐의 각 프레임을 run_model()으로 분석하여,
        결과가 1,2,3이면 연결된 GPS 디바이스("2")로 해당 정수를 전송합니다.
      - 연결 종료 시 저장된 이미지들로 영상을 생성합니다.
    
    [GPS 디바이스 ("2")]:
      - 텍스트 형태의 GPS 데이터를 수신합니다.
      - 수신 시마다 "Received data" 로그를 찍고, 텍스트에 "$GPGGA" 또는 "$GPRMC"가 포함되면
        파일에 저장합니다.
    
    Args:
        websocket (WebSocket): 클라이언트 WebSocket 객체
        device_id (str): 디바이스 ID ("1"은 영상, "2"는 GPS)
    
    Returns:
        None
    """
    await websocket.accept()
    clients[device_id] = websocket
    logging.info(f"[Device {device_id}] Connection accepted")
    
    # 영상 디바이스 처리 (device_id "1")
    if device_id == "1":
        frame_queues[device_id] = deque()
        processing_tasks[device_id] = asyncio.create_task(process_video_frames(device_id))
        folder = create_image_folder()
        img_count = 1
        start_time = asyncio.get_event_loop().time()
        last_frame_time = start_time
        logging.info(f"[Device {device_id}] Video device connected")
        
        try:
            while True:
                data = await websocket.receive()
                logging.info(f"[Device {device_id}] Received data: {data}")
                frame = None

                # 이미지 데이터를 바이너리로 수신한 경우
                if "bytes" in data:
                    logging.info(f"[Device {device_id}] Received binary data")
                    frame_data = np.frombuffer(data["bytes"], dtype=np.uint8)
                    frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)

                # base64 인코딩된 이미지 데이터 수신한 경우
                elif "text" in data:
                    text_data = data["text"]
                    logging.info(f"[Device {device_id}] Received text data: {text_data[:50]}...")
                    if text_data.startswith("data:image"):
                        base64_data = text_data.split(",")[-1]
                        try:
                            img_bytes = base64.b64decode(base64_data)
                            frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                            frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
                        except Exception as e:
                            logging.error(f"[Device {device_id}] Base64 decoding error: {e}")
                    else:
                        logging.warning(f"[Device {device_id}] Unexpected text data received")
                
                if frame is not None:
                    try:
                        save_image(folder, frame, img_count)
                        img_count += 1
                        last_frame_time = asyncio.get_event_loop().time()
                        queue = frame_queues[device_id]
                        if len(queue) >= MAX_QUEUE_SIZE:
                            queue.popleft()
                        queue.append(frame)
                        logging.info(f"[Device {device_id}] Frame processed and queued")
                    except Exception as e:
                        logging.error(f"[Device {device_id}] Error processing image: {e}")
                else:
                    logging.warning(f"[Device {device_id}] No valid frame data received")
        except Exception as e:
            logging.error(f"[Device {device_id}] Video loop exception: {e}")
        finally:
            clients.pop(device_id, None)
            frame_queues.pop(device_id, None)
            task = processing_tasks.pop(device_id, None)
            if task:
                task.cancel()
            duration = last_frame_time - start_time
            create_video_from_images(folder, duration)
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
    
    # GPS 디바이스 처리 (device_id "2")
    elif device_id == "2":
        last_trigger_time = asyncio.get_event_loop().time()
        logging.info(f"[Device {device_id}] GPS device connected")
        try:
            while True:
                data = await websocket.receive()
                logging.info(f"[Device {device_id}] Received data: {data}")
                if "text" in data:
                    text_data = data["text"]
                    logging.info(f"[Device {device_id}] Received text: {text_data[:50]}...")
                    # GPS NMEA 데이터 감지
                    if "$GPGGA" in text_data or "$GPRMC" in text_data:
                        logging.info(f"[Device {device_id}] GPS data detected: {text_data.strip()}")
                        save_gps_data(device_id, text_data.strip())
                        now = asyncio.get_event_loop().time()
                        if now - last_trigger_time >= 5:
                            last_trigger_time = now
                    else:
                        logging.warning(f"[Device {device_id}] Unexpected GPS text: {text_data}")
                else:
                    logging.warning(f"[Device {device_id}] Unexpected data format: {data}")
        except Exception as e:
            logging.error(f"[Device {device_id}] GPS loop exception: {e}")
        finally:
            clients.pop(device_id, None)
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
