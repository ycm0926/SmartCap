import cv2
import base64
import numpy as np
import json
import asyncio
import logging
from collections import deque

from fastapi import WebSocket
from starlette.websockets import WebSocketState


# 디바이스 상태 관리
clients = {}
frame_queues = {}
processing_tasks = {}
frame_counters = {}

MAX_QUEUE_SIZE = 5
LOG_FILE = "server.log"

# 로그 설정
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
console_handler.setFormatter(formatter)
logging.getLogger().addHandler(console_handler)


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

                # TODO: 위험도 계산산
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


    logging.info(f"{device_id} 연결됨")

    try:
        while True:
            data = await websocket.receive()

            frame = None

            if "bytes" in data:
                frame_data = np.frombuffer(data["bytes"], dtype=np.uint8)
                frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)

            elif "text" in data:
                base64_data = data["text"].split(",")[-1]
                img_bytes = base64.b64decode(base64_data)
                frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)

            if frame is not None:
                try: 
                    queue = frame_queues[device_id]
                    if len(queue) >= MAX_QUEUE_SIZE:
                        queue.popleft()
                    queue.append(frame)
                except Exception as e:
                    logging.error(f"이미지 처리 중 오류 발생: {str(e)}")
            else:
                await websocket.send_text(json.dumps({"error": "frame 데이터가 없습니다"}))
                continue

    except Exception as e:
        logging.warning(f"{device_id} 연결 종료: {e}")

    finally:
        clients.pop(device_id, None)
        frame_queues.pop(device_id, None)
        task = processing_tasks.pop(device_id, None)
        if task:
            task.cancel()
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