from app.core.logging_config import setup_logging
setup_logging() # 최상단에 위치시켜야 로그 설정적용됨
from fastapi import FastAPI, WebSocket
from app.api.websocket import websocket_endpoint
from app.api.routes.video_streaming import router as streaming_router

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

# 스트리밍 라우터 등록
app.include_router(streaming_router)