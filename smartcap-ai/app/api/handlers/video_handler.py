# app/api/handlers/video_handler.py
import cv2
import base64
import numpy as np
import asyncio
import logging
import time
from collections import deque

from starlette.websockets import WebSocketState

from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images
from app.core.redis_client import redis_client
from app.models.run_model import run_model
from app.api import state

logger = logging.getLogger(__name__)

async def process_video_frames(device_id: str):
    queue = state.frame_queues[device_id]
    try:
        while True:
            if queue:
                frame = queue.popleft()
                try:
                    result = run_model(frame)
                    logger.info(f"[Device {device_id}] run_model result: {result}")
                    if result in [1, 2]:
                        state.SAVE_IMAGES_TO_REDIS = True

                    gps_ws = state.clients.get("2")
                    if gps_ws and gps_ws.application_state == WebSocketState.CONNECTED:
                        try:
                            await gps_ws.send_text(str(result))
                            logger.info(f"[Device {device_id}] Sent result {result} to GPS device")
                        except Exception as e:
                            logger.error(f"[Device {device_id}] Failed to send to GPS device: {e}")
                except Exception as e:
                    logger.error(f"[Device {device_id}] run_model error: {e}")
            else:
                await asyncio.sleep(0.05)
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] process_video_frames cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Unexpected error in process_video_frames: {e}")

async def handle_video_device(websocket, device_id: str):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] Video device connected")
    state.frame_queues[device_id] = deque()  # collections.deque() 사용
    state.processing_tasks[device_id] = asyncio.create_task(process_video_frames(device_id))
    
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
                try:
                    rotated_frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
                    save_image(folder, rotated_frame, img_count)
                    logger.info(f"[Device {device_id}] Image saved locally, count: {img_count}")
                    img_count += 1
                    last_frame_time = asyncio.get_event_loop().time()
                    queue = state.frame_queues[device_id]
                    if len(queue) >= state.MAX_QUEUE_SIZE:
                        queue.popleft()
                    queue.append(frame)
                    
                    if state.SAVE_IMAGES_TO_REDIS:
                        ret, buf = cv2.imencode('.jpg', frame)
                        if ret:
                            image_bytes = buf.tobytes()
                            key = f"device:1:image:{int(time.time() * 1000)}_{img_count}"
                            redis_client.set(key, image_bytes, ex=180)
                            logger.info(f"[Device {device_id}] Image saved to Redis with key {key}")
                        state.SAVE_IMAGES_TO_REDIS = False  # 저장 후 플래그 초기화

                except Exception as e:
                    logger.error(f"[Device {device_id}] Error processing image: {e}")
            else:
                logger.warning(f"[Device {device_id}] No valid frame data received")
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] handle_video_device cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Video loop exception: {e}")
    finally:
        state.clients.pop(device_id, None)
        state.frame_queues.pop(device_id, None)
        task = state.processing_tasks.pop(device_id, None)
        if task:
            task.cancel()
        duration = last_frame_time - start_time
        create_video_from_images(folder, duration)
        if websocket.application_state != WebSocketState.DISCONNECTED:
            await websocket.close()
