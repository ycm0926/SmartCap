# app/core/redis_client.py
import os
import redis
from dotenv import load_dotenv

# .env 파일에 저장된 환경 변수 로드
load_dotenv()

redis_host = os.getenv("REDIS_HOST")
redis_port = int(os.getenv("REDIS_PORT", 6379))
redis_db   = int(os.getenv("REDIS_DB", 0))

# Redis 클라이언트 초기화
redis_client = redis.Redis(host=redis_host, port=redis_port, db=redis_db)
