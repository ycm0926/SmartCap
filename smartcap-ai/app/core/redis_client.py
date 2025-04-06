import os
import redis
from dotenv import load_dotenv

# .env 파일 명시적으로 로드
load_dotenv()

# 환경 변수에서 Redis 관련 정보를 읽어옵니다.
REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD")  # 기본값 None

# Redis 클라이언트 생성
redis_client = redis.StrictRedis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    socket_timeout=10  # 필요에 따라 타임아웃 값 설정
)