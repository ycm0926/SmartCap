import logging
from fastapi import WebSocket
from app.api import state  # 전역 상태 관리

logger = logging.getLogger(__name__)

async def handle_command_device(websocket: WebSocket, device_id: int):
    """
    장치 ID 3에 대한 명령 처리, 데이터를 장치 2로 전달
    
    Args:
        websocket (WebSocket): WebSocket 연결
        device_id (int): 현재 장치의 ID
    """
    try:
        while True:
            # WebSocket에서 데이터 수신
            data = await websocket.receive_text()
            
            # 데이터를 전달할 대상 장치 (장치 2)
            target_device = 2
            
            # 대상 장치의 연결 상태 확인
            if target_device in state.clients:
                try:
                    # 수신된 데이터를 장치 2로 전달
                    await state.clients[target_device].send_text(str(data))
                    logger.info(f"[장치 {device_id}] WebSocket을 통해 데이터 {data}를 장치 {target_device}로 전송")
                except Exception as e:
                    logger.error(f"[장치 {device_id}] 장치 {target_device}로 전송 중 오류 발생: {e}")
            else:
                logger.warning(f"[장치 {device_id}] 대상 장치 {target_device}가 연결되어 있지 않습니다")
    
    except Exception as e:
        logger.error(f"[장치 {device_id}] WebSocket 오류: {e}")
        # 필요에 따라 추가 오류 처리 또는 정리 작업 가능
    finally:
        # WebSocket을 안전하게 닫기
        await websocket.close()