# ============ 前端构建阶段 ============
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install
COPY web/ ./
RUN pnpm build

# ============ 后端构建阶段 ============
FROM golang:1.22-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/static ./static
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o kunpeng-server ./cmd/server/

# ============ 运行阶段 ============
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=backend /app/kunpeng-server .
COPY --from=backend /app/static ./static

EXPOSE 8080

ENV APP_ADDR=0.0.0.0:8080
ENV STORAGE_BACKEND=memory
ENV STATIC_DIR=./static

ENTRYPOINT ["./kunpeng-server"]
