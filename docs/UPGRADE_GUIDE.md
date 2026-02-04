# 数智深圳湾智能体 升级部署指南

**适用场景**: 将新开发的功能更新到现有生产环境**当前环境**: `/var/www/company-analyzer`**更新日期**: 2024年12月

---

## 升级概述

本次升级包含以下新功能：

| 功能           | 描述                                                             |
| -------------- | ---------------------------------------------------------------- |
| 品牌更新       | 系统名称改为"数智深圳湾智能体"，左上角显示"鲲鹏产业源头创新中心" |
| 批量查询       | 支持 CSV 文件导入，最多50个企业，后台异步生成报告                |
| 任务管理       | 查看批量任务进度、历史记录，支持删除和打包下载                   |
| 企业未找到提示 | 当企业信息无法确认时，明确告知用户，不编造虚假信息               |

---

## 升级前准备

### 1. 备份现有数据

在升级前，务必备份数据库和代码：

```bash
# 登录服务器
ssh root@your-server

# 进入项目目录
cd /var/www/company-analyzer

# 备份数据库
mysqldump -u analyzer -p'Kunpen66666' company_analyzer > ~/backup_$(date +%Y%m%d_%H%M%S).sql

# 备份现有代码
cp -r /var/www/company-analyzer ~/company-analyzer-backup-$(date +%Y%m%d)

# 备份环境变量
cp .env ~/.env.backup
```

### 2. 检查当前服务状态

```bash
# 如果使用 PM2
pm2 status

# 如果使用 systemd
systemctl status company-analyzer

# 检查当前运行的进程
ps aux | grep node
```

---

## 升级步骤

### 步骤 1：停止现有服务

```bash
cd /var/www/company-analyzer

# 方式1：如果使用 PM2
pm2 stop company-analyzer
# 或停止所有
pm2 stop all

# 方式2：如果使用 systemd
sudo systemctl stop company-analyzer

# 方式3：如果直接运行
# 找到进程并终止
pkill -f "node.*company-analyzer"
```

### 步骤 2：拉取最新代码

```bash
cd /var/www/company-analyzer

# 保存本地修改（如果有）
git stash

# 拉取最新代码
git pull origin main

# 如果有冲突，恢复本地修改
git stash pop
```

**如果您的代码不是通过 Git 管理**，请使用以下方式：

```bash
# 下载最新代码包
cd /tmp
git clone https://github.com/bright2048/company-analyzer.git company-analyzer-new

# 复制新代码到项目目录（保留 .env 和 node_modules ）
rsync -av --exclude='.env' --exclude='node_modules' --exclude='.git' \
  /tmp/company-analyzer-new/ /var/www/company-analyzer/

# 清理临时文件
rm -rf /tmp/company-analyzer-new
```

### 步骤 3：恢复环境变量

确保 `.env` 文件保持不变。如果被覆盖，从备份恢复：

```bash
cd /var/www/company-analyzer

# 检查 .env 是否存在
cat .env

# 如果丢失，从备份恢复
cp ~/.env.backup .env
```

您的现有 `.env` 配置已经完整，无需修改。新版本兼容您现有的所有配置项。

### 步骤 4：安装/更新依赖

```bash
cd /var/www/company-analyzer

# 清理旧的依赖缓存（可选，如果遇到问题）
# rm -rf node_modules pnpm-lock.yaml

# 安装依赖
pnpm install

# 如果没有 pnpm，使用 npm
# npm install
```

### 步骤 5：更新数据库结构

本次升级新增了 `batch_tasks` 表，需要更新数据库结构：

```bash
cd /var/www/company-analyzer

# 推送数据库变更
pnpm db:push
```

执行后会提示确认，输入 `y` 确认创建新表。

**预期输出示例**：

```
[✓]: # "Changes applied"
  + batch_tasks (新表)
  + company_reports.batch_task_id (新列)
```

### 步骤 6：构建生产版本

```bash
cd /var/www/company-analyzer

# 构建前端和后端
pnpm build
```

构建成功后，会在 `dist/` 目录生成生产代码。

### 步骤 7：启动服务

```bash
cd /var/www/company-analyzer

# 方式1：使用 PM2（推荐）
pm2 start ecosystem.config.js
# 或者如果没有配置文件
pm2 start dist/server/_core/index.js --name company-analyzer

# 方式2：使用 systemd
sudo systemctl start company-analyzer

# 方式3：直接运行（不推荐生产环境）
NODE_ENV=production node dist/server/_core/index.js
```

### 步骤 8：验证升级

```bash
# 检查服务状态
pm2 status

# 查看日志确认无错误
pm2 logs company-analyzer --lines 50

# 测试服务是否正常响应
curl -I http://localhost:3000
```

在浏览器中访问您的网站 ，检查以下功能：

| 检查项       | 预期结果                                       |
| ------------ | ---------------------------------------------- |
| 首页左上角   | 显示"鲲鹏产业源头创新中心"和"数智深圳湾智能体" |
| 导航栏       | 新增"批量查询"和"任务管理"入口                 |
| 批量查询页面 | 可以上传 CSV 文件                              |
| 任务管理页面 | 显示任务列表和统计卡片                         |

---

## 完整升级脚本

将以下内容保存为 `upgrade.sh`，一键执行升级：

```bash
#!/bin/bash
set -e

echo "=========================================="
echo "数智深圳湾智能体 升级脚本"
echo "=========================================="

PROJECT_DIR="/var/www/company-analyzer"
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "[1/8] 备份数据库..."
mysqldump -u analyzer -p'Kunpen66666' company_analyzer > $BACKUP_DIR/db_$DATE.sql
echo "数据库备份完成: $BACKUP_DIR/db_$DATE.sql"

echo "[2/8] 备份环境变量..."
cp $PROJECT_DIR/.env $BACKUP_DIR/.env.$DATE

echo "[3/8] 停止服务..."
pm2 stop company-analyzer 2>/dev/null || true

echo "[4/8] 拉取最新代码..."
cd $PROJECT_DIR
git pull origin main || {
    echo "Git pull 失败，尝试使用 rsync 方式..."
    cd /tmp
    rm -rf company-analyzer-new
    git clone https://github.com/bright2048/company-analyzer.git company-analyzer-new
    rsync -av --exclude='.env' --exclude='node_modules' --exclude='.git' \
        /tmp/company-analyzer-new/ $PROJECT_DIR/
    rm -rf /tmp/company-analyzer-new
}

echo "[5/8] 安装依赖..."
cd $PROJECT_DIR
pnpm install

echo "[6/8] 更新数据库结构..."
echo "y" | pnpm db:push

echo "[7/8] 构建生产版本..."
pnpm build

echo "[8/8] 启动服务..."
pm2 start ecosystem.config.js 2>/dev/null || pm2 start dist/server/_core/index.js --name company-analyzer

echo "=========================================="
echo "升级完成！"
echo "=========================================="
echo ""
echo "请执行以下命令检查服务状态："
echo "  pm2 status"
echo "  pm2 logs company-analyzer"
echo ""
echo "如需回滚 ，请执行："
echo "  mysql -u analyzer -p company_analyzer < $BACKUP_DIR/db_$DATE.sql"
```

使用方法：

```bash
# 赋予执行权限
chmod +x upgrade.sh

# 执行升级
./upgrade.sh
```

---

## 回滚方案

如果升级后出现问题，可以快速回滚：

### 回滚代码

```bash
# 停止服务
pm2 stop company-analyzer

# 恢复备份的代码
rm -rf /var/www/company-analyzer
cp -r ~/company-analyzer-backup-YYYYMMDD /var/www/company-analyzer

# 恢复环境变量
cp ~/.env.backup /var/www/company-analyzer/.env

# 重新安装依赖
cd /var/www/company-analyzer
pnpm install

# 重新构建
pnpm build

# 启动服务
pm2 start ecosystem.config.js
```

### 回滚数据库

```bash
# 恢复数据库备份
mysql -u analyzer -p'Kunpen66666' company_analyzer < ~/backup_YYYYMMDD_HHMMSS.sql
```

---

## 常见问题

### Q1: `pnpm: command not found`

```bash
# 安装 pnpm
npm install -g pnpm
```

### Q2: 数据库连接失败

检查 MySQL 服务是否运行：

```bash
systemctl status mysql
# 如果未运行
systemctl start mysql
```

### Q3: 端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000

# 终止进程
kill -9 <PID>
```

### Q4: 构建失败，内存不足

```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm build
```

### Q5: PM2 配置文件不存在

如果没有 `ecosystem.config.js`，创建一个：

```bash
cat > /var/www/company-analyzer/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'company-analyzer',
    script: 'dist/server/_core/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
```

---

## 升级后检查清单

| 检查项     | 命令/操作             | 预期结果           |
| ---------- | --------------------- | ------------------ |
| 服务状态   | `pm2 status`          | 状态为 `online`    |
| 无错误日志 | `pm2 logs --lines 20` | 无 ERROR 级别日志  |
| 首页访问   | 浏览器访问网站        | 正常显示新品牌名称 |
| 批量查询   | 点击"批量查询"菜单    | 页面正常加载       |
| 任务管理   | 点击"任务管理"菜单    | 显示任务列表       |
| 数据库     | 查询 batch_tasks 表   | 表存在且可查询     |

---

**升级完成后，如有任何问题，请保留日志信息并联系技术支持。**
