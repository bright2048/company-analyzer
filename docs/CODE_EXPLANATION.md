# 鲲灵智谱系统 - 代码逻辑详解（小白版）

> 本文档用大白话解释系统中每个代码文件的作用，以及它们是如何配合工作的。

---

## 一、系统整体架构

想象一下，这个系统就像一家餐厅：

| 角色 | 对应代码 | 作用 |
|------|----------|------|
| 餐厅门面（顾客看到的） | `client/` 目录 | 用户界面，用户在这里输入企业名称、查看报告 |
| 后厨（做菜的地方） | `server/` 目录 | 处理业务逻辑，调用AI生成报告 |
| 菜谱和食材清单 | `drizzle/schema.ts` | 数据库表结构，定义存什么数据 |
| 冰箱（存放食材） | MySQL数据库 | 存储用户、报告、企业信息等数据 |

**数据流向**：用户在前端输入 → 前端发请求到后端 → 后端处理并调用AI → 结果存入数据库 → 返回给前端展示

---

## 二、前端文件详解（client/ 目录）

前端就是用户看到和操作的界面，使用 React 框架开发。

### 2.1 入口文件

#### `client/src/main.tsx` - 程序入口
```
作用：整个前端应用的启动点，就像汽车的点火开关
做了什么：
1. 引入全局样式
2. 设置各种"提供者"（Provider），让整个应用能使用主题、路由、数据请求等功能
3. 渲染 App 组件
```

#### `client/src/App.tsx` - 路由配置
```
作用：定义"哪个网址显示哪个页面"，就像餐厅的导航牌
做了什么：
1. 定义路由规则，比如：
   - "/" → 首页（Home.tsx）
   - "/report/:id" → 报告详情页
   - "/batch" → 批量查询页
   - "/tasks" → 任务管理页
2. 设置页面布局结构
```

### 2.2 页面文件（client/src/pages/）

#### `Home.tsx` - 首页（最重要的页面）
```
作用：用户进入系统看到的第一个页面
包含功能：
1. 顶部导航栏：显示"鲲鹏产业源头创新中心"和"鲲灵智谱"
2. 搜索框：用户输入企业名称的地方
3. 搜索建议下拉列表：输入时自动显示匹配的企业
4. 功能卡片：展示系统的三大功能

关键代码逻辑：
- 用户输入2个字以上 → 触发搜索建议请求
- 点击建议项 → 自动填入并开始生成报告
- 点击"生成报告"按钮 → 创建报告并跳转到详情页
```

#### `ReportDetail.tsx` - 报告详情页
```
作用：展示生成的企业分析报告
包含功能：
1. 显示报告生成状态（生成中/已完成/失败）
2. 展示报告内容（Markdown格式渲染）
3. 导出按钮（Word/PDF）
4. 失败时显示友好提示

关键代码逻辑：
- 页面加载时获取报告数据
- 如果状态是"pending"或"generating"，每3秒刷新一次
- 报告完成后停止刷新，显示完整内容
```

#### `BatchQuery.tsx` - 批量查询页
```
作用：上传CSV文件，批量生成多个企业的报告
包含功能：
1. CSV文件上传区域
2. 企业列表预览
3. 提交批量任务

关键代码逻辑：
- 用户选择CSV文件 → 解析文件内容
- 显示企业列表供用户确认
- 点击提交 → 创建批量任务 → 跳转到任务管理页
```

#### `TaskManagement.tsx` - 任务管理页
```
作用：查看和管理批量查询任务
包含功能：
1. 任务统计卡片（总数、处理中、已完成、失败）
2. 任务列表（显示每个任务的进度）
3. 任务详情弹窗（查看每个企业的报告状态）
4. 删除任务按钮

关键代码逻辑：
- 页面加载时获取任务列表
- 每5秒自动刷新（检查任务进度）
- 点击任务 → 显示详情弹窗
- 点击删除 → 弹出确认框 → 删除任务
```

### 2.3 组件文件（client/src/components/）

#### `ui/` 目录 - 基础UI组件
```
这里存放的是可复用的小组件，比如：
- button.tsx：按钮
- card.tsx：卡片
- input.tsx：输入框
- dialog.tsx：弹窗

这些组件来自 shadcn/ui 库，已经设计好了样式，直接用就行。
```

### 2.4 工具文件

#### `client/src/lib/trpc.ts` - 前后端通信
```
作用：让前端能够调用后端的接口
打个比方：这就像餐厅里服务员和后厨之间的对讲机

使用方式：
- trpc.report.create.useMutation() → 调用后端的"创建报告"接口
- trpc.companySearch.suggest.useQuery() → 调用后端的"搜索建议"接口

好处：
- 自动处理请求/响应
- 有类型提示，不容易写错
- 自动处理加载状态和错误
```

