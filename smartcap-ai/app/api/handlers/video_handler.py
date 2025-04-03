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
from app.services.detection_orchestrator import run_model
from app.api import state

# preprocess_frame 함수는 어안렌즈 보정과 90도 좌측 회전을 내부에서 수행하도록 수정됨
from app.core.image_preprocessing import preprocess_frame

logger = logging.getLogger(__name__)

# 스프링 서버로 사고 정보를 전송하는 함수 (비동기)
async def notify_accident(accident_type: int):
    url = "http://localhost:8080/api/accidents/23/notify"  # 23아이디 고정
    payload = {
        "constructionSitesId": 1,
        "accidentType": accident_type  # 전달받은 정수값 사용
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        logger.info(f"Accident notify response: {response.status_code} {response.text}")

# 스프링 서버로 1, 2차 알림을 전송하는 함수 (비동기)
# async def notify_alert(notice_type: int):
#     url = "http://localhost:8080/api/alert/23/notify" # 23아이디 고정
#     payload = {
#         "constructionSitesId": 1,
#         "accidentType": alert_type  # 전달받은 정수값 사용
#     }
#     async with httpx.AsyncClient() as client:
#         response = await client.post(url, json=payload)
#         logger.info(f"Accident notify response: {response.status_code} {response.text}")

async def handle_video_device(websocket, device_id: str):
    device_id = 23
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
                # preprocess_frame 내에서 어안렌즈 보정 및 90도 좌측 회전 수행
                processed_frame = preprocess_frame(frame)
                
                # 동기적으로 run_model 호출 (실행 완료 후 다음 단계 진행)
                result = run_model(processed_frame, 0)
                logger.info(f"[Device {device_id}] run_model result: {result}")
                
                if result in [1, 2, 3]:
                    # 로컬에 이미지 저장 (보정 및 회전된 이미지)
                    save_image(folder, processed_frame, img_count)
                    logger.info(f"[Device {device_id}] Image saved locally, count: {img_count}")
                    
                    # Redis 저장 (Device 23로 고정)
                    ret, buf = cv2.imencode('.jpg', processed_frame)
                    if ret:
                        image_bytes = buf.tobytes()
                        key = f"device 23:image:{int(time.time() * 1000)}_{img_count}"
                        redis_client.set(key, image_bytes, ex=180)
                        logger.info(f"[Device 23] Image saved to Redis with key {key}")
                    
                    # 1차/2차 알림의 경우 스프링에 위험 알림 전송
                    # if result == 1 or result == 2:
                    #     await notify_alert(result)
                    
                    # 사고 발생인 경우 스프링에 사고 알림 전송
                    if result == 3:
                        await notify_accident(result)
                    
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
