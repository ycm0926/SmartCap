import asyncio
import logging

from app.core.redis_client import redis_client
from app.api import state

logger = logging.getLogger(__name__)

async def save_gps_data(device_id: str):
    """
    10초마다 고정 좌표값(lat: 37.502, lng: 127.04)을 Redis에 저장하는 태스크.
    """
    try:
        while True:
            try:
                redis_client.hset(device_id, mapping={"lat": 37.502, "lng": 127.04})
                logger.info(f"[Device {device_id}] Periodic GPS update saved.")
            except Exception as e:
                logger.error(f"[Device {device_id}] Error during periodic GPS update: {e}")
            await asyncio.sleep(10)
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] save_gps_data cancelled")
        # 정상 종료

async def handle_gps_device(websocket, device_id: str):
    state.clients[device_id] = websocket
    logger.info(f"[Device {device_id}] GPS device connected")
    gps_update_task = asyncio.create_task(save_gps_data(device_id))

    try:
        while True:
            await asyncio.sleep(1)  # 간단한 keep-alive 루프
    except asyncio.CancelledError:
        logger.info(f"[Device {device_id}] handle_gps_device cancelled")
    except Exception as e:
        logger.error(f"[Device {device_id}] GPS WebSocket error: {e}")
    finally:
        gps_update_task.cancel()
        state.clients.pop(device_id, None)
        logger.info(f"[Device {device_id}] GPS device disconnected")