---

## 三、后端文件详解（server/ 目录）

后端负责处理业务逻辑，就像餐厅的后厨。

### 3.1 核心文件

#### `server/routers.ts` - 接口定义（最重要的后端文件）
```
作用：定义所有的API接口，就像后厨的菜单
包含的接口分组：

1. auth（认证相关）
   - me：获取当前登录用户
   - logout：退出登录

2. parkCompany（园区企业管理）
   - list：获取企业列表
   - create：添加企业
   - update：修改企业
   - delete：删除企业
   - importExcel：导入Excel

3. companySearch（企业搜索）
   - suggest：搜索建议（这是联想功能的核心）
     逻辑：本地缓存 → 园区企业库 → 企查查API → 名称建议

4. report（报告管理）
   - create：创建报告（触发AI生成）
   - list：获取报告列表
   - getById：获取报告详情
   - exportWord：导出Word
   - exportPdf：导出PDF

5. batchTask（批量任务）
   - create：创建批量任务
   - list：获取任务列表
   - getById：获取任务详情
   - delete：删除任务
```

#### `server/db.ts` - 数据库操作
```
作用：封装所有数据库操作，就像后厨的食材管理员
包含的函数：

用户相关：
- upsertUser：创建或更新用户
- getUserByOpenId：根据ID查用户

园区企业相关：
- createParkCompany：添加企业
- getParkCompanies：获取企业列表
- searchParkCompanies：搜索企业

报告相关：
- createCompanyReport：创建报告记录
- getCompanyReports：获取报告列表
- updateCompanyReport：更新报告内容

缓存相关（新增）：
- getCachedSearchResults：获取缓存的搜索结果
- saveSearchResultsToCache：保存搜索结果到缓存
- searchCompanyCache：在缓存中搜索企业
```

### 3.2 报告生成逻辑

#### 报告生成流程（在 routers.ts 中）
```
1. 用户点击"生成报告"
   ↓
2. 后端创建一条报告记录（状态：pending）
   ↓
3. 立即返回报告ID给前端（用户可以看到"生成中"）
   ↓
4. 后台异步执行：
   a. 调用LLM生成报告内容
   b. 更新报告状态为"completed"
   c. 如果失败，更新状态为"failed"
   ↓
5. 前端轮询检查状态，完成后显示报告
```

#### LLM调用逻辑
```
位置：routers.ts 中的 generateCompanyReport 函数

提示词设计：
- 告诉AI要分析哪个企业
- 要求生成Markdown格式的报告
- 包含：公司概况、业务分析、财务分析、风险提示等
- 特别强调：如果找不到企业信息，要明确说明，不能编造
```

### 3.3 企查查API集成

#### `callQichachaApi` 函数
```
作用：调用企查查的企业搜索API
位置：routers.ts 文件开头

逻辑：
1. 检查是否配置了API密钥（QICHACHA_APP_KEY 和 QICHACHA_SECRET_KEY）
2. 如果没配置，直接返回空数组（不报错）
3. 如果配置了：
   a. 生成签名（MD5加密）
   b. 发送HTTP请求到企查查API
   c. 解析返回结果
   d. 返回企业列表
```

### 3.4 缓存逻辑

#### 缓存工作原理
```
目的：减少企查查API调用次数，节省费用

搜索时的优先级：
1. 先查本地缓存（company_search_cache表）
   - 如果有且未过期 → 直接返回
2. 再查缓存的企业表（company_cache表）
   - 模糊匹配企业名称
3. 查园区企业库
4. 查历史报告
5. 最后才调用企查查API
   - 调用后把结果存入缓存

缓存过期时间：
- 通过 COMPANY_CACHE_DAYS 环境变量配置
- 默认30天
```

---

## 四、数据库文件详解（drizzle/ 目录）

### 4.1 `drizzle/schema.ts` - 数据库表结构
```
作用：定义数据库中有哪些表，每个表有哪些字段
就像设计一个Excel表格的列名

包含的表：

1. users（用户表）
   - id：用户ID
   - openId：OAuth登录ID
   - name：用户名
   - role：角色（admin/user）

2. parkCompanies（园区企业表）
   - id：企业ID
   - companyName：企业名称
   - industry：行业
   - businessScope：经营范围
   - contactPerson：联系人
   ...

3. companyReports（报告表）
   - id：报告ID
   - companyName：企业名称
   - reportContent：报告内容（Markdown）
   - status：状态（pending/generating/completed/failed）
   - batchTaskId：关联的批量任务ID
   ...

4. batchTasks（批量任务表）
   - id：任务ID
   - totalCount：总数
   - completedCount：已完成数
   - failedCount：失败数
   - status：状态
   ...

5. companyCache（企业缓存表）- 新增
   - creditCode：统一社会信用代码（唯一标识）
   - companyName：企业名称
   - legalPerson：法定代表人
   - status：企业状态
   - cachedAt：缓存时间
   ...

6. companySearchCache（搜索缓存表）- 新增
   - keyword：搜索关键词
   - creditCodes：匹配的企业信用代码列表
   - cachedAt：缓存时间
```

