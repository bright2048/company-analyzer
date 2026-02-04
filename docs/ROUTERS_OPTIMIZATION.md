# routers.ts 优化方案

## 现状

- `server/routers.ts` 约 4859 行，包含：
  - 企查查 API 调用逻辑（~2000 行）
  - 报告生成逻辑（~800 行）
  - 13 个子路由（auth, userManagement, llmProvider, 等）

## 优化策略

### 1. 抽取服务层（已完成/进行中）

- **`server/services/qichacha.ts`**：企查查 API 相关
  - 签名、配置、各类 API 调用
  - `getCompanyFullInfo` 及缓存逻辑
- **`server/services/reportService.ts`**：报告生成相关
  - `generateCompanyReport`, `generateSummaryReport`, `generateParkAnalysis`
  - `generateReportAsync`, `processBatchTaskAsync`, `executeCacheWarmup`

### 2. 可选的子路由拆分

将每个子路由拆分为独立文件，主路由仅做合并：

```
server/routers/
  index.ts          # 合并所有子路由，导出 appRouter
  auth.ts
  userManagement.ts
  llmProvider.ts
  parkCompany.ts
  report.ts
  ...
```

### 3. 预期效果

- `routers.ts` 从 4859 行缩减至 ~1500 行（仅保留路由定义）
- 职责清晰，便于维护与测试
