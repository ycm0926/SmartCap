import os
import cv2
import base64
import numpy as np
import asyncio
import logging
import time
from collections import deque

import httpx
from starlette.websockets import WebSocketState, WebSocketDisconnect

from app.core.redis_client import redis_client
from app.models.run_model import run_model
from app.api import state
from app.core.image_preprocessing import preprocess_frame

logger = logging.getLogger(__name__)

# 백엔드 주소 및 인증 정보
BACKEND_SERVER_HOST = os.environ.get("BACKEND_SERVER_HOST", "localhost:8080")
USERNAME = os.environ.get("BACKEND_API_USER")
PASSWORD = os.environ.get("BACKEND_API_PASSWORD")
credentials = f"{USERNAME}:{PASSWORD}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()
auth_headers = {"Authorization": f"Basic {encoded_credentials}"}

# HTTP 클라이언트
http_client = httpx.AsyncClient(
    timeout=1.0,
    limits=httpx.Limits(max_keepalive_connections=30, max_connections=50),
    headers=auth_headers
)

# 디바이스별 마지막 결과
last_device_results = {}

# 백엔드 통지 함수
async def notify_backend(device_id, result_type):
    is_accident = (result_type % 3 == 0)
    endpoint = "accident" if is_accident else "alarm"
    url = f"http://{BACKEND_SERVER_HOST}/api/{endpoint}/{device_id}/notify"
    payload = {
        "constructionSitesId": 1,
        f"{'accidentType' if is_accident else 'alarmType'}": result_type
    }
    
    try:
        await http_client.post(url, json=payload)
        logger.info(f"{endpoint.capitalize()} notify sent for device {device_id} with type {result_type}")
    except Exception as e:
        logger.error(f"{endpoint.capitalize()} notify failed: {e}")