---

## 五、配置文件详解

### 5.1 `.env` - 环境变量配置
```
作用：存放敏感配置信息，不会提交到代码仓库

必需配置：
DATABASE_URL=mysql://用户名:密码@地址:端口/数据库名
JWT_SECRET=随机字符串，用于加密登录状态
BUILT_IN_FORGE_API_URL=AI接口地址
BUILT_IN_FORGE_API_KEY=AI接口密钥

可选配置：
COMPANY_CACHE_DAYS=30  # 缓存有效期（天）
QICHACHA_APP_KEY=xxx   # 企查查API密钥
QICHACHA_SECRET_KEY=xxx
```

### 5.2 `package.json` - 项目配置
```
作用：定义项目信息和依赖包

重要命令：
- pnpm install：安装依赖
- pnpm dev：启动开发服务器
- pnpm build：构建生产版本
- pnpm db:push：更新数据库结构
- pnpm test：运行测试
```

---

## 六、文件之间的配合关系

### 6.1 用户搜索企业的完整流程

```
用户在 Home.tsx 输入"华为"
        ↓
Home.tsx 调用 trpc.companySearch.suggest.useQuery({ keyword: "华为" })
        ↓
请求发送到后端 routers.ts 的 companySearch.suggest 接口
        ↓
后端按优先级搜索：
  1. db.ts 的 getCachedSearchResults("华为") → 查缓存
  2. db.ts 的 searchCompanyCache("华为") → 查本地缓存表
  3. db.ts 的 getAllParkCompanyNames() → 查园区企业
  4. db.ts 的 getCompanyReports() → 查历史报告
  5. callQichachaApi("华为") → 调用企查查API
        ↓
返回搜索建议列表给前端
        ↓
Home.tsx 显示下拉列表，用户点击选择
        ↓
调用 trpc.report.create.useMutation({ companyName: "华为技术有限公司" })
        ↓
后端创建报告记录，异步调用AI生成报告
        ↓
前端跳转到 ReportDetail.tsx，轮询等待报告完成
```

### 6.2 数据流向图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (client/)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Home.tsx │  │ReportDe- │  │BatchQue- │  │TaskMana- │    │
│  │          │  │tail.tsx  │  │ry.tsx    │  │gement.tsx│    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                         │                                    │
│                    trpc.ts (通信层)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP请求
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                         后端 (server/)                       │
│                    ┌──────────────┐                         │
│                    │  routers.ts  │ ← 接口定义               │
│                    └──────┬───────┘                         │
│                           │                                  │
│              ┌────────────┼────────────┐                    │
│              ↓            ↓            ↓                    │
│         ┌────────┐  ┌──────────┐  ┌──────────┐             │
│         │ db.ts  │  │ llm.ts   │  │企查查API │             │
│         │数据库   │  │ AI调用   │  │外部接口  │             │
│         └───┬────┘  └──────────┘  └──────────┘             │
│             │                                               │
└─────────────┼───────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                      MySQL 数据库                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ users  │ │reports │ │ tasks  │ │ cache  │ │ park   │   │
│  │        │ │        │ │        │ │        │ │companies│   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、常见问题解答

### Q1: 为什么搜索不到企业？
```
原因：
1. 没有配置企查查API（最常见）
2. 本地缓存和园区企业库中没有该企业
3. 输入的关键词太短（需要至少2个字）

解决：
- 配置企查查API，或者
- 直接输入完整的企业名称生成报告
```

### Q2: 报告一直显示"生成中"怎么办？
```
原因：
1. AI接口调用失败
2. 网络问题
3. AI接口配置错误

解决：
1. 检查 .env 中的 BUILT_IN_FORGE_API_URL 和 BUILT_IN_FORGE_API_KEY
2. 查看服务器日志：pm2 logs company-analyzer
```

### Q3: 如何修改缓存有效期？
```
在 .env 文件中添加或修改：
COMPANY_CACHE_DAYS=7  # 改为7天

然后重启服务：
pm2 restart company-analyzer
```

---

## 八、总结

这个系统的核心逻辑可以用一句话概括：

> **用户输入企业名称 → 系统搜索企业信息 → 调用AI生成报告 → 展示给用户**

主要文件的职责：
- `Home.tsx`：用户输入入口
- `routers.ts`：处理所有业务逻辑
- `db.ts`：操作数据库
- `schema.ts`：定义数据结构

理解了这几个文件，就理解了整个系统的80%。
