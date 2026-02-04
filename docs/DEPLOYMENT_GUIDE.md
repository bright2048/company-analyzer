# 数智深圳湾智能体（KunLing CIS）部署方案

**版本**: 5.1  
**更新日期**: 2025年1月9日  
**作者**: Manus AI

---

## 目录

1. [系统概述](#1-系统概述)
2. [技术架构](#2-技术架构)
3. [环境要求](#3-环境要求)
4. [Manus 平台部署（推荐）](#4-manus-平台部署推荐)
5. [自托管部署方案](#5-自托管部署方案)
6. [数据库配置](#6-数据库配置)
7. [环境变量配置](#7-环境变量配置)
8. [安全配置](#8-安全配置)
9. [监控与运维](#9-监控与运维)
10. [常见问题排查](#10-常见问题排查)

---

## 1. 系统概述

数智深圳湾智能体（KunLing CIS）是一个企业智能分析平台，基于 AI 大模型技术，为用户提供企业调研报告的智能生成服务。系统支持单个企业查询和批量查询（CSV导入），报告生成采用后台任务模式，避免用户长时间等待。

### 1.1 核心功能

| 功能模块     | 描述                                                |
| ------------ | --------------------------------------------------- |
| 单企业查询   | 输入企业名称，AI 自动搜索并生成分析报告             |
| 批量查询     | 上传 CSV 文件，后台异步生成多个企业报告（最多50个） |
| 任务管理     | 查看批量任务进度、历史记录，支持删除和打包下载      |
| 园区企业管理 | 管理园区入驻企业信息，支持批量导入                  |
| 报告导出     | 支持 Word/PDF 格式导出                              |

### 1.2 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **后端**: Node.js + Express + tRPC 11
- **数据库**: MySQL / TiDB
- **AI 服务**: Manus Forge API（LLM 调用）
- **文件存储**: S3 兼容存储

---

## 2. 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx / CDN                              │
│              (反向代理 + SSL 终止 + 静态资源)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js 应用服务器                         │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Vite 前端     │  │  Express + tRPC │                   │
│  │   (React SPA)   │  │   (API 服务)    │                   │
│  └─────────────────┘  └────────┬────────┘                   │
└────────────────────────────────┼────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MySQL/TiDB    │    │  Manus Forge    │    │   S3 存储       │
│   (数据持久化)   │    │  (AI 服务)      │    │  (文件存储)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 3. 环境要求

### 3.1 服务器配置

| 配置项   | 最低要求                  | 推荐配置         |
| -------- | ------------------------- | ---------------- |
| CPU      | 2 核                      | 4 核及以上       |
| 内存     | 4 GB                      | 8 GB 及以上      |
| 磁盘     | 40 GB SSD                 | 100 GB SSD       |
| 带宽     | 5 Mbps                    | 10 Mbps 及以上   |
| 操作系统 | Ubuntu 20.04+ / CentOS 7+ | Ubuntu 22.04 LTS |

### 3.2 软件依赖

| 软件    | 版本要求     | 用途                 |
| ------- | ------------ | -------------------- |
| Node.js | 18.x 或 22.x | 运行时环境           |
| pnpm    | 8.x+         | 包管理器             |
| MySQL   | 8.0+         | 数据库（或 TiDB）    |
| Nginx   | 1.18+        | 反向代理（可选）     |
| PM2     | 5.x+         | 进程管理（生产环境） |

---

## 4. Manus 平台部署（推荐）

Manus 平台提供一键部署功能，是最简单的部署方式。

### 4.1 部署步骤

1. **创建检查点**: 在开发完成后，使用 Manus 工具保存检查点
2. **点击发布**: 在 Manus 管理界面点击 "Publish" 按钮
3. **配置域名**:
   - 使用自动分配的 `xxx.manus.space` 域名
   - 或绑定自定义域名（在 Settings → Domains 中配置）
4. **配置环境变量**: 在 Settings → Secrets 中配置必要的环境变量

### 4.2 Manus 平台优势

- **零运维**: 自动处理服务器、SSL证书、CDN等基础设施
- **自动扩缩容**: 根据流量自动调整资源
- **内置数据库**: 提供托管的 MySQL/TiDB 数据库
- **内置存储**: 提供 S3 兼容的文件存储
- **一键回滚**: 支持回滚到任意历史检查点

### 4.3 域名配置

在 Manus 平台中，您可以：

1. 使用默认域名：`your-project.manus.space`
2. 自定义域名前缀：修改 `xxx` 部分
3. 绑定自有域名：添加 CNAME 记录指向 Manus 提供的地址

---

## 5. 自托管部署方案

如果您需要在自己的服务器上部署，请按以下步骤操作。

### 5.1 准备工作

```bash
# 1. 安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 pnpm
npm install -g pnpm

# 3. 安装 PM2（进程管理）
npm install -g pm2

# 4. 安装 Nginx（可选，用于反向代理）
sudo apt-get install -y nginx
```

### 5.2 获取代码

```bash
# 从 Git 仓库克隆代码
git clone https://github.com/bright2048/company-analyzer.git
cd company-analyzer

# 安装依赖
pnpm install
```

### 5.3 配置环境变量

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=mysql://user:password@host:3306/database_name

# JWT 密钥（用于会话签名，请使用随机字符串）
JWT_SECRET=your-random-secret-key-at-least-32-characters

# Manus OAuth 配置（如果使用 Manus 登录）
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/login

# AI 服务配置
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key

# 文件存储配置（S3 兼容）
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1

# 应用配置
NODE_ENV=production
PORT=3000
```

### 5.4 数据库初始化

```bash
# 推送数据库 Schema
pnpm db:push
```

### 5.5 构建生产版本

```bash
# 构建前端和后端
pnpm build
```

### 5.6 启动服务

**方式一：使用 PM2（推荐）**

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kunling-cis',
    script: 'dist/server/_core/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    time: true
  }]
}
EOF

# 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 save
pm2 startup
```

**方式二：直接运行**

```bash
NODE_ENV=production node dist/server/_core/index.js
```

### 5.7 Nginx 反向代理配置

```nginx
# /etc/nginx/sites-available/kunling-cis
server {
    listen 80;
    server_name your-domain.com;

    # 强制 HTTPS 跳转
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 请求体大小限制（支持文件上传）
    client_max_body_size 50M;

    # 静态资源缓存
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 和其他请求
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时配置（报告生成可能需要较长时间）
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/kunling-cis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.8 SSL 证书配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期（Certbot 会自动配置）
sudo certbot renew --dry-run
```

---

## 6. 数据库配置

### 6.1 MySQL 配置

```sql
-- 创建数据库
CREATE DATABASE kunling_cis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'kunling'@'%' IDENTIFIED BY 'your-strong-password';

-- 授权
GRANT ALL PRIVILEGES ON kunling_cis.* TO 'kunling'@'%';
FLUSH PRIVILEGES;
```

### 6.2 数据库连接字符串格式

```
mysql://username:password@host:port/database?ssl=true
```

### 6.3 数据库表结构

系统使用 Drizzle ORM 管理数据库 Schema，主要表结构如下：

| 表名                 | 用途         |
| -------------------- | ------------ |
| `users`              | 用户信息     |
| `park_companies`     | 园区企业信息 |
| `company_reports`    | 企业分析报告 |
| `batch_tasks`        | 批量任务记录 |
| `data_source_config` | 数据源配置   |

运行 `pnpm db:push` 会自动创建所有表结构。

---

## 7. 环境变量配置

### 7.1 必需环境变量

| 变量名                   | 描述                       | 示例                             |
| ------------------------ | -------------------------- | -------------------------------- |
| `DATABASE_URL`           | 数据库连接字符串           | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET`             | JWT 签名密钥（至少32字符） | `your-random-secret-key...`      |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API 密钥       | `sk-xxx`                         |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API 地址       | `https://forge.manus.im`         |

### 7.2 可选环境变量

| 变量名           | 描述          | 默认值             |
| ---------------- | ------------- | ------------------ |
| `PORT`           | 服务端口      | `3000`             |
| `NODE_ENV`       | 运行环境      | `development`      |
| `VITE_APP_TITLE` | 应用标题      | `数智深圳湾智能体` |
| `VITE_APP_LOGO`  | 应用 Logo URL | -                  |

### 7.3 S3 存储配置（自托管需要）

| 变量名          | 描述        |
| --------------- | ----------- |
| `S3_ENDPOINT`   | S3 端点地址 |
| `S3_BUCKET`     | 存储桶名称  |
| `S3_ACCESS_KEY` | 访问密钥    |
| `S3_SECRET_KEY` | 密钥        |
| `S3_REGION`     | 区域        |

---

## 8. 安全配置

### 8.1 安全检查清单

- [ ] 使用 HTTPS（SSL/TLS）加密所有通信
- [ ] 设置强密码的 `JWT_SECRET`
- [ ] 数据库使用强密码并限制访问 IP
- [ ] 定期更新系统和依赖包
- [ ] 配置防火墙，只开放必要端口（80, 443）
- [ ] 启用数据库 SSL 连接
- [ ] 配置请求速率限制

### 8.2 防火墙配置

```bash
# 使用 UFW 配置防火墙
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 8.3 安全头配置

在 Nginx 中添加安全头：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
```

---

## 9. 监控与运维

### 9.1 日志管理

```bash
# PM2 日志查看
pm2 logs kunling-cis

# 实时日志
pm2 logs kunling-cis --lines 100

# 日志轮转配置
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 9.2 健康检查

创建健康检查脚本：

```bash
#!/bin/bash
# health-check.sh

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)

if [ "$response" = "200" ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy (HTTP $response)"
    exit 1
fi
```

### 9.3 数据库备份

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/kunling-cis

mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -h host -u user -p'password' kunling_cis > $BACKUP_DIR/db_$DATE.sql

# 压缩
gzip $BACKUP_DIR/db_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

添加定时任务：

```bash
# 每天凌晨 2 点执行备份
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

### 9.4 性能监控

```bash
# PM2 监控面板
pm2 monit

# 查看进程状态
pm2 status

# 查看详细信息
pm2 show kunling-cis
```

---

## 10. 常见问题排查

### 10.1 服务无法启动

**问题**: 服务启动失败，报错 "Cannot find module"

**解决方案**:

```bash
# 重新安装依赖
rm -rf node_modules
pnpm install

# 重新构建
pnpm build
```

### 10.2 数据库连接失败

**问题**: 报错 "ECONNREFUSED" 或 "Access denied"

**解决方案**:

1. 检查 `DATABASE_URL` 格式是否正确
2. 确认数据库服务正在运行
3. 检查用户名密码是否正确
4. 确认数据库允许远程连接

### 10.3 报告生成超时

**问题**: 生成报告时页面超时

**解决方案**:

1. 检查 AI 服务 API 密钥是否有效
2. 增加 Nginx 超时配置
3. 确认网络连接正常

### 10.4 文件上传失败

**问题**: CSV 文件上传失败

**解决方案**:

1. 检查 Nginx `client_max_body_size` 配置
2. 确认 S3 存储配置正确
3. 检查文件格式是否为 UTF-8 编码

### 10.5 内存不足

**问题**: 服务频繁重启，日志显示 OOM

**解决方案**:

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ecosystem.config.js

# 或在 PM2 配置中设置
# node_args: '--max-old-space-size=4096'
```

---

## 附录：快速部署命令汇总

```bash
# 1. 克隆代码
git clone https://github.com/bright2048/company-analyzer.git
cd company-analyzer

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 初始化数据库
pnpm db:push

# 5. 构建
pnpm build

# 6. 启动服务
pm2 start ecosystem.config.js

# 7. 查看状态
pm2 status
```

---

**文档结束**

如有问题，请联系技术支持或查阅项目 GitHub 仓库的 Issues。
