from fastapi import FastAPI, WebSocket
from app.api.websocket import websocket_endpoint
from app.core.logging_config import setup_logging


app = FastAPI(
    title="FastAPI SmartCap Server",
    description="똑똑캡 영상 분석 및 위험 감지 로직 서버입니다"
    )

@app.get("/")
async def root():
    return {"message": "FastAPI SmartCap Server is running!"}

@app.websocket("/ws/{device_id}")
async def websocket_endpoint_handler(websocket: WebSocket, device_id: str):
    """ESP 장치와 WebSocket 연결을 관리"""
    await websocket_endpoint(websocket, device_id)