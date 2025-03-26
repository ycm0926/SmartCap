from fastapi import FastAPI

app = FastAPI(
    title="FastAPI SmartCap Server",
    description="똑똑캡 영상 분석 및 위험 감지 로직 서버입니다"
    )

@app.get("/")
async def root():
    return {"message": "FastAPI SmartCap Server is running!"}