async def handle_video_device(websocket, device_id: int):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] Video device connected")
    
    # 프레임 처리 동기화를 위한 잠금
    processing_lock = asyncio.Lock()
    
    # 프레임 처리 변수
    img_count = 1
    frame_count = 0
    start_time = time.time()
    last_fps_check = time.time()
    frames_since_check = 0
    
    # 건너뛴 프레임의 시간 누적
    skipped_frames_time_diff = 0
    last_frame_time = time.time()
    
    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            try:
                # 매우 짧은 타임아웃으로 데이터 수신 대기
                data = await asyncio.wait_for(websocket.receive(), timeout=0.01)
            except asyncio.TimeoutError:
                # 타임아웃 시 건너뛴 프레임 시간 누적
                current_time = time.time()
                skipped_frames_time_diff += (current_time - last_frame_time) * 1000  # 밀리초로 변환
                last_frame_time = current_time
                continue
            except (WebSocketDisconnect, RuntimeError) as e:
                logger.info(f"[Device {device_id}] WebSocket disconnected: {e}")
                break
            
            frame = None
            capture_interval = None
            
            # 프레임 디코딩
            if "bytes" in data:
                binary_data = data["bytes"]
                if len(binary_data) < 4:
                    continue
                
                capture_interval = int.from_bytes(binary_data[:4], byteorder='little')
                image_data = binary_data[4:]
                frame_data = np.frombuffer(image_data, dtype=np.uint8)
                frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
            elif "text" in data and data["text"].startswith("data:image"):
                try:
                    base64_data = data["text"].split(",")[-1]
                    img_bytes = base64.b64decode(base64_data)
                    frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                    frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
                except Exception as e:
                    logger.error(f"[Device {device_id}] Base64 error: {e}")
            
            # 프레임이 있는 경우
            if frame is not None:
                current_time = time.time()
                
                # 처리 중인 다른 작업이 있다면 현재 프레임 건너뛰기
                if processing_lock.locked():
                    # 건너뛴 프레임의 capture_interval을 누적
                    if capture_interval is not None:
                        skipped_frames_time_diff += capture_interval
                    
                    logger.warning(f"[Device {device_id}] Frame dropped due to ongoing processing")
                    continue
                
                # 잠금 시작
                async with processing_lock:
                    frame_count += 1
                    frames_since_check += 1
                    current_img_count = img_count
                    img_count += 1
                    
                    # 어안렌즈 보정
                    processed_frame = await asyncio.to_thread(preprocess_frame, frame)
                    
                    # time_diff 결정
                    # 건너뛴 프레임들의 시간 + 현재 프레임의 capture_interval
                    time_diff = int(skipped_frames_time_diff)
                    if capture_interval is not None:
                        time_diff += int(capture_interval)
                    
                    # 누적된 건너뛴 프레임 시간 초기화
                    skipped_frames_time_diff = 0
                    
                    # 모델 실행
                    model_start = time.time()
                    result = await asyncio.to_thread(run_model, processed_frame, time_diff)
                    model_time = time.time() - model_start
                    
                    logger.info(f"[Device {device_id}] Frame #{frame_count}, result: {result}, model time: {model_time:.4f}s, time_diff: {time_diff}ms")
                    
                    # 결과 처리 (0이 아닐 때만)
                    if result != 0:
                        # Redis 저장 (비동기)
                        async def save_to_redis():
                            try:
                                ret, buf = cv2.imencode('.jpg', processed_frame)
                                if ret:
                                    image_bytes = buf.tobytes()
                                    key = f"device {device_id}:image:{int(time.time() * 1000)}_{current_img_count}"
                                    await asyncio.to_thread(redis_client.set, key, image_bytes, ex=180)
                                    logger.info(f"[Device {device_id}] Image saved to Redis with key {key}")
                            except Exception as e:
                                logger.error(f"[Device {device_id}] Redis error: {e}")
                        
                        # 결과가 이전과 다른 경우에만 알림 처리
                        result_changed = device_id not in last_device_results or result != last_device_results[device_id]
                        
                        if result_changed:
                            # 백엔드 알림 (비동기)
                            async def send_notification():
                                await notify_backend(device_id, result)
                            
                            # 디바이스 2로 전송
                            async def send_to_device2():
                                target_device = 2
                                if target_device in state.clients:
                                    try:
                                        await state.clients[target_device].send_text(str(result))
                                        logger.info(f"[Device {device_id}] Sent result {result} to device {target_device} via websocket")
                                    except Exception as e:
                                        logger.error(f"[Device {device_id}] Error sending to device {target_device}: {e}")
                            
                            # 결과 업데이트
                            last_device_results[device_id] = result
                            
                            # 작업 실행
                            await asyncio.gather(
                                save_to_redis(),
                                send_notification(),
                                send_to_device2()
                            )
                        else:
                            # 결과가 변경되지 않았을 때는 Redis만 저장
                            await save_to_redis()
                            logger.debug(f"[Device {device_id}] Skipping notifications - result unchanged: {result}")
                
                # FPS 계산 및 출력
                now = time.time()
                if frames_since_check >= 10 or now - last_fps_check >= 5:
                    fps = frames_since_check / (now - last_fps_check)
                    logger.info(f"[Device {device_id}] Current FPS: {fps:.2f}, processed frames: {frame_count}")
                    frames_since_check = 0
                    last_fps_check = now
    
    except Exception as e:
        logger.error(f"[Device {device_id}] Error: {e}", exc_info=True)
    finally:
        # 클라이언트 목록에서 제거
        if device_id in state.clients:
            state.clients.pop(device_id)
        
        # 마지막 결과 캐시에서 제거
        if device_id in last_device_results:
            del last_device_results[device_id]
        
        # 연결 종료
        try:
            if websocket.application_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception as close_err:
            logger.debug(f"[Device {device_id}] Error during websocket close: {close_err}")
        
        # 통계 출력
        total_time = time.time() - start_time
        avg_fps = frame_count / total_time if total_time > 0 else 0
        logger.info(f"[Device {device_id}] Disconnected, processed {frame_count} frames, avg FPS: {avg_fps:.2f}")

# 애플리케이션 시작/종료 이벤트 핸들러
async def startup_event():
    logger.info("Application started, HTTP client initialized")

async def shutdown_event():
    await http_client.aclose()
    logger.info("Application shutdown complete")