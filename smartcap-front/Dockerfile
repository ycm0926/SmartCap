# 1단계: 빌드 단계
FROM node:18-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 파일 복사
COPY . .

# 앱 빌드 (Vue 또는 React)
RUN VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build

# 2단계: Nginx 설정
FROM nginx:alpine

# 빌드된 파일을 Nginx HTML 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 80 포트 노출
EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]
