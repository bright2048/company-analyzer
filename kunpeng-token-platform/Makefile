.PHONY: all build run dev frontend backend clean docker deploy

# 默认目标
all: build

# 完整构建（前端+后端）
build: frontend backend
	@echo "✅ 构建完成: bin/kunpeng-server"

# 仅构建后端
backend:
	@echo "🔨 编译Go后端..."
	go build -o bin/kunpeng-server ./cmd/server/

# 仅构建前端
frontend:
	@echo "🎨 构建前端..."
	cd web && pnpm install && pnpm build

# 开发模式运行
run: backend
	./bin/kunpeng-server

# 前端开发模式（热重载）
dev-frontend:
	cd web && pnpm dev

# Docker构建
docker:
	docker compose build

# Docker部署
deploy:
	chmod +x deploy/deploy.sh
	./deploy/deploy.sh deploy

# Docker停止
stop:
	docker compose down

# 查看日志
logs:
	docker compose logs -f

# 清理
clean:
	rm -rf bin/ static/ web/node_modules/
	@echo "🧹 清理完成"

# 帮助
help:
	@echo "鲲鹏Token汇聚平台 - 构建命令"
	@echo ""
	@echo "  make build      - 完整构建（前端+后端）"
	@echo "  make backend    - 仅构建后端"
	@echo "  make frontend   - 仅构建前端"
	@echo "  make run        - 编译并运行"
	@echo "  make docker     - Docker镜像构建"
	@echo "  make deploy     - Docker一键部署"
	@echo "  make stop       - 停止Docker服务"
	@echo "  make logs       - 查看Docker日志"
	@echo "  make clean      - 清理构建产物"
