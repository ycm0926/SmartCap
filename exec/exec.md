# 1. 개요

## 1.1 문서 목적

- **포팅 매뉴얼 작성 배경 및 목적**
    
    이 문서는 기존 프로젝트를 새로운 환경으로 포팅하기 위한 절차와 방법을 정리한 매뉴얼입니다. 포팅 대상 시스템의 특성과 요구사항에 따라 환경 설정 및 배포 방법을 제공함을 목적으로 합니다.
    
- **포팅 대상(시스템/프로젝트) 개요**
    
    똑똑캡(Smart-Cap)은 작업자 사각지대에 존재하는 각종 위험물 및 사고를 감지하고, 실시간 알림 및 대시보드 기능을 제공하는 스마트 안전모 시스템입니다. 작업자 에게 안전을 제공하고 관리자에게 위험, 사고에 대한 통계를 손쉽게 확인할 수 있는 것을 목표로 합니다. 
    

## 1.2 범위 및 구조

- **빌드 및 환경 구조**
    - 서버 환경: AWS ec2 (t2.xlarge)
    - 런타임: Java 17, Gradle 빌드 도구
    - 웹서버 및 WAS 제품 정보와 환경변수 설정 등 전반적인 빌드 환경 구성
- **문서 전체 구조 및 각 장(섹션)의 간략한 설명**
    1. **개요**: 문서의 목적, 대상 시스템 및 전체 구성 개요
    2. **GitLab 소스 클론 이후 빌드 및 배포**: 소스 코드 클론부터 빌드, 배포, 외부 서비스 연동까지의 상세 절차
    3. (이후 장에서는) 데이터베이스 구성, API 연동, 테스트 및 운영 가이드 등 추가적인 세부사항을 다룸

---

# 2. GitLab 소스 클론 이후 빌드 및 배포

## 2.1 GitLab 소스 클론

- 소스 코드 저장소:[s12-ai-image-sub1 / S12P21A102 · GitLab](https://lab.ssafy.com/s12-ai-image-sub1/S12P21A102)

## 2.2 빌드 환경 및 구성

### JVM, 웹서버, WAS 제품 정보

- **서버 환경**:
    - AWS ec2 (t2.xlarge)
    - 서비스 URL: https://j12a102.p.ssafy.io
- **Java Runtime**: Java 17

### 빌드 도구 및 환경 변수

- **빌드 도구**: Gradle 8.11.1
- **환경 설정 파일 (application.properties)**
    - **서버 설정**:
        
        ```properties
        spring.application.name=smartcap-back

        # PostgresSQL
        spring.datasource.url=${SPRING_DATASOURCE_URL}
        spring.datasource.username=${SPRING_DATASOURCE_USERNAME}
        spring.datasource.password=${SPRING_DATASOURCE_PASSWORD}
        spring.datasource.driver-class-name=${SPRING_DATASOURCE_DRIVER_CLASS_NAME}

        spring.jpa.properties.hibernate.dialect=org.hibernate.spatial.dialect.postgis.PostgisPG10Dialect

        # Redis
        spring.redis.host=${REDIS_HOST}
        spring.redis.port=${REDIS_PORT}
        spring.redis.database=${REDIS_DB}
        spring.redis.password=${REDIS_PASSWORD}

        # AWS ec2
        AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
        AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
        aws.region=${AWS_REGION:ap-northeast-2}

        # AWS S3
        s3.bucket-name=${S3_BUCKET_NAME}
        s3.folder=${S3_FOLDER}

        # Weather API
        weather.api.key=${WEATHER_API_KEY}
        weather.api.url=https://api.openweathermap.org/data/2.5/weather
        weather.update.interval=3600000

        # Redis
        weather.redis.ttl=7200

        front.url=${FRONT_URL}
        fastapi.url=${FASTAPI_URL}
        ```
        
- **프론트 .env.local 파일 예시**
    
    ```
    # .env.local
    VITE_API_BASE_URL=http://localhost:8080
    ```

- **GPU .env 파일 예시**
    ```
    # .env
    REDIS_HOST=
    REDIS_PORT=
    REDIS_DB=0
    REDIS_PASSWORD=

    BACKEND_SERVER_HOST=

    BACKEND_API_USER=
    BACKEND_API_PASSWORD=
    ```    

## 2.3 배포 및 특이사항

- **배포**:
    - 자동 배포 시스템 적용.
    - AWS, Docker, Jenkins를 활용한 지속적 배포(CI/CD) 환경 구축 및 Portainer를 통한 컨테이너 모니터링 및 관리 환경 구성.

- **GPU 서버**:
  - Vast.ai 플랫폼에서 GPU 서버를 임시 대여하여 AI 추론 환경 구성 및 원격 연동을 통한 모델 추론 수행.

## 2.4 데이터베이스(DB) 정보

- **DBMS**: PostgreSQL 17.4
- **테이블 구조 및 주요 작업 프로시저**: 자세한 내용은 [테이블 구조(ERD) 및 주요 작업 프로시저(Stored Procedure) 목록](https://www.erdcloud.com/d/f8iNCkwcRfugw4sqa)를 참고

## 2.5 외부 서비스 연동 정보

- **기타 외부 API/서비스**:
    - Weather API
- **문의처**:
    - 임태훈: [xogns9647@naver.com](mailto:xogns9647@naver.com)