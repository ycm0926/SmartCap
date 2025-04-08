import os
import cv2
import base64
import numpy as np
import asyncio
import logging
import time
from collections import deque
import zlib
import io


import httpx
from starlette.websockets import WebSocketState, WebSocketDisconnect

from app.core.redis_client import redis_client
from app.services.detection_orchestrator import run_model
from app.api import state
from app.core.image_preprocessing import preprocess_frame

# 로깅 설정
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

# 디바이스별 마지막 결과
last_device_results = {}

# 실시간 스트리밍 클라이언트 관리
streaming_clients = {}

# 스트리밍 태스크 추적을 위한 세트
streaming_tasks = set()

# 프레임 버퍼 설정
device_frame_buffers = {}  # 디바이스별 프레임 버퍼
normal_state_frame_counts = {}  # 디바이스별 정상 상태 연속 프레임 카운트
NORMAL_STATE_FLUSH_THRESHOLD = 30  # 정상 상태(0)가 연속 30프레임 이상 지속되면 버퍼 flush

# 이벤트 상태 추적
device_event_states = {}  # 디바이스별 이벤트 상태 (True: 이벤트 발생 중, False: 정상 상태)

# 이벤트 타입 구분
NORMAL_STATE = 0  # 정상 상태 (안전)
ALERT_STATES = [1, 4, 7]  # 알림 상태 (1차 알림)
ACCIDENT_STATES = [3, 6, 9, 10]  # 사고 상태


# 스트리밍 태스크 생성 및 관리 함수
def create_streaming_task(coro):
    task = asyncio.create_task(coro)
    streaming_tasks.add(task)
    task.add_done_callback(lambda t: streaming_tasks.remove(t))
    return task


