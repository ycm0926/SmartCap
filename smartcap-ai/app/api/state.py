from collections import deque

clients = {}          # device_id: WebSocket 객체 저장
frame_queues = {}     # 영상 디바이스("1")의 프레임을 저장하는 deque
processing_tasks = {} # 영상 디바이스("1")의 백그라운드 프레임 처리 작업
MAX_QUEUE_SIZE = 500  # 프레임 큐 최대 크기
SAVE_IMAGES_TO_REDIS = False  # 이미지 Redis 저장 플래그
