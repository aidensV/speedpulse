# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o speedtest .

# Production Minimal Image (Scratch / Distroless / Alpine)
FROM alpine:3.20

WORKDIR /app

# Install CA certificates for HTTPS if needed
RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/speedtest /app/speedtest

EXPOSE 8080

CMD ["/app/speedtest", "-port", "8080", "-host", "0.0.0.0"]
