# 빌드 환경 설정
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사 (의존성 설치 위해)
COPY package*.json ./
# npm 의존성 설치
RUN npm install

# 프로젝트의 모든 소스 파일을 작업 디렉토리로 복사
COPY . .

# Vue/React 프로젝트를 빌드하여 dist 폴더에 정적 파일 생성
RUN npm run build

# nginx 이미지 사용
FROM nginx:alpine

# 빌드 스테이지에서 생성된 dist 폴더 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 기본 nginx 설정 삭제
RUN rm /etc/nginx/conf.d/default.conf

# 커스텀 nginx 설정 복사
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 80 포트 노출
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]