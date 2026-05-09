FROM alpine:3.22

RUN apk add --no-cache g++ ca-certificates libstdc++ \
  && adduser -D -u 10001 runner

RUN cat <<'EOF' >/usr/local/bin/cpp-runner
#!/bin/sh
set -eu

SOURCE_DIR="${SOURCE_DIR:-/workspace}"
SOURCE_FILE="${SOURCE_FILE:-main.cpp}"
OUTPUT_FILE="${OUTPUT_FILE:-main}"
TMPDIR="$(mktemp -d /tmp/cpp-runner-XXXXXX)"

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT INT TERM

cp "$SOURCE_DIR/$SOURCE_FILE" "$TMPDIR/$SOURCE_FILE"
cd "$TMPDIR"
g++ "$SOURCE_FILE" -O2 -std=c++20 -pipe -o "$OUTPUT_FILE"
exec "./$OUTPUT_FILE"
EOF

RUN chmod +x /usr/local/bin/cpp-runner

USER runner
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/cpp-runner"]
