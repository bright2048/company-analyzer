# MinIO 本地部署与系统集成指南

**版本**：1.0**更新日期**：2025年12月17日**作者**：Manus AI

---

## 目录

1. [MinIO 简介](#1-minio-%E7%AE%80%E4%BB%8B)

1. [Docker 部署方式](#2-docker-%E9%83%A8%E7%BD%B2%E6%96%B9%E5%BC%8F)

1. [二进制安装方式](#3-%E4%BA%8C%E8%BF%9B%E5%88%B6%E5%AE%89%E8%A3%85%E6%96%B9%E5%BC%8F)

1. [集群部署方式](#4-%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2%E6%96%B9%E5%BC%8F)

1. [系统集成配置](#5-%E7%B3%BB%E7%BB%9F%E9%9B%86%E6%88%90%E9%85%8D%E7%BD%AE)

1. [运维管理](#6-%E8%BF%90%E7%BB%B4%E7%AE%A1%E7%90%86)

1. [常见问题](#7-%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98)

---

## 1. MinIO 简介

### 1.1 什么是 MinIO

MinIO 是一个高性能的对象存储服务，完全兼容 Amazon S3 API。它具有以下特点：

- **S3 兼容**：100% 兼容 Amazon S3 API，无需修改代码即可迁移

- **高性能**：单节点可达 183 GB/s 读取速度

- **轻量级**：单个二进制文件，部署简单

- **开源免费**：Apache 2.0 许可证

- **云原生**：支持 Kubernetes、Docker 等容器化部署

### 1.2 适用场景

- 企业私有云存储

- 数据合规要求（数据不出境）

- 降低云存储成本

- 开发测试环境

---

## 2. Docker 部署方式

### 2.1 单节点部署（推荐入门）

#### 2.1.1 前置条件

```bash
# 确保已安装 Docker
docker --version

# 如未安装，执行以下命令（Ubuntu）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2.1.2 创建数据目录

```bash
# 创建 MinIO 数据存储目录
sudo mkdir -p /data/minio

```

#### 2.1.3 启动 MinIO 容器

```bash
docker run -d \
  --name minio \
  --restart always \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /data/minio:/data \
  -e "MINIO_ROOT_USER=admin" \
  -e "MINIO_ROOT_PASSWORD=Kunpeng45^&" \
  minio/minio server /data --console-address ":9001"
```

**参数说明**：

| 参数 | 说明 |
| --- | --- |
| `-p 9000:9000` | S3 API 端口 |
| `-p 9001:9001` | Web 管理控制台端口 |
| `-v /data/minio:/data` | 数据持久化目录 |
| `MINIO_ROOT_USER` | 管理员用户名 |
| `MINIO_ROOT_PASSWORD` | 管理员密码（至少8位 ） |

#### 2.1.4 验证部署

```bash
# 检查容器状态
docker ps | grep minio

# 查看日志
docker logs minio

# 访问管理控制台
# 浏览器打开：http://服务器IP:9001
```

### 2.2 Docker Compose 部署（推荐生产 ）

#### 2.2.1 创建配置文件

创建 `/opt/minio/docker-compose.yml`：

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: always
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - /data/minio:/data
      - /etc/localtime:/etc/localtime:ro
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: YourStrongPassword123!
      # 可选：配置域名访问
      # MINIO_SERVER_URL: https://minio.yourdomain.com
      # MINIO_BROWSER_REDIRECT_URL: https://minio-console.yourdomain.com
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

networks:
  default:
    name: minio-network
```

#### 2.2.2 启动服务

```bash
cd /opt/minio
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 2.3 配置 Nginx 反向代理（可选 ）

如果需要通过域名访问，创建 `/etc/nginx/sites-available/minio`：

```
# MinIO API
server {
    listen 80;
    server_name minio.yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name minio.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/minio.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio.yourdomain.com/privkey.pem;

    # 允许大文件上传
    client_max_body_size 1000M;
    
    # 禁用缓冲以支持流式传输
    proxy_buffering off;
    proxy_request_buffering off;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 300;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        chunked_transfer_encoding off;
    }
}

# MinIO Console
server {
    listen 80;
    server_name minio-console.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name minio-console.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/minio-console.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio-console.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/minio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. 二进制安装方式

### 3.1 下载安装

#### 3.1.1 Linux (amd64 )

```bash
# 下载 MinIO 服务端
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# 下载 MinIO 客户端（可选 ，用于管理）
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

#### 3.1.2 Linux (arm64 )

```bash
wget https://dl.min.io/server/minio/release/linux-arm64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

### 3.2 创建系统用户

```bash
# 创建 minio 用户和组
sudo groupadd -r minio
sudo useradd -r -g minio -d /var/lib/minio -s /sbin/nologin minio

# 创建数据目录
sudo mkdir -p /data/minio
sudo chown -R minio:minio /data/minio
```

### 3.3 创建配置文件

创建 `/etc/default/minio`：

```bash
# MinIO 配置文件

# 数据存储路径
MINIO_VOLUMES="/data/minio"

# 管理员凭证
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=YourStrongPassword123!

# 服务端口
MINIO_OPTS="--address :9000 --console-address :9001"

# 可选：配置域名
# MINIO_SERVER_URL=https://minio.yourdomain.com
# MINIO_BROWSER_REDIRECT_URL=https://minio-console.yourdomain.com
```

设置权限：

```bash
sudo chmod 600 /etc/default/minio
```

### 3.4 创建 Systemd 服务

创建 `/etc/systemd/system/minio.service`：

```
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/usr/local/bin/minio

[Service]
Type=notify
User=minio
Group=minio
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
RestartSec=5
LimitNOFILE=65536
TasksMax=infinity
TimeoutStopSec=infinity
SendSIGKILL=no

[Install]
WantedBy=multi-user.target
```

### 3.5 启动服务

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启动 MinIO
sudo systemctl start minio

# 设置开机自启
sudo systemctl enable minio

# 查看状态
sudo systemctl status minio

# 查看日志
sudo journalctl -u minio -f
```

---

## 4. 集群部署方式

### 4.1 集群架构说明

MinIO 分布式部署支持：

- **纠删码（Erasure Coding ）**：数据冗余，允许部分节点故障

- **位衰减保护（Bitrot Protection）**：防止数据静默损坏

- **高可用**：任意节点故障不影响服务

**最小配置**：4 个节点（或 4 个磁盘） **推荐配置**：4-16 个节点

### 4.2 四节点集群部署

假设有 4 台服务器：

- minio1.local (192.168.1.101)

- minio2.local (192.168.1.102)

- minio3.local (192.168.1.103)

- minio4.local (192.168.1.104)

#### 4.2.1 在每台服务器上执行

```bash
# 安装 MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# 创建数据目录
sudo mkdir -p /data/minio
sudo chown -R minio:minio /data/minio
```

#### 4.2.2 配置 /etc/hosts（每台服务器 ）

```bash
192.168.1.101 minio1.local
192.168.1.102 minio2.local
192.168.1.103 minio3.local
192.168.1.104 minio4.local
```

#### 4.2.3 创建配置文件（每台服务器）

创建 `/etc/default/minio`：

```bash
# 集群节点配置
MINIO_VOLUMES="http://minio{1...4}.local/data/minio"

# 管理员凭证（所有节点必须相同 ）
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=YourStrongPassword123!

# 服务配置
MINIO_OPTS="--address :9000 --console-address :9001"
```

#### 4.2.4 启动集群

在每台服务器上启动服务：

```bash
sudo systemctl start minio
```

### 4.3 Docker Compose 集群部署

创建 `docker-compose-cluster.yml`：

```yaml
version: '3.8'

x-minio-common: &minio-common
  image: minio/minio:latest
  command: server --console-address ":9001" http://minio{1...4}/data
  environment:
    MINIO_ROOT_USER: admin
    MINIO_ROOT_PASSWORD: YourStrongPassword123!
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3

services:
  minio1:
    <<: *minio-common
    hostname: minio1
    volumes:
      - minio1-data:/data

  minio2:
    <<: *minio-common
    hostname: minio2
    volumes:
      - minio2-data:/data

  minio3:
    <<: *minio-common
    hostname: minio3
    volumes:
      - minio3-data:/data

  minio4:
    <<: *minio-common
    hostname: minio4
    volumes:
      - minio4-data:/data

  nginx:
    image: nginx:alpine
    hostname: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "9000:9000"
      - "9001:9001"
    depends_on:
      - minio1
      - minio2
      - minio3
      - minio4

volumes:
  minio1-data:
  minio2-data:
  minio3-data:
  minio4-data:
```

创建 `nginx.conf` 负载均衡配置：

```
events {
    worker_connections 1024;
}

http {
    upstream minio {
        server minio1:9000;
        server minio2:9000;
        server minio3:9000;
        server minio4:9000;
    }

    upstream minio-console {
        server minio1:9001;
        server minio2:9001;
        server minio3:9001;
        server minio4:9001;
    }

    server {
        listen 9000;
        server_name localhost;
        
        client_max_body_size 1000M;
        proxy_buffering off;
        proxy_request_buffering off;

        location / {
            proxy_pass http://minio;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_connect_timeout 300;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            chunked_transfer_encoding off;
        }
    }

    server {
        listen 9001;
        server_name localhost;

        location / {
            proxy_pass http://minio-console;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

启动集群：

```bash
docker-compose -f docker-compose-cluster.yml up -d
```

---

## 5. 系统集成配置

### 5.1 创建 Bucket

#### 5.1.1 通过 Web 控制台创建

1. 访问 MinIO 控制台：`http://服务器IP:9001`

1. 使用管理员账号登录

1. 点击 "Buckets" → "Create Bucket"

1. 输入 Bucket 名称：`company-reports`

1. 点击 "Create Bucket"

#### 5.1.2 通过命令行创建

```bash
# 配置 mc 客户端
mc alias set myminio http://localhost:9000 admin YourStrongPassword123!

# 创建 bucket
mc mb myminio/company-reports

# 查看 bucket 列表
mc ls myminio
```

### 5.2 创建访问密钥

#### 5.2.1 通过 Web 控制台创建

1. 登录 MinIO 控制台

1. 点击 "Access Keys" → "Create access key"

1. 记录生成的 Access Key 和 Secret Key

1. 点击 "Create"

#### 5.2.2 通过命令行创建

```bash
# 创建服务账号
mc admin user svcacct add myminio admin --access-key "AKIAIOSFODNN7EXAMPLE" --secret-key "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

### 5.3 配置环境变量

修改 `/var/www/company-analyzer/.env`：

```bash
# ============ MinIO 对象存储配置 ============

# MinIO 服务地址
S3_ENDPOINT="http://localhost:9000"

# 区域（MinIO 默认使用 us-east-1 ）
S3_REGION="us-east-1"

# Bucket 名称
S3_BUCKET="company-reports"

# 访问密钥
S3_ACCESS_KEY="AKIAIOSFODNN7EXAMPLE"
S3_SECRET_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# 可选：强制使用路径风格（某些情况下需要）
S3_FORCE_PATH_STYLE="true"
```

### 5.4 修改存储服务代码

查看当前的存储服务代码 `server/storage.ts`，确保支持 MinIO：

```typescript
// server/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 创建 S3 客户端（兼容 MinIO）
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  // MinIO 需要强制使用路径风格
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

const BUCKET = process.env.S3_BUCKET!;

/**
 * 上传文件到存储
 */
export async function storagePut(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // 生成访问 URL
  const url = `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  
  return { key, url };
}

/**
 * 获取文件的预签名 URL
 */
export async function storageGet(
  key: string,
  expiresIn: number = 3600
): Promise<{ key: string; url: string }> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  
  return { key, url };
}

/**
 * 获取公开访问 URL（如果 bucket 设置为公开）
 */
export function getPublicUrl(key: string): string {
  return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}
```

### 5.5 配置 Bucket 访问策略

如果需要公开访问报告文件，可以设置 Bucket 策略：

```bash
# 创建策略文件 policy.json
cat > policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::company-reports/*"]
    }
  ]
}
EOF

# 应用策略
mc anonymous set-json policy.json myminio/company-reports
```

或者通过控制台设置：

1. 登录 MinIO 控制台

1. 点击 "Buckets" → "company-reports"

1. 点击 "Access Policy"

1. 选择 "Public" 或自定义策略

### 5.6 测试集成

```bash
# 重启应用服务
cd /var/www/company-analyzer
pm2 restart company-analyzer

# 测试上传
curl -X POST http://localhost:3000/api/test-upload

# 检查 MinIO 中的文件
mc ls myminio/company-reports
```

---

## 6. 运维管理

### 6.1 MinIO 客户端（mc ）常用命令

```bash
# 配置别名
mc alias set myminio http://localhost:9000 admin YourStrongPassword123!

# 列出所有 bucket
mc ls myminio

# 列出 bucket 中的文件
mc ls myminio/company-reports

# 上传文件
mc cp localfile.pdf myminio/company-reports/

# 下载文件
mc cp myminio/company-reports/report.pdf ./

# 删除文件
mc rm myminio/company-reports/old-report.pdf

# 查看 bucket 使用情况
mc du myminio/company-reports

# 查看服务器信息
mc admin info myminio
```

### 6.2 数据备份

#### 6.2.1 使用 mc mirror 备份

```bash
# 备份到本地目录
mc mirror myminio/company-reports /backup/minio/company-reports

# 备份到另一个 MinIO
mc alias set backup http://backup-server:9000 admin BackupPassword123!
mc mirror myminio/company-reports backup/company-reports-backup
```

#### 6.2.2 定时备份脚本

创建 `/opt/minio/backup.sh`：

```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S )
BACKUP_DIR="/backup/minio"
LOG_FILE="/var/log/minio-backup.log"

echo "[$DATE] Starting MinIO backup..." >> $LOG_FILE

# 备份数据
mc mirror --overwrite myminio/company-reports $BACKUP_DIR/company-reports-$DATE

# 压缩备份
tar -czf $BACKUP_DIR/company-reports-$DATE.tar.gz -C $BACKUP_DIR company-reports-$DATE
rm -rf $BACKUP_DIR/company-reports-$DATE

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "[$DATE] Backup completed" >> $LOG_FILE
```

设置定时任务：

```bash
chmod +x /opt/minio/backup.sh

# 每天凌晨 2 点执行备份
crontab -e
0 2 * * * /opt/minio/backup.sh
```

### 6.3 监控告警

#### 6.3.1 健康检查

```bash
# 检查服务健康状态
curl -f http://localhost:9000/minio/health/live

# 检查集群状态
curl -f http://localhost:9000/minio/health/cluster
```

#### 6.3.2 Prometheus 监控

MinIO 内置 Prometheus 指标端点：

```bash
# 获取指标
curl http://localhost:9000/minio/v2/metrics/cluster
```

Prometheus 配置：

```yaml
scrape_configs:
  - job_name: 'minio'
    metrics_path: /minio/v2/metrics/cluster
    static_configs:
      - targets: ['localhost:9000']
```

### 6.4 日志管理

```bash
# 查看 Docker 日志
docker logs -f minio --tail 100

# 查看 Systemd 日志
journalctl -u minio -f

# 配置日志轮转
cat > /etc/logrotate.d/minio << 'EOF'
/var/log/minio/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 640 minio minio
}
EOF
```

---

## 7. 常见问题

### Q1: 无法连接 MinIO 服务

**检查步骤**：

```bash
# 1. 检查服务状态
docker ps | grep minio
# 或
systemctl status minio

# 2. 检查端口监听
netstat -tlnp | grep 9000

# 3. 检查防火墙
sudo ufw status
sudo ufw allow 9000
sudo ufw allow 9001

# 4. 检查日志
docker logs minio
```

### Q2: 上传文件失败

**可能原因**：

1. **Bucket 不存在**：先创建 bucket

1. **权限不足**：检查 Access Key 权限

1. **文件过大**：检查 Nginx 的 `client_max_body_size`

1. **路径风格问题**：设置 `forcePathStyle: true`

### Q3: 集群节点无法同步

**检查步骤**：

```bash
# 1. 检查网络连通性
ping minio2.local

# 2. 检查时间同步
timedatectl status
# 如果时间不同步 ，安装 NTP
sudo apt install ntp

# 3. 检查配置一致性
# 确保所有节点的 MINIO_ROOT_USER 和 MINIO_ROOT_PASSWORD 相同
```

### Q4: 如何扩容存储

**单节点扩容**：

```bash
# 停止服务
docker stop minio

# 扩展数据目录（如挂载新磁盘）
sudo mount /dev/sdb1 /data/minio2

# 修改启动命令，添加新目录
docker run -d \
  --name minio \
  -v /data/minio:/data1 \
  -v /data/minio2:/data2 \
  minio/minio server /data1 /data2 --console-address ":9001"
```

**集群扩容**：MinIO 集群扩容需要添加新的服务器池，具体请参考官方文档。

### Q5: 性能优化建议

1. **使用 SSD 存储**：显著提升 I/O 性能

1. **增加内存**：MinIO 会使用内存缓存热点数据

1. **调整系统参数**：

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化网络参数
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf
sysctl -p
```

---

## 附录：快速参考

### 环境变量配置模板

```bash
# MinIO 本地部署配置
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET="company-reports"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_FORCE_PATH_STYLE="true"
```

### 常用 mc 命令速查

| 命令 | 说明 |
| --- | --- |
| `mc ls myminio` | 列出 bucket |
| `mc mb myminio/bucket` | 创建 bucket |
| `mc cp file myminio/bucket/` | 上传文件 |
| `mc rm myminio/bucket/file` | 删除文件 |
| `mc du myminio/bucket` | 查看使用量 |
| `mc admin info myminio` | 服务器信息 |

---

*文档结束*

