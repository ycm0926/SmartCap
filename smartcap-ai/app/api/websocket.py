import cv2
import base64
import numpy as np
import asyncio
import logging
from collections import deque

from fastapi import WebSocket
from starlette.websockets import WebSocketState
from app.core.logging_config import setup_logging
from app.core.save_img import save_image, create_image_folder
from app.core.save_video import create_video_from_images
from app.core.image_preprocessing import read_binary_image, correct_fisheye_distortion

setup_logging()

# 디바이스 상태 관리
clients = {}
frame_queues = {}
processing_tasks = {}
frame_counters = {}

MAX_QUEUE_SIZE = 500
LOG_FILE = "server.log"

async def process_frames_sequential(device_id: str, websocket: WebSocket):
    """프레임 큐에서 꺼내 AI 분석 후 클라이언트에 결과 전송"""

    queue = frame_queues[device_id]
    frame_counters.setdefault(device_id, 0)

    while True:
        if queue:
            frame = queue.popleft()
            try:
                continue
                # TODO: ai 코드 구현
                # detections = detect_objects(frame)

                # TODO: 위험도 계산
                # alert = any(d['confidence'] > 0.5 for d in detections)

                # response = {
                #     "device_id": device_id,
                #     "alert": alert,
                #     "detections": detections
                # }
                # await websocket.send_text(json.dumps(response))

            except Exception as e:
                logging.error(f"[{device_id}] AI 분석 오류: {str(e)}")
        else:
            await asyncio.sleep(0.05)
"""
    프레임 큐를 순차적으로 처리하는 루프.

    Args:
        device_id: 디바이스 ID
        websocket: WebSocket 객체

    Returns:
        None
"""

async def websocket_endpoint(websocket: WebSocket, device_id: str):
    await websocket.accept()
    clients[device_id] = websocket
    frame_queues[device_id] = deque()
    processing_tasks[device_id] = asyncio.create_task(process_frames_sequential(device_id, websocket))

    start_time = asyncio.get_event_loop().time()
    last_frame_time = start_time  # 마지막 프레임 시간도 같이 초기화

    folder = create_image_folder()
    img_count = 1


    logging.info(f"{device_id} 연결됨")

    try:
        while True:
            try:
                data = await websocket.receive()
            except Exception as e:
                logging.error(f"[{device_id}] WebSocket 수신 중 예외: {e}")
                break  # 연결 종료

            frame = None

            if "bytes" in data:
                frame = read_binary_image(data["bytes"])

            elif "text" in data:
                text_data = data["text"]
                try: 
                    # GPS NMEA 데이터 감지
                    if "$GPGGA" in text_data or "$GPRMC" in text_data:
                        logging.info(f"[{device_id}] GPS 데이터 수신됨: {text_data.strip()}")

                        # 5초 간격 조건
                        now = asyncio.get_event_loop().time()
                        if now - last_sound_trigger_time >= 5:
                            # if "37.1234" in text_data or "E123.4567" in text_data:  # 조건은 자유롭게 수정
                                try:
                                    await websocket.send_text("1")
                                    last_sound_trigger_time = now
                                    logging.info(f"[{device_id}] WAV 재생 명령 전송")
                                except Exception as e:
                                    logging.error(f"[{device_id}] WAV 재생 명령 전송 실패: {e}")
                    # 이미지 데이터 처리
                    else:
                        base64_data = data["text"].split(",")[-1]
                        logging.info(f"Received base64 data length: {len(base64_data)}")

                        img_bytes = base64.b64decode(base64_data)
                        frame = read_binary_image(img_bytes)
                except Exception as e:
                    logging.info(f"예상한 데이터 형식이 아닙니다.")
                    for key, value in data.items():
                        if isinstance(value, (bytes, bytearray)):
                            logging.info(f"data[{key}] = <{type(value).__name__}> (length={len(value)})")
                        else:
                            logging.info(f"data[{key}] = {value} ({type(value).__name__})")
        

            if frame is not None:
                try:
                    if not isinstance(img_count, int):
                        raise ValueError(f"img_count 타입 오류: {type(img_count)}")
                    preprocessed_frame = correct_fisheye_distortion(frame)
                    save_image(folder, preprocessed_frame, img_count)
                    img_count += 1
                    last_frame_time = asyncio.get_event_loop().time()

                    queue = frame_queues[device_id]
                    if len(queue) >= MAX_QUEUE_SIZE:
                        queue.popleft()
                    queue.append(preprocessed_frame)
                except Exception as e:
                    logging.error(f"이미지 처리 중 오류 발생: {str(e)}")
            else:
                logging.warning(f"[{device_id}] frame 데이터가 없습니다.")
                continue

    except Exception as e:
        logging.warning(f"{device_id} 연결 종료: {type(e).__name__}: {e}")

    finally:
        clients.pop(device_id, None)
        frame_queues.pop(device_id, None)
        task = processing_tasks.pop(device_id, None)
        if task:
            task.cancel()

        duration = last_frame_time - start_time  # 연결 시간 (초 단위)

        create_video_from_images(folder, duration)

        try:
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except RuntimeError as e:
            if "Unexpected ASGI message 'websocket.close'" not in str(e):
                raise
"""
WebSocket 연결을 수락하고 프레임을 수신/저장함.

Args:
    websocket: 클라이언트 WebSocket
    device_id: 디바이스 ID

Returns:
    None    
"""