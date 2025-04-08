from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import logging

# 기존 핸들러 함수 임포트
from app.api.handlers.video_handler import handle_video_device

# 새로 추가된 스트리밍 클라이언트 핸들러 임포트
from app.api.handlers.video_handler import handle_streaming_client

logger = logging.getLogger(__name__)

router = APIRouter()

# HTML 응답을 직접 반환하는 간단한 엔드포인트
@router.get("/stream", response_class=HTMLResponse)
async def get_stream_page():
    """실시간 스트리밍 페이지 제공"""
    
    html_content = """
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>실시간 영상 스트리밍</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 2000px;
                margin: 0 auto;
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            h1 {
                color: #333;
                margin-top: 0;
                text-align: center;
            }
            .device-container {
                margin-bottom: 30px;
            }
            h2 {
                text-align: center;
            }
            .stream-container {
                position: relative;
                margin: 0 auto;
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                width: 960px;
                height: 1280px;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #000;
            }
            .video-stream {
                display: block;
                width: 960px;
                height: 1280px;
                object-fit: contain;
            }
            .status-badge {
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10;
            }
            .status-connected {
                background-color: #4CAF50;
                color: white;
            }
            .status-disconnected {
                background-color: #f44336;
                color: white;
            }
            .status-connecting {
                background-color: #ff9800;
                color: white;
            }
            .control-panel {
                margin-top: 15px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            button {
                padding: 8px 15px;
                background-color: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }
            button:hover {
                background-color: #0b7dda;
            }
            button:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            .stream-stats {
                margin-top: 10px;
                font-size: 14px;
                color: #666;
                text-align: center;
            }
            .log-container {
                margin-top: 20px;
                height: 150px;
                overflow-y: auto;
                background-color: #f9f9f9;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
            }
            .log-entry {
                margin: 5px 0;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
            }
            .info {
                color: #2196F3;
            }
            .error {
                color: #f44336;
            }
            .warning {
                color: #ff9800;
            }
            
            /* 반응형 레이아웃도 조정 */
            @media (max-width: 900px) {
                .container {
                    padding: 15px;
                }
                .stream-container {
                    width: 100%;
                    height: auto;
                    aspect-ratio: 4/3;
                }
                .video-stream {
                    width: 100%;
                    height: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>실시간 영상 스트리밍</h1>
            
            <div class="device-container" id="device23">
                <div class="stream-container">
                    <img id="videoStream23" class="video-stream" alt="디바이스 23 스트림" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
                    <div id="status23" class="status-badge status-disconnected">연결 안됨</div>
                </div>
                <div class="stream-stats" id="stats23">
                    FPS: - | 해상도: - | 품질: -
                </div>
                <div class="control-panel">
                    <button id="connectBtn23" onclick="connectToStream(23)">연결</button>
                    <button id="disconnectBtn23" onclick="disconnectFromStream(23)" disabled>연결 해제</button>
                </div>
            </div>
            
            <div class="log-container" id="logContainer">
                <div class="log-entry info">로그: 시스템 초기화 완료</div>
            </div>
        </div>

        <script>
            // 웹소켓 연결 객체
            const streamConnections = {};
            
            // 통계 추적
            const streamStats = {
                23: { frameCount: 0, startTime: null, lastFrameTime: null, resolution: '-', quality: '-' }
            };
            
            // FPS 계산 간격 (밀리초)
            const FPS_CALC_INTERVAL = 1000;
            
            // 로그 함수
            function addLog(message, type = 'info') {
                const logContainer = document.getElementById('logContainer');
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${type}`;
                logEntry.textContent = `로그: ${message}`;
                logContainer.appendChild(logEntry);
                logContainer.scrollTop = logContainer.scrollHeight;
                
                // 로그 항목 제한 (최대 50개)
                while (logContainer.children.length > 50) {
                    logContainer.removeChild(logContainer.firstChild);
                }
            }
            
            // 통계 업데이트
            function updateStats(deviceId) {
                const stats = streamStats[deviceId];
                const statsElement = document.getElementById(`stats${deviceId}`);
                
                if (!stats.startTime) {
                    statsElement.textContent = `FPS: - | 해상도: ${stats.resolution} | 품질: ${stats.quality}`;
                    return;
                }
                
                const now = performance.now();
                const elapsedSecs = (now - stats.startTime) / 1000;
                const fps = elapsedSecs > 0 ? (stats.frameCount / elapsedSecs).toFixed(1) : '-';
                
                statsElement.textContent = `FPS: ${fps} | 해상도: ${stats.resolution} | 품질: ${stats.quality}`;
                
                // 30초마다 FPS 재설정
                if (elapsedSecs > 30) {
                    stats.frameCount = 0;
                    stats.startTime = now;
                }
            }
            
            // 연결 상태 업데이트
            function updateConnectionStatus(deviceId, status) {
                const statusElement = document.getElementById(`status${deviceId}`);
                const connectBtn = document.getElementById(`connectBtn${deviceId}`);
                const disconnectBtn = document.getElementById(`disconnectBtn${deviceId}`);
                
                statusElement.className = `status-badge status-${status}`;
                
                switch(status) {
                    case 'connected':
                        statusElement.textContent = '연결됨';
                        connectBtn.disabled = true;
                        disconnectBtn.disabled = false;
                        break;
                    case 'disconnected':
                        statusElement.textContent = '연결 안됨';
                        connectBtn.disabled = false;
                        disconnectBtn.disabled = true;
                        
                        // 통계 초기화
                        streamStats[deviceId] = { frameCount: 0, startTime: null, lastFrameTime: null, resolution: '-', quality: '-' };
                        updateStats(deviceId);
                        break;
                    case 'connecting':
                        statusElement.textContent = '연결 중...';
                        connectBtn.disabled = true;
                        disconnectBtn.disabled = false;
                        break;
                }
            }
            
            // 스트림 연결
            function connectToStream(deviceId) {
                if (streamConnections[deviceId]) {
                    return;
                }
                
                updateConnectionStatus(deviceId, 'connecting');
                addLog(`디바이스 ${deviceId}에 연결 시도 중...`);
                
                // WebSocket 프로토콜 결정
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/api/stream/${deviceId}`;
                
                try {
                    const ws = new WebSocket(wsUrl);
                    streamConnections[deviceId] = ws;
                    
                    ws.onopen = function() {
                        addLog(`디바이스 ${deviceId}에 연결됨`, 'info');
                        updateConnectionStatus(deviceId, 'connected');
                        
                        // 통계 초기화
                        streamStats[deviceId].startTime = performance.now();
                    };
                    
                    ws.onmessage = function(event) {
                        const data = event.data;
                        
                        // 특수 메시지 처리
                        if (data === 'ping') {
                            ws.send('pong'); // heartbeat 응답
                            return;
                        }
                        
                        if (data === 'device_disconnected') {
                            addLog(`디바이스 ${deviceId}가 연결이 끊겼습니다`, 'warning');
                            document.getElementById(`videoStream${deviceId}`).src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
                            return;
                        }
                        
                        // 이미지 데이터 처리
                        if (data.startsWith('data:image')) {
                            const imgElement = document.getElementById(`videoStream${deviceId}`);
                            imgElement.src = data;
                            
                            // 이미지 로드 시 해상도 업데이트 (비율 유지하며 640x480으로 표시)
                            imgElement.onload = function() {
                                // 원본 해상도 표시
                                streamStats[deviceId].resolution = `${this.naturalWidth}x${this.naturalHeight}`;
                                
                                // JPEG 품질 추정 (파일 크기 기반)
                                const base64Data = data.split(',')[1];
                                const approxBytes = (base64Data.length * 3) / 4;
                                const qualityLevel = approxBytes < 30000 ? '낮음' : approxBytes < 60000 ? '중간' : '높음';
                                streamStats[deviceId].quality = qualityLevel;
                                
                                // 프레임 카운터 증가
                                streamStats[deviceId].frameCount++;
                                streamStats[deviceId].lastFrameTime = performance.now();
                                
                                // 통계 업데이트
                                updateStats(deviceId);
                            }
                        }
                    };
                    
                    ws.onclose = function() {
                        addLog(`디바이스 ${deviceId} 연결 종료`, 'info');
                        updateConnectionStatus(deviceId, 'disconnected');
                        delete streamConnections[deviceId];
                    };
                    
                    ws.onerror = function(error) {
                        addLog(`디바이스 ${deviceId} 연결 오류: ${error.message || '알 수 없는 오류'}`, 'error');
                        updateConnectionStatus(deviceId, 'disconnected');
                    };
                    
                } catch (error) {
                    addLog(`연결 실패: ${error.message}`, 'error');
                    updateConnectionStatus(deviceId, 'disconnected');
                }
            }
            
            // 스트림 연결 해제
            function disconnectFromStream(deviceId) {
                if (streamConnections[deviceId]) {
                    streamConnections[deviceId].close();
                    addLog(`디바이스 ${deviceId} 연결 해제 요청됨`, 'info');
                }
            }
            
            // 페이지 언로드 시 연결 정리
            window.addEventListener('beforeunload', function() {
                for (const deviceId in streamConnections) {
                    if (streamConnections[deviceId]) {
                        streamConnections[deviceId].close();
                    }
                }
            });
            
            // 시스템 초기화
            document.addEventListener('DOMContentLoaded', function() {
                addLog('페이지 로드 완료, 시스템 준비됨');
            });
        </script>
    </body>
    </html>
    """
    return html_content


# 스트리밍 클라이언트 웹소켓 엔드포인트 추가
@router.websocket("/api/stream/{device_id}")
async def stream_endpoint(websocket: WebSocket, device_id: int):
    """프론트엔드 스트리밍 클라이언트를 위한 웹소켓 엔드포인트"""
    await websocket.accept()
    logger.info(f"Streaming client connected for device {device_id}")
    try:
        await handle_streaming_client(websocket, device_id)
    except WebSocketDisconnect:
        logger.info(f"Streaming client for device {device_id} disconnected")
    except Exception as e:
        logger.error(f"Error in streaming client for device {device_id}: {e}")