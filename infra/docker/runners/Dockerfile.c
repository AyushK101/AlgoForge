FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 runner
USER runner
WORKDIR /workspace
ENTRYPOINT ["gcc", "--version"]
