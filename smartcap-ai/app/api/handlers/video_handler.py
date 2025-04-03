import os
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

# preprocess_frame 함수는 어안렌즈 보정과 90도 좌측 회전을 내부에서 수행하도록 수정됨
from app.core.image_preprocessing import preprocess_frame

logger = logging.getLogger(__name__)

BACKEND_SERVER_HOST = os.environ.get("BACKEND_SERVER_HOST", "localhost:8080")

# 스프링 서버로 사고 정보를 전송하는 함수 (비동기, fire-and-forget)
async def notify_accident(device_id: int, accident_type: int):
    url = f"http://{BACKEND_SERVER_HOST}/api/accidents/{device_id}/notify"  # device_id 사용
    payload = {
        "constructionSitesId": 1,
        "accidentType": accident_type
    }
    try:
        # 타임아웃을 0.1초로 설정하여 빠르게 실패하도록 함
        timeout = httpx.Timeout(0.1)
        async with httpx.AsyncClient(timeout=timeout) as client:
            await client.post(url, json=payload)
        logger.info(f"Accident notify sent for device {device_id} with type {accident_type}")
    except Exception as e:
        logger.error(f"Accident notify failed (fire-and-forget): {e}")

# 스프링 서버로 알람을 전송하는 함수 (비동기, fire-and-forget)
async def notify_alarm(device_id: int, alarm_type: int):
    url = f"http://{BACKEND_SERVER_HOST}/api/alarm/{device_id}/notify"  # device_id 사용
    payload = {
        "constructionSitesId": 1,
        "alarmType": alarm_type
    }
    try:
        timeout = httpx.Timeout(0.1)
        async with httpx.AsyncClient(timeout=timeout) as client:
            await client.post(url, json=payload)
        logger.info(f"Alarm notify sent for device {device_id} with type {alarm_type}")
    except Exception as e:
        logger.error(f"Alarm notify failed (fire-and-forget): {e}")

async def handle_video_device(websocket, device_id: int):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] Video device connected")
    folder = create_image_folder()
    logger.info("create img")
    img_count = 1
    start_time = asyncio.get_event_loop().time()
    last_frame_time = start_time

    try:
        while True:
            if websocket.application_state == WebSocketState.DISCONNECTED:
                logger.info(f"[Device {device_id}] WebSocket disconnected, exiting loop.")
                break

            data = await websocket.receive()
            frame = None

            if "bytes" in data:
                frame_data = np.frombuffer(data["bytes"], dtype=np.uint8)
                # offload cv2.imdecode to a thread
                frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
            elif "text" in data:
                text_data = data["text"]
                if text_data.startswith("data:image"):
                    base64_data = text_data.split(",")[-1]
                    try:
                        img_bytes = base64.b64decode(base64_data)
                        frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                        frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
                    except Exception as e:
                        logger.error(f"[Device {device_id}] Base64 decoding error: {e}")
                else:
                    logger.warning(f"[Device {device_id}] Unexpected text data received")
            
            if frame is not None:
                # preprocess_frame 내에서 어안렌즈 보정 및 90도 좌측 회전 수행
                processed_frame = await asyncio.to_thread(preprocess_frame, frame)
                # 동기적으로 run_model 호출 (실행 완료 후 다음 단계 진행)
                result = await asyncio.to_thread(run_model, processed_frame)
                
                # 이미지 저장 및 Redis 저장
                await asyncio.to_thread(save_image, folder, processed_frame, img_count)
                    
                ret, buf = cv2.imencode('.jpg', processed_frame)
                if ret:
                    image_bytes = buf.tobytes()
                    key = f"device {device_id}:image:{int(time.time() * 1000)}_{img_count}"
                    # blocking 작업인 redis_client.set을 개별 스레드에서 진행되는 것을 비동기로 실행
                    await asyncio.to_thread(redis_client.set, key, image_bytes, ex=180)
                    logger.info(f"[Device {device_id}] Image saved to Redis with key {key}")
                    
                if result != 0:
                    try:
                        if result % 3 == 0:  # 3의 배수면 스프링에 사고 알림
                            # fire-and-forget 방식: notify 함수 호출 후 바로 다음 작업 진행
                            asyncio.create_task(notify_accident(device_id, result))
                        else: # 아니라면 스프링 및 디바이스에 알림 전송
                            asyncio.create_task(notify_alarm(device_id, result))
                            
                            # device 2에 웹소켓 통신으로 result 전송
                            target_device = 2
                            if target_device in state.clients:
                                await state.clients[target_device].send_text(str(result))
                                logger.info(f"[Device {device_id}] Sent result {result} to device {target_device} via websocket.")
                            else:
                                logger.warning(f"[Device {device_id}] Device {target_device} not connected. Cannot send result.")
                    except Exception as e:
                        logger.error(f"[Device {device_id}] Error sending notification: {e}")
                else:
                    logger.info(f"[Device {device_id}] run_model result is 0, no notification sent")
                    
                img_count += 1
                last_frame_time = asyncio.get_event_loop().time()
            else:
                logger.warning(f"[Device {device_id}] No valid frame data received")
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] handle_video_device cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Video loop exception: {e}")
    finally:
        state.clients.pop(device_id, None)
        try:
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except Exception as close_err:
            logger.warning(f"[Device {device_id}] Error closing websocket: {close_err}")
        duration = last_frame_time - start_time
        await asyncio.to_thread(create_video_from_images, folder, duration)
