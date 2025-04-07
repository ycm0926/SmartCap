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

# Nginx 설정 직접 추가
RUN rm /etc/nginx/conf.d/default.conf
RUN echo 'server { \
    listen       80; \
    listen  [::]:80; \
    server_name  localhost; \
    \
    location / { \
        root   /usr/share/nginx/html; \
        index  index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    \
    error_page   500 502 503 504  /50x.html; \
    location = /50x.html { \
        root   /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# 80 포트 노출
EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]
