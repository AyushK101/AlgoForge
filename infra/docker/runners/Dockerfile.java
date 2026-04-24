FROM eclipse-temurin:17-jdk-jammy
RUN useradd --create-home --uid 10001 runner
USER runner
WORKDIR /workspace
ENTRYPOINT ["java", "-version"]
