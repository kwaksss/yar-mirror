# syntax=docker/dockerfile:1
# yar-mirror 백엔드 운영 이미지 (멀티스테이지).
# GitHub Actions(ubuntu, amd64)에서 빌드해 GHCR에 push하고, Lightsail(x86_64)에서 pull해 실행한다.

FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# 의존성 레이어를 소스와 분리해 캐시 적중률을 높인다.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null

COPY src src
RUN ./gradlew --no-daemon bootJar -x test \
    && find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} /workspace/app.jar \;

FROM eclipse-temurin:17-jre
WORKDIR /app

# root가 아닌 사용자로 실행한다.
RUN groupadd --system app && useradd --system --gid app --uid 1001 app
COPY --from=build /workspace/app.jar /app/app.jar
USER app

ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
