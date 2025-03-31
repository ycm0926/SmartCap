# app/api/websocket.py
import cv2
import base64
import numpy as np
import asyncio
import logging
import os
import time
from collections import deque

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.logging_config import setup_logging
from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images
from app.core.redis_client import redis_client
from app.models.run_model import run_model

# 로깅 설정
setup_logging()

# 전역 상태 관리
clients = {}          # device_id: WebSocket 객체 저장
frame_queues = {}     # 영상 디바이스("1")의 프레임을 저장하는 deque
processing_tasks = {} # 영상 디바이스("1")의 백그라운드 프레임 처리 작업
MAX_QUEUE_SIZE = 500  # 프레임 큐 최대 크기

# 전역 플래그: run_model()이 1이나 2를 반환하면 True로 설정
SAVE_IMAGES_TO_REDIS = False

def save_gps_data(device_id: str, gps_data: str):
    """
    GPS 데이터를 Redis에 저장합니다.
    모든 gps 데이터는 무조건 lat: 37.502, lng: 127.04로 저장되며,
    동일한 device_id가 저장되면 해당 key의 value가 변경됩니다.
    
    Args:
        device_id (str): GPS 디바이스 ID (예: "2")
        gps_data (str): 수신한 GPS 데이터 문자열 (실제 값은 무시됨)
    """
    redis_client.hset(device_id, mapping={"lat": 37.502, "lng": 127.04})
    logging.info(f"[Device {device_id}] GPS data saved to Redis with key {device_id}")

async def process_video_frames(device_id: str):
    global SAVE_IMAGES_TO_REDIS
    queue = frame_queues[device_id]
    while True:
        if queue:
            frame = queue.popleft()
            try:
                result = run_model(frame)
                logging.info(f"[Device {device_id}] run_model result: {result}")
                # 결과가 1이나 2이면 이미지 저장 플래그 활성화
                if result in [1, 2]:
                    SAVE_IMAGES_TO_REDIS = True
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
    global SAVE_IMAGES_TO_REDIS
    await websocket.accept()
    clients[device_id] = websocket
    logging.info(f"[Device {device_id}] Connection accepted")
    
    if device_id == "1":
        # 영상 디바이스 ("1") 처리
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
                frame = None

                if "bytes" in data:
                    logging.info(f"[Device {device_id}] Received binary data")
                    frame_data = np.frombuffer(data["bytes"], dtype=np.uint8)
                    frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
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
                        # 90도 좌측(반시계방향) 회전
                        rotated_frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
                        # 로컬에 이미지 저장
                        save_image(folder, rotated_frame, img_count)
                        img_count += 1
                        last_frame_time = asyncio.get_event_loop().time()
                        queue = frame_queues[device_id]
                        if len(queue) >= MAX_QUEUE_SIZE:
                            queue.popleft()
                        queue.append(frame)
                        
                        # 저장 플래그 활성화된 경우, 이미지도 Redis에 저장 (TTL 180초)
                        if SAVE_IMAGES_TO_REDIS:
                            ret, buf = cv2.imencode('.jpg', frame)
                            if ret:
                                image_bytes = buf.tobytes()
                                # 고유 키 생성: device와 타임스탬프, 이미지 카운터 포함
                                key = f"device:1:image:{int(time.time() * 1000)}_{img_count}"
                                redis_client.set(key, image_bytes, ex=180)
                                logging.info(f"[Device {device_id}] Image saved to Redis with key {key}")
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
    
    elif device_id == "2":
        # GPS 디바이스 ("2") 처리
        last_trigger_time = asyncio.get_event_loop().time()
        logging.info(f"[Device {device_id}] GPS device connected")
        try:
            while True:
                data = await websocket.receive()
                logging.info(f"[Device {device_id}] Received data: {data}")
                if "text" in data:
                    text_data = data["text"]
                    logging.info(f"[Device {device_id}] Received text: {text_data[:50]}...")
                    if "$GPGGA" in text_data or "$GPRMC" in text_data:
                        logging.info(f"[Device {device_id}] GPS data detected: {text_data.strip()}")
                        save_gps_data(device_id, text_data.strip())
                        now = asyncio.get_event_loop().time()
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
