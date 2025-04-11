# 빌드 스테이지 정의 (builder라는 이름의 스테이지)
# OpenJDK 17 Alpine 이미지를 빌드 환경으로 사용
FROM openjdk:17-alpine AS builder

# Gradle Wrapper 스크립트 복사
# 빌드에 필요한 Gradle 래퍼 스크립트를 컨테이너로 복사
COPY gradlew .

# Gradle 디렉토리 복사
# Gradle 래퍼 실행에 필요한 Gradle 관련 디렉토리 복사
COPY gradle gradle

# 빌드 설정 파일 복사
# Gradle 빌드 설정 파일들을 컨테이너로 복사
COPY build.gradle .
COPY settings.gradle .

# 소스 코드 복사
# 프로젝트의 전체 소스 코드를 컨테이너로 복사
COPY src src

# Gradle Wrapper 실행 권한 부여
# 빌드 스크립트에 실행 권한 추가
RUN chmod +x ./gradlew

# JAR 파일 빌드
# Gradle을 사용하여 실행 가능한 JAR 파일 생성 (테스트 제외)
RUN ./gradlew bootJAR

# 런타임 스테이지 정의
# 가볍고 효율적인 Alpine 기반 OpenJDK 17 이미지 사용
FROM openjdk:17-alpine

# 빌드 스테이지에서 생성된 JAR 파일 복사
# 이전 빌드 스테이지에서 생성된 JAR 파일을 현재 이미지로 복사
COPY --from=builder build/libs/*.jar app.jar

# 컨테이너 실행 시 진입점(ENTRYPOINT) 설정
# Java 명령어로 JAR 파일 실행
# -Duser.timezone=Asia/Seoul: 서버 시간대를 서울로 설정
# -Dspring.profiles.active=prod: 프로덕션 환경 프로필 활성화
ENTRYPOINT ["java", "-jar", "-Duser.timezone=Asia/Seoul", "-Dspring.profiles.active=prod", "app.jar"]