# 프론트엔드 스트리밍 클라이언트 연결 처리
async def handle_streaming_client(websocket, device_id: int):
    client_id = id(websocket)
    logger.info(f"New streaming client {client_id} connected for device {device_id}")
    
    if device_id not in streaming_clients:
        streaming_clients[device_id] = set()
    
    streaming_clients[device_id].add(websocket)
    
    try:
        # 클라이언트 연결 유지 (heartbeat 또는 종료 신호 대기)
        while websocket.application_state == WebSocketState.CONNECTED:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "close":
                    break
            except asyncio.TimeoutError:
                # heartbeat 전송
                await websocket.send_text("ping")
            except Exception as e:
                logger.error(f"Error receiving from streaming client {client_id}: {e}")
                break
    except WebSocketDisconnect:
        logger.info(f"Streaming client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"Error in streaming client {client_id} connection: {e}")
    finally:
        # 연결 종료 시 클라이언트 제거
        if device_id in streaming_clients and websocket in streaming_clients[device_id]:
            streaming_clients[device_id].remove(websocket)
            if not streaming_clients[device_id]:
                del streaming_clients[device_id]
        logger.info(f"Streaming client {client_id} removed for device {device_id}")


# 모든 스트리밍 클라이언트에 프레임 전송
async def broadcast_frame(device_id, frame, result=None, tracked_objects=None):
    if device_id not in streaming_clients or not streaming_clients[device_id]:
        return
    print(f"frame : {frame.shape}")
    # 성능 최적화: 클라이언트 수 체크
    client_count = len(streaming_clients[device_id])
    
    # 너무 많은 클라이언트가 연결된 경우 (예: 10개 이상) 이미지 품질 낮추기
    jpeg_quality = 80 if client_count < 10 else 60
    
    # 추적된 객체 표시
    if tracked_objects:
        
        # 각 객체 유형별로 처리        
        # 1. 자재(material) 객체 처리
        if 'material' in tracked_objects and tracked_objects['material']:
            for material in tracked_objects['material']:
                # rotated_box가 있는 경우만 처리
                # 회전된 박스가 있는 경우 그리기
                if 'rotated_box' in material and material['rotated_box'] is not None:
                    # rotated_box는 ((center_x, center_y), (width, height), angle) 형태
                    box_points = cv2.boxPoints(material['rotated_box'])
                    box_points = box_points.astype(np.int32)  # np.int0 대신 np.int32 사용
                    cv2.drawContours(frame, [box_points], 0, (0, 255, 0), 2)
                # 회전된 박스가 없는 경우 일반 박스 그리기
                elif 'tlbr' in material:
                    x1, y1, x2, y2 = map(int, material['tlbr'])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                if 'shorter_side' in material and material['shorter_side'] is not None:
                    # shorter_side 값 표시 (소수점 2자리까지)
                    shorter_side_text = f"Shorter Side: {material['shorter_side']:.2f}"
                    cv2.putText(frame, shorter_side_text, (50, 90), cv2.FONT_HERSHEY_SIMPLEX, 
                                1, (255, 255, 255), 2, cv2.LINE_AA)
        
        # 2. 계단(fall_zone) 객체 처리
        if 'fall_zone' in tracked_objects and tracked_objects['fall_zone']:
            for stair in tracked_objects['fall_zone']:
                # 사다리꼴 점이 있는 경우만 처리
                if 'trapezoid_pts' in stair:
                    trapezoid_pts = stair['trapezoid_pts']
                    # 사다리꼴 그리기
                    cv2.polylines(frame, [trapezoid_pts], True, (0, 255, 0), 2)  # 초록색으로 사다리꼴 그리기
                    
                    # 소실점 표시
                    if 'vanishing_point' in stair and stair['vanishing_point'] is not None:
                        vp_x, vp_y = stair['vanishing_point']
                        
                        # 이미지 내부에 있는 경우만 그리기
                        if 0 <= vp_x < frame.shape[1] and 0 <= vp_y < frame.shape[0]:
                            cv2.circle(frame, (vp_x, vp_y), 5, (255, 0, 255), -1)  # 마젠타 색상의 원으로 소실점 표시
                            cv2.putText(frame, "VP", (vp_x + 5, vp_y - 5), 
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
    
    # 결과를 프레임에 표시 (옵션)
    if result is not None and result != 0:
        # 프레임에 결과 정보 표시
        text = f"Result: {result}"
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    
    # 타임아웃 설정으로 브로드캐스팅이 너무 오래 걸리지 않도록 함
    try:
        # JPEG 인코딩 및 Base64 변환을 별도 스레드에서 실행 (CPU 바운드 작업)
        encoded_frame = await asyncio.to_thread(
            lambda: cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])[1].tobytes()
        )
        
        frame_bytes = encoded_frame
        base64_frame = base64.b64encode(frame_bytes).decode('utf-8')
        frame_data = f"data:image/jpeg;base64,{base64_frame}"
        
        # 모든 연결된 클라이언트에 전송 (타임아웃 설정)
        disconnected_clients = []
        sent_count = 0
        
        # 각 클라이언트에 개별적으로 전송 (한 클라이언트가 느려도 다른 클라이언트에 영향 없음)
        for client in list(streaming_clients[device_id]):
            if client.application_state == WebSocketState.CONNECTED:
                try:
                    # 각 클라이언트에 0.5초 타임아웃 설정
                    await asyncio.wait_for(client.send_text(frame_data), timeout=0.5)
                    sent_count += 1
                except asyncio.TimeoutError:
                    # 타임아웃된 클라이언트는 연결 해제 목록에 추가
                    logger.warning(f"Timeout sending to streaming client for device {device_id}")
                    disconnected_clients.append(client)
                except Exception:
                    disconnected_clients.append(client)
            else:
                disconnected_clients.append(client)
        
        # 연결 종료된 클라이언트 정리
        for client in disconnected_clients:
            if client in streaming_clients[device_id]:
                streaming_clients[device_id].remove(client)
        
        if disconnected_clients:
            logger.info(f"Removed {len(disconnected_clients)} disconnected streaming clients for device {device_id}")
        
        # 로깅 최소화 (30프레임마다 한 번만)
        if id(frame) % 30 == 0:
            logger.debug(f"Streamed to {sent_count}/{client_count} clients for device {device_id}")
            
    except Exception as e:
        logger.error(f"Error broadcasting frame for device {device_id}: {e}")
        # 에러가 발생해도 주 처리 로직에 영향 없음


