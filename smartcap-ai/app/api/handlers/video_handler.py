import os
import cv2
import base64
import numpy as np
import asyncio
import logging
import time

from starlette.websockets import WebSocketState

from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images
from app.core.image_preprocessing import preprocess_frame

logger = logging.getLogger(__name__)

async def handle_video_device(websocket, device_id: int):
    logger.info(f"[Device {device_id}] Video device connected")
    folder = create_image_folder()
    logger.info("Image folder created")
    img_count = 1

    # 녹화 시작 시간
    start_time = time.time()

    try:
        while True:
            if websocket.application_state == WebSocketState.DISCONNECTED:
                logger.info(f"[Device {device_id}] WebSocket disconnected, exiting loop.")
                break

            data = await websocket.receive()
            frame = None

            if "bytes" in data:
                binary_data = data["bytes"]
                # binary 데이터에 캡쳐 간격(헤더, 4바이트)이 포함되어 있다면 이를 제거
                if len(binary_data) > 4:
                    image_data = binary_data[4:]
                else:
                    image_data = binary_data
                frame_data = np.frombuffer(image_data, dtype=np.uint8)
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
                # 어안렌즈 보정 및 90도 좌측 회전 (전처리)
                processed_frame = await asyncio.to_thread(preprocess_frame, frame)
                # 로컬에 이미지 저장 (비동기 스레드 호출)
                await asyncio.to_thread(save_image, folder, processed_frame, img_count)
                logger.info(f"[Device {device_id}] Image {img_count} saved locally")
                img_count += 1
            else:
                logger.warning(f"[Device {device_id}] No valid frame data received")
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] handle_video_device cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Video loop exception: {e}")
    finally:
        try:
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except Exception as close_err:
            logger.warning(f"[Device {device_id}] Error closing websocket: {close_err}")
        # 녹화 종료 시점에 저장된 이미지들을 모아 동영상 생성
        duration = time.time() - start_time
        await asyncio.to_thread(create_video_from_images, folder, duration)
        logger.info(f"[Device {device_id}] Video created from images with duration {duration:.2f} seconds")
