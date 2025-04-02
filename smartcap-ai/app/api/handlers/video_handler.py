import cv2
import base64
import numpy as np
import asyncio
import logging
import time
from collections import deque

import httpx  # 비동기 HTTP 호출을 위해 사용

from starlette.websockets import WebSocketState

from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images
from app.core.redis_client import redis_client
from app.models.run_model import run_model
from app.api import state

logger = logging.getLogger(__name__)

# 스프링 서버로 사고 정보를 전송하는 함수 (비동기)
async def notify_accident():
    url = "http://localhost:8080/api/accidents/23/notify"
    payload = {
        "constructionSitesId": 1,
        "accidentType": "Accident Detected"
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        logger.info(f"Accident notify response: {response.status_code} {response.text}")

async def handle_video_device(websocket, device_id: str):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] Video device connected")
    folder = create_image_folder()
    logger.info("create img")
    img_count = 1
    start_time = asyncio.get_event_loop().time()
    last_frame_time = start_time

    try:
        while True:
            data = await websocket.receive()
            frame = None

            if "bytes" in data:
                frame_data = np.frombuffer(data["bytes"], dtype=np.uint8)
                frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
            elif "text" in data:
                text_data = data["text"]
                if text_data.startswith("data:image"):
                    base64_data = text_data.split(",")[-1]
                    try:
                        img_bytes = base64.b64decode(base64_data)
                        frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                        frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
                    except Exception as e:
                        logger.error(f"[Device {device_id}] Base64 decoding error: {e}")
                else:
                    logger.warning(f"[Device {device_id}] Unexpected text data received")
            
            if frame is not None:
                # 90도 좌측(반시계방향) 회전
                rotated_frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
                # 동기적으로 run_model 호출 (실행이 끝나야 다음 단계 진행)
                result = run_model(rotated_frame)
                logger.info(f"[Device {device_id}] run_model result: {result}")
                
                # run_model 결과에 따라 이미지 저장 및 추가 작업
                if result in [1, 2, 3]:
                    # 로컬에 이미지 저장
                    save_image(folder, rotated_frame, img_count)
                    logger.info(f"[Device {device_id}] Image saved locally, count: {img_count}")
                    
                    # Redis 저장: result에 상관없이 저장할 경우
                    # redis 저장 Device 23으로 고정
                    ret, buf = cv2.imencode('.jpg', rotated_frame)
                    if ret:
                        image_bytes = buf.tobytes()
                        key = f"device 23:image:{int(time.time() * 1000)}_{img_count}"
                        redis_client.set(key, image_bytes, ex=180)
                        logger.info(f"[Device 23] Image saved to Redis with key {key}")
                    
                    # 사고 발생인 경우 (result == 3) 스프링에 사고 알림 전송
                    if result == 3:
                        await notify_accident()
                    
                    img_count += 1
                else:
                    logger.info(f"[Device {device_id}] run_model result {result} does not trigger saving.")
                
                last_frame_time = asyncio.get_event_loop().time()
            else:
                logger.warning(f"[Device {device_id}] No valid frame data received")
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] handle_video_device cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Video loop exception: {e}")
    finally:
        state.clients.pop(device_id, None)
        duration = last_frame_time - start_time
        create_video_from_images(folder, duration)
        if websocket.application_state != WebSocketState.DISCONNECTED:
            await websocket.close()