# 프레임 버퍼를 압축하여 Redis에 저장하는 함수
async def save_buffer_to_redis(device_id, event_start_time):
    try:
        if device_id not in device_frame_buffers or not device_frame_buffers[device_id]:
            logger.warning(f"[Device {device_id}] No frames in buffer to save")
            return
        
        # 버퍼에서 프레임 가져오기
        frames = list(device_frame_buffers[device_id])
        total_frames = len(frames)
        
        logger.info(f"[Device {device_id}] Compressing {total_frames} frames for Redis storage")
        
        # 압축 준비
        compressed_data = []
        timestamp = int(event_start_time * 1000)
        
        # 프레임을 JPEG로 인코딩하고 압축하여 저장
        for i, (frame_time, frame) in enumerate(frames):
            # JPEG로 인코딩 (75% 품질로 압축)
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if ret:
                # 압축 데이터와 타임스탬프 저장
                frame_data = buffer.tobytes()
                compressed_data.append((frame_time, frame_data))
            
            # 로깅 (10% 단위로)
            if i % max(1, total_frames // 10) == 0:
                logger.debug(f"[Device {device_id}] Compressed {i}/{total_frames} frames")
        
        # 압축 데이터를 직렬화하여 Redis에 저장
        if compressed_data:
            # 바이너리 형식으로 직렬화 (시간 절약을 위해 간단한 형식 사용)
            buffer = io.BytesIO()
            # 헤더: 총 프레임 수
            buffer.write(len(compressed_data).to_bytes(4, byteorder='little'))
            
            # 각 프레임 데이터 저장
            for frame_time, frame_data in compressed_data:
                # 프레임 타임스탬프
                buffer.write(frame_time.to_bytes(8, byteorder='little'))
                # 프레임 크기
                buffer.write(len(frame_data).to_bytes(4, byteorder='little'))
                # 프레임 데이터
                buffer.write(frame_data)
            
            # 최종 데이터 가져오기
            final_data = buffer.getvalue()
            
            # zlib으로 최종 압축
            compressed_final = zlib.compress(final_data, level=1)  # 빠른 압축을 위해 낮은 레벨 사용
            
            # Redis에 저장
            key = f"device:{device_id}:event:{timestamp}"
            await asyncio.to_thread(redis_client.set, key, compressed_final, ex=3600)  # 1시간 유지
            
            logger.info(f"[Device {device_id}] Saved {len(compressed_data)} frames to Redis with key {key}")
            logger.info(f"[Device {device_id}] Original size: {len(final_data)}, Compressed size: {len(compressed_final)}, Ratio: {len(compressed_final)/len(final_data):.2f}")
            
            return key
        else:
            logger.warning(f"[Device {device_id}] No frames were successfully compressed")
            return None
            
    except Exception as e:
        logger.error(f"[Device {device_id}] Error saving buffer to Redis: {e}", exc_info=True)
        return None
        

# 백엔드 통지 함수 (결합)
async def notify_backend(device_id, result_type, redis_key=None):
    is_accident = (result_type % 3 == 0)
    endpoint = "accident" if is_accident else "alarm"
    url = f"http://{BACKEND_SERVER_HOST}/api/{endpoint}/{device_id}/notify"
    payload = {
        "constructionSitesId": 1,
        f"{'accidentType' if is_accident else 'alarmType'}": result_type
    }
    
    # Redis 키가 있으면 페이로드에 추가
    if redis_key:
        payload["redisKey"] = redis_key
    
    try:
        await http_client.post(url, json=payload)
        logger.info(f"{endpoint.capitalize()} notify sent for device {device_id} with type {result_type}" + 
                   (f" and redis key {redis_key}" if redis_key else ""))
    except Exception as e:
        logger.error(f"{endpoint.capitalize()} notify failed: {e}")


async def handle_video_device(websocket, device_id: int):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] Video device connected")
    img_count = 1
    frame_count = 0
    start_time = time.time()
    last_fps_check = time.time()
    frames_since_check = 0
    
    # 프레임 버퍼 초기화
    if device_id not in device_frame_buffers:
        device_frame_buffers[device_id] = deque()  # 크기 제한 없음
    
    # 정상 상태 카운터 초기화
    if device_id not in normal_state_frame_counts:
        normal_state_frame_counts[device_id] = 0
    
    # 이벤트 상태 초기화
    device_event_states[device_id] = False  # 초기 상태는 정상
    event_start_time = None  # 이벤트 시작 시간
    
    # 최신 데이터 저장용 변수와 이벤트 선언 (항상 최신 프레임만 보유)
    latest_data = None
    data_event = asyncio.Event()

    # 웹소켓에서 프레임을 계속 받아 최신 데이터를 갱신하는 수신 태스크
    async def frame_receiver():
        nonlocal latest_data, data_event
        try:
            while websocket.application_state == WebSocketState.CONNECTED:
                data = await websocket.receive()
                latest_data = data
                data_event.set()
        except Exception as e:
            logger.error(f"[Device {device_id}] Receiver error: {e}")
    
    receiver_task = asyncio.create_task(frame_receiver())
    
    # 비동기 작업 추적
    pending_tasks = []
    
    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            try:
                # 0.1초 대기하며 새로운 데이터가 있을 때까지 기다림
                await asyncio.wait_for(data_event.wait(), timeout=0.1)
            except asyncio.TimeoutError:
                continue
            # 이벤트가 발생하면 clear하고 최신 데이터 사용
            data_event.clear()
            data = latest_data
            
            frame = None
            capture_interval = None
            
            # 바이너리 데이터 처리
            if "bytes" in data:
                binary_data = data["bytes"]
                if len(binary_data) < 4:
                    continue
                
                capture_interval = int.from_bytes(binary_data[:4], byteorder='little')
                image_data = binary_data[4:]
                frame_data = np.frombuffer(image_data, dtype=np.uint8)
                frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
            # 텍스트 데이터 처리
            elif "text" in data and data["text"].startswith("data:image"):
                try:
                    base64_data = data["text"].split(",")[-1]
                    img_bytes = base64.b64decode(base64_data)
                    frame_data = np.frombuffer(img_bytes, dtype=np.uint8)
                    frame = await asyncio.to_thread(cv2.imdecode, frame_data, cv2.IMREAD_COLOR)
                except Exception as e:
                    logger.error(f"[Device {device_id}] Base64 error: {e}")
            
            if frame is not None:
                frame_count += 1
                frames_since_check += 1
                current_img_count = img_count
                img_count += 1
                
                # 이전 모든 작업이 완료되길 기다림 (순서 보장)
                if pending_tasks:
                    await asyncio.gather(*pending_tasks)
                    pending_tasks = []
                
                # 어안렌즈 보정
                processed_frame = await asyncio.to_thread(preprocess_frame, frame)
                time_diff = capture_interval if capture_interval is not None else 0
                current_time = time.time()
                
                # 모델 실행 (순서대로)
                model_start = time.time()
                result_with_objects = await asyncio.to_thread(run_model, processed_frame, time_diff)
                model_time = time.time() - model_start
                
                # 결과와 추적된 객체 정보 분리
                if isinstance(result_with_objects, tuple) and len(result_with_objects) > 1:
                    result, tracked_objects = result_with_objects
                else:
                    result = result_with_objects
                    tracked_objects = None
                    
                logger.info(f"[Device {device_id}] Frame #{frame_count}, result: {result}, model time: {model_time:.4f}s")
                
                # 스트리밍 클라이언트가 있으면 프레임 전송 (처리된 프레임 사용)
                # 중요: 스트리밍은 결과 처리와 독립적으로 실행하여 주요 작업을 차단하지 않도록 함
                if device_id in streaming_clients and streaming_clients[device_id]:
                    # 스트리밍을 위한 프레임 복사 (원본 프레임 수정 방지)
                    stream_frame = processed_frame.copy()
                    # 스트리밍 작업은 'fire and forget' 방식으로 실행 (다른 작업을 차단하지 않음)
                    create_streaming_task(broadcast_frame(device_id, stream_frame, result, tracked_objects))
                
                # 결과가 이전과 다른 경우 처리
                result_changed = device_id not in last_device_results or result != last_device_results[device_id]
                was_in_event = device_event_states.get(device_id, False)
                
                # 결과 타입 확인
                is_normal = result == NORMAL_STATE
                is_alert = result in ALERT_STATES
                is_accident = result in ACCIDENT_STATES
                is_event_now = is_alert or is_accident  # 알림 또는 사고 상태인 경우 이벤트로 간주
                
                # 알림 또는 사고 상태일 때만 프레임 버퍼에 추가
                if is_event_now:
                    device_frame_buffers[device_id].append((current_time, processed_frame.copy()))
                
                # 정상 상태(0) 카운팅 로직
                if is_normal:
                    normal_state_frame_counts[device_id] += 1
                    
                    # 정상 상태가 연속 NORMAL_STATE_FLUSH_THRESHOLD프레임 이상 지속된 경우 버퍼 flush
                    if normal_state_frame_counts[device_id] >= NORMAL_STATE_FLUSH_THRESHOLD:
                        if device_frame_buffers[device_id]:
                            logger.info(f"[Device {device_id}] Normal state for {NORMAL_STATE_FLUSH_THRESHOLD} frames, flushing buffer")
                            device_frame_buffers[device_id].clear()
                            
                        # 이벤트 상태 종료 (이미 종료되지 않았다면)
                        if device_event_states.get(device_id, False):
                            device_event_states[device_id] = False
                            event_start_time = None
                            logger.info(f"[Device {device_id}] Event state ended after {NORMAL_STATE_FLUSH_THRESHOLD} normal frames")
                else:
                    # 정상 상태가 아니면 카운터 리셋
                    normal_state_frame_counts[device_id] = 0
                
                # 이벤트 상태 변화 감지 (정상 상태에서 연속 50프레임 이후가 아닌, 첫 전환 시점에 대한 처리)
                if is_event_now != was_in_event and (is_event_now or normal_state_frame_counts[device_id] < NORMAL_STATE_FLUSH_THRESHOLD):
                    if is_event_now:
                        # 이벤트 시작
                        logger.info(f"[Device {device_id}] Event started with result {result}")
                        device_event_states[device_id] = True
                        event_start_time = current_time
                    elif normal_state_frame_counts[device_id] < NORMAL_STATE_FLUSH_THRESHOLD:
                        # 정상 상태로 첫 전환 (카운팅 시작)
                        logger.info(f"[Device {device_id}] Event potentially ending, normal state frame count: {normal_state_frame_counts[device_id]}")
                        # 아직 버퍼는 유지, NORMAL_STATE_FLUSH_THRESHOLD 프레임 이후 flush 예정
                
                # 사고 상태로 변경된 경우 (알림 -> 사고)
                if is_accident and result_changed and last_device_results.get(device_id) in ALERT_STATES:
                    logger.info(f"[Device {device_id}] Alert escalated to accident with result {result}, saving buffer to Redis")
                    
                    # Redis에 버퍼 저장
                    if event_start_time:
                        redis_key = await save_buffer_to_redis(device_id, event_start_time)
                        
                        # 백엔드에 사고 알림 (Redis 키 포함)
                        if redis_key:
                            await notify_backend(device_id, result, redis_key)
                    
                    # 버퍼는 클리어하지 않고 계속 유지 (사고 지속 시간 동안 계속 기록)
                
                # 결과 처리 (이벤트 중이고 결과가 변경됐을 때만)
                if is_event_now and result_changed:
                    # 디바이스 2로 전송
                    async def send_to_device2():
                        target_device = 2
                        if target_device in state.clients:
                            try:
                                await state.clients[target_device].send_text(str(result))
                                logger.info(f"[Device {device_id}] Sent result {result} to device {target_device} via websocket")
                            except Exception as e:
                                logger.error(f"[Device {device_id}] Error sending to device {target_device}: {e}")
                
                    # 백엔드 알림 (알림 상태는 Redis 키 없이, 사고 상태는 이전에 이미 처리됨)
                    if is_alert:
                        notify_task = asyncio.create_task(notify_backend(device_id, result))
                        device2_task = asyncio.create_task(send_to_device2())
                        
                        # 작업 추적에 추가
                        pending_tasks = [notify_task, device2_task]
                    elif is_accident and not (last_device_results.get(device_id) in ACCIDENT_STATES):
                        # 사고 상태로 첫 전환 시 (이전 상태가 사고가 아닌 경우만)
                        device2_task = asyncio.create_task(send_to_device2())
                        pending_tasks = [device2_task]
                        
                        # 알림 -> 사고 전환은 이미 위에서 처리됨
                        # 사고 -> 다른 사고 유형으로 변경 시에는 추가 처리 없음
                    
                    # 결과 업데이트
                    last_device_results[device_id] = result
                    
                # 결과 처리 (0이 아닐 때만)
                # if result != 0:
                #     # Redis 저장 (비동기)
                #     async def save_to_redis():
                #         try:
                #             ret, buf = cv2.imencode('.jpg', processed_frame)
                #             if ret:
                #                 image_bytes = buf.tobytes()
                #                 key = f"device {device_id}:image:{int(time.time() * 1000)}_{current_img_count}"
                #                 await asyncio.to_thread(redis_client.set, key, image_bytes, ex=180)
                #                 logger.info(f"[Device {device_id}] Image saved to Redis with key {key}")
                #         except Exception as e:
                #             logger.error(f"[Device {device_id}] Redis error: {e}")
                    
                #     # 결과가 이전과 다른 경우에만 알림 처리
                #     result_changed = device_id not in last_device_results or result != last_device_results[device_id]
                    
                #     if result_changed:
                #         # 백엔드 알림 (비동기) - 결과가 변경됐을 때만
                #         async def send_notification():
                #             await notify_backend(device_id, result)
                        
                #         # 디바이스 2로 전송
                #         async def send_to_device2():
                #             target_device = 2
                #             if target_device in state.clients:
                #                 try:
                #                     await state.clients[target_device].send_text(str(result))
                #                     logger.info(f"[Device {device_id}] Sent result {result} to device {target_device} via websocket")
                #                 except Exception as e:
                #                     logger.error(f"[Device {device_id}] Error sending to device {target_device}: {e}")
                        
                #         # 결과 업데이트
                #         last_device_results[device_id] = result
                        
                #         # 비동기 작업 시작
                #         redis_task = asyncio.create_task(save_to_redis())
                #         notify_task = asyncio.create_task(send_notification())
                #         device2_task = asyncio.create_task(send_to_device2())
                        
                #         # 작업 추적에 추가
                #         pending_tasks = [redis_task, notify_task, device2_task]
                #     else:
                #         # 결과가 변경되지 않았을 때는 Redis만 저장
                #         redis_task = asyncio.create_task(save_to_redis())
                #         pending_tasks = [redis_task]
                #         logger.debug(f"[Device {device_id}] Skipping notifications - result unchanged: {result}")
                
                # FPS 계산 및 출력
                now = time.time()
                if frames_since_check >= 10 or now - last_fps_check >= 5:
                    fps = frames_since_check / (now - last_fps_check)
                    # logger.info(f"[Device {device_id}] Current FPS: {fps:.2f}, processed frames: {frame_count}")
                    frames_since_check = 0
                    last_fps_check = now
                
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] Task cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] Error: {e}", exc_info=True)
    finally:
        receiver_task.cancel()
        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)
        # if device_id in state.clients:
        #     state.clients.pop(device_id)
        # if device_id in last_device_results:
        #     del last_device_results[device_id]
        
        # 이벤트 중에 연결이 끊긴 경우 버퍼 처리
        if device_event_states.get(device_id, False) and event_start_time:
            # 마지막 결과가 사고 상태인 경우에만 Redis에 저장
            if device_id in last_device_results and last_device_results[device_id] in ACCIDENT_STATES:
                logger.info(f"[Device {device_id}] Device disconnected during accident, saving buffer to Redis")
                await save_buffer_to_redis(device_id, event_start_time)
            else:
                logger.info(f"[Device {device_id}] Device disconnected during alert (not accident), discarding buffer")
        
        # 상태 정리
        if device_id in state.clients:
            state.clients.pop(device_id)
        if device_id in last_device_results:
            del last_device_results[device_id]
        if device_id in device_event_states:
            del device_event_states[device_id]
        if device_id in normal_state_frame_counts:
            del normal_state_frame_counts[device_id]
        
        # 버퍼 정리
        if device_id in device_frame_buffers:
            device_frame_buffers[device_id].clear()
        
        # 연결된 모든 스트리밍 클라이언트에게 연결 종료 알림
        if device_id in streaming_clients:
            for client in list(streaming_clients[device_id]):
                try:
                    if client.application_state == WebSocketState.CONNECTED:
                        await client.send_text("device_disconnected")
                except Exception:
                    pass
        try:
            if websocket.application_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception as close_err:
            logger.debug(f"[Device {device_id}] Error during websocket close: {close_err}")
        total_time = time.time() - start_time
        avg_fps = frame_count / total_time if total_time > 0 else 0
        logger.info(f"[Device {device_id}] Disconnected, processed {frame_count} frames, avg FPS: {avg_fps:.2f}")

