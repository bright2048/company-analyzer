#!/bin/bash
set -e

# ============================================
# 鲲鹏Token汇聚平台 - 一键部署脚本
# ============================================

echo "=== 鲲鹏Token汇聚平台 部署脚本 ==="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}[ERROR] Docker未安装，请先安装Docker${NC}"
        echo "安装命令: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    if ! command -v docker compose &> /dev/null; then
        echo -e "${RED}[ERROR] Docker Compose未安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}[OK] Docker已安装${NC}"
}

# 生成配置
setup_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}[INFO] 创建.env配置文件...${NC}"
        
        # 生成随机管理员令牌
        ADMIN_TOKEN="kp-admin-$(openssl rand -hex 16)"
        
        cat > .env << EOF
# 鲲鹏Token汇聚平台 配置
# 请修改以下配置后再启动

# 服务监听地址
APP_ADDR=0.0.0.0:8080

# 平台管理员令牌（请务必修改！）
PLATFORM_ADMIN_TOKEN=${ADMIN_TOKEN}

# 存储后端: memory (开发) 或 sqlite (生产)
STORAGE_BACKEND=memory

# 日志级别: debug, info, warn, error
LOG_LEVEL=info
EOF
        echo -e "${GREEN}[OK] .env文件已创建${NC}"
        echo -e "${YELLOW}[IMPORTANT] 管理员令牌: ${ADMIN_TOKEN}${NC}"
        echo -e "${YELLOW}请妥善保管此令牌，用于登录管理后台${NC}"
    else
        echo -e "${GREEN}[OK] .env文件已存在${NC}"
    fi
}

# 构建并启动
start_service() {
    echo -e "${YELLOW}[INFO] 构建Docker镜像...${NC}"
    docker compose build --no-cache
    
    echo -e "${YELLOW}[INFO] 启动服务...${NC}"
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  鲲鹏Token汇聚平台 部署成功！${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "  访问地址: http://$(hostname -I | awk '{print $1}'):8080"
    echo "  健康检查: http://$(hostname -I | awk '{print $1}'):8080/api/health"
    echo ""
    echo "  管理后台: http://$(hostname -I | awk '{print $1}'):8080/admin/login"
    echo "  管理令牌: 见.env文件中的PLATFORM_ADMIN_TOKEN"
    echo ""
    echo -e "${YELLOW}  提示: 首次使用请在管理后台添加真实供应商${NC}"
    echo ""
}

# 停止服务
stop_service() {
    echo -e "${YELLOW}[INFO] 停止服务...${NC}"
    docker compose down
    echo -e "${GREEN}[OK] 服务已停止${NC}"
}

# 查看日志
show_logs() {
    docker compose logs -f --tail=100
}

# 主流程
case "${1:-deploy}" in
    deploy|start)
        check_docker
        setup_env
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        start_service
        ;;
    logs)
        show_logs
        ;;
    status)
        docker compose ps
        ;;
    *)
        echo "用法: $0 {deploy|start|stop|restart|logs|status}"
        exit 1
        ;;
esac
