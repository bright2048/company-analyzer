# 鲲鹏Token汇聚平台

一站式AI大模型Token聚合消费平台，聚合国内主流大模型厂商（DeepSeek、通义千问、Kimi、智谱GLM、百度文心、腾讯混元等），为开发者提供统一接入、灵活计费、弹性使用的Token消费服务。

## 核心特性

- **统一API接口**：100%兼容OpenAI Chat Completions API，所有OpenAI SDK可直接接入
- **多供应商聚合**：支持DeepSeek、Qwen、Kimi、GLM、混元、文心等主流大模型
- **流式响应(SSE)**：完整支持Server-Sent Events流式输出
- **智能路由**：优先级+权重负载均衡，自动故障转移
- **精准计费**：人民币"分"为最小单位，整数运算避免浮点精度问题
- **灵活套餐**：多档套餐 + 优惠券系统
- **开发者友好**：在线Playground测试、详细用量明细
- **管理后台**：运营看板、供应商管理、用户管理、余额调整

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                    用户/开发者                      │
├─────────────────────────────────────────────────┤
│  React前端控制台 (Vite + TailwindCSS)             │
├─────────────────────────────────────────────────┤
│  Go API网关 (net/http, 零依赖)                    │
│  ├── 鉴权中间件 (API Key / Admin Token)           │
│  ├── 统一代理服务 (路由/计费/限流/故障转移)          │
│  └── 供应商适配器 (OpenAI兼容/百度文心/Mock)        │
├─────────────────────────────────────────────────┤
│  存储层 (Memory / SQLite可扩展)                    │
└─────────────────────────────────────────────────┘
```

## 快速开始

### 方式一：Docker部署（推荐）

```bash
# 克隆代码
git clone https://github.com/bright2048/company-analyzer.git
cd kunpeng-token-platform

# 一键部署
chmod +x deploy/deploy.sh
./deploy/deploy.sh deploy
```

### 方式二：Docker Compose

```bash
# 创建环境配置
cp .env.example .env
# 编辑.env，修改PLATFORM_ADMIN_TOKEN为强密码

# 构建并启动
docker compose up -d

# 查看日志
docker compose logs -f
```

### 方式三：源码编译

**前置要求：**
- Go 1.22+
- Node.js 18+
- pnpm

```bash
# 构建前端
cd web && pnpm install && pnpm build && cd ..

# 构建后端
go build -o bin/kunpeng-server ./cmd/server/

# 运行
./bin/kunpeng-server
```

或使用Makefile：

```bash
make build   # 完整构建
make run     # 编译并运行
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `APP_ADDR` | 服务监听地址 | `0.0.0.0:8080` |
| `PLATFORM_ADMIN_TOKEN` | 平台管理员令牌 | `kp-admin-secret-2026` |
| `STORAGE_BACKEND` | 存储后端 | `memory` |
| `STATIC_DIR` | 前端静态文件目录 | `./static` |
| `LOG_LEVEL` | 日志级别 | `info` |

## API接口

### AI代理接口（兼容OpenAI）

```bash
# 非流式调用
curl http://your-server:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-kp-YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 流式调用
curl http://your-server:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-kp-YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 使用OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-kp-YOUR_API_KEY",
    base_url="http://your-server:8080/v1"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好，鲲鹏平台"}]
)
print(response.choices[0].message.content)
```

### 管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/login` | POST | 用户登录 |
| `/api/v1/user/profile` | GET | 获取用户信息 |
| `/api/v1/user/wallet` | GET | 获取钱包余额 |
| `/api/v1/user/apikeys` | GET/POST/DELETE | API密钥管理 |
| `/api/v1/user/usage` | GET | 用量明细 |
| `/api/v1/user/purchase` | POST | 购买套餐 |
| `/api/v1/user/coupon/redeem` | POST | 核销优惠券 |
| `/api/v1/plans` | GET | 套餐列表 |
| `/api/admin/overview` | GET | 运营总览 |
| `/api/admin/suppliers` | CRUD | 供应商管理 |
| `/api/admin/users` | GET | 用户列表 |
| `/api/admin/plans` | CRUD | 套餐管理 |
| `/api/admin/coupons` | CRUD | 优惠券管理 |

## 使用流程

1. **注册账号** → 访问 `/login` 页面注册
2. **充值余额** → 购买套餐或使用优惠券（新用户可用 `WELCOME2026` 获得5元体验金）
3. **创建API Key** → 在"API密钥"页面创建
4. **接入调用** → 使用API Key调用 `/v1/chat/completions`
5. **查看用量** → 在"用量明细"页面查看消费记录

## 添加真实供应商

部署后，登录管理后台添加真实的AI供应商：

1. 访问 `http://your-server:8080/admin/login`
2. 输入管理员令牌（.env中的PLATFORM_ADMIN_TOKEN）
3. 进入"供应商管理"→"添加供应商"
4. 填写供应商信息：

**DeepSeek示例：**
- 名称：DeepSeek Chat
- 协议：OpenAI兼容
- Base URL：`https://api.deepseek.com/v1`
- API Key：`sk-xxx`（您的DeepSeek API Key）
- 模型ID：`deepseek-chat`
- 输入价格：1.0（元/百万Token）
- 输出价格：2.0（元/百万Token）

**通义千问示例：**
- 名称：Qwen Max
- 协议：OpenAI兼容
- Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- API Key：`sk-xxx`
- 模型ID：`qwen-max`

## 生产环境建议

1. **修改管理员令牌**：务必将`PLATFORM_ADMIN_TOKEN`修改为强随机字符串
2. **启用HTTPS**：配置Nginx + Let's Encrypt SSL证书
3. **持久化存储**：生产环境建议扩展为SQLite或MySQL存储
4. **监控告警**：接入Prometheus + Grafana监控
5. **日志收集**：配置日志轮转和集中收集
6. **定期备份**：对数据库和配置文件进行定期备份

## 项目结构

```
kunpeng-token-platform/
├── cmd/server/          # 主程序入口
├── internal/
│   ├── config/          # 配置管理
│   ├── handler/         # HTTP处理器
│   ├── middleware/      # 中间件（鉴权、限流、CORS）
│   ├── model/           # 数据模型
│   ├── router/          # 路由注册
│   ├── service/         # 业务逻辑（代理、计费）
│   ├── store/           # 存储层（接口+实现）
│   └── upstream/        # 供应商适配器
├── web/                 # React前端源码
│   ├── src/
│   │   ├── components/  # 布局组件
│   │   ├── pages/       # 页面组件
│   │   └── lib/         # API工具库
│   └── package.json
├── deploy/              # 部署配置
│   ├── deploy.sh        # 一键部署脚本
│   └── nginx.conf       # Nginx配置
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

## License

MIT