# 애플리케이션 시작/종료 이벤트 핸들러
async def startup_event():
    logger.info("Application started, HTTP client initialized")

async def shutdown_event():
    # 모든 스트리밍 태스크 취소
    for task in streaming_tasks:
        task.cancel()
    
    if streaming_tasks:
        await asyncio.gather(*streaming_tasks, return_exceptions=True)
    
    # 이벤트 중인 모든 디바이스의 버퍼 처리
    for device_id, is_in_event in device_event_states.items():
        if is_in_event and device_id in device_frame_buffers and device_frame_buffers[device_id]:
            # 마지막 결과가 사고 상태인 경우에만 Redis에 저장
            if device_id in last_device_results and last_device_results[device_id] in ACCIDENT_STATES:
                logger.info(f"[Device {device_id}] Saving buffer on shutdown (accident state)")
                await save_buffer_to_redis(device_id, time.time())
            else:
                logger.info(f"[Device {device_id}] Discarding buffer on shutdown (not in accident state)")
    
    # 모든 스트리밍 클라이언트 연결 종료
    for device_id in streaming_clients:
        for client in list(streaming_clients[device_id]):
            try:
                if client.application_state == WebSocketState.CONNECTED:
                    await client.close()
            except Exception:
                pass
    await http_client.aclose()
    logger.info("Application shutdown complete")