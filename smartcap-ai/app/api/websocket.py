import asyncio
import logging
from fastapi import WebSocket

from app.api.handlers.video_handler import handle_video_device
from app.api.handlers.gps_handler import handle_gps_device

logger = logging.getLogger(__name__)

async def websocket_endpoint(websocket: WebSocket, device_id: str):
    await websocket.accept()
    logger.info(f"[Device {device_id}] Connection accepted")

    if device_id == "1":
        await handle_video_device(websocket, device_id)
    elif device_id == "2":
        await handle_gps_device(websocket, device_id)
