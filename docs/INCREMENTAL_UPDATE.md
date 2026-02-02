# 鲲灵智谱 增量更新指南

**更新内容**：企业名称自动联想功能 + LLM提示词优化  
**更新日期**：2024年12月

---

## 需要修改的文件清单

本次更新涉及 **2个文件**，无需修改数据库结构：

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `server/routers.ts` | 修改 | 新增企业搜索建议接口 + 优化LLM提示词 |
| `client/src/pages/Home.tsx` | 修改 | 添加自动联想UI组件 |

---

## 详细修改内容

### 1. server/routers.ts

**位置**：在 `report: router({` 之前，添加新的 `companySearch` 路由

```typescript
  // ============ 企业名称搜索建议 ============
  companySearch: router({
    // 企业名称搜索建议（基于园区企业库 + 历史报告 + 名称建议）
    suggest: publicProcedure
      .input(z.object({ keyword: z.string().min(1) }))
      .query(async ({ input }) => {
        const { keyword } = input;
        const suggestions: { name: string; source: string }[] = [];
        
        // 1. 从园区企业库中搜索
        const parkCompaniesData = await getAllParkCompanyNames();
        const matchedParkCompanies = parkCompaniesData
          .filter(c => c.companyName.toLowerCase().includes(keyword.toLowerCase()))
          .slice(0, 5)
          .map(c => ({ name: c.companyName, source: "园区企业" }));
        suggestions.push(...matchedParkCompanies);
        
        // 2. 从历史报告中搜索
        const reports = await getCompanyReports(100, 0);
        const matchedReports = reports
          .filter(r => r.companyName.toLowerCase().includes(keyword.toLowerCase()))
          .filter(r => !suggestions.some(s => s.name === r.companyName))
          .slice(0, 5)
          .map(r => ({ name: r.companyName, source: "历史查询" }));
        suggestions.push(...matchedReports);
        
        // 3. 添加常见企业名称后缀建议
        const commonSuffixes = ["有限公司", "科技有限公司", "集团有限公司", "实业有限公司", "股份有限公司"];
        if (keyword.length >= 2 && !keyword.includes("有限") && !keyword.includes("公司")) {
          const suffixSuggestions = commonSuffixes
            .slice(0, 3)
            .map(suffix => ({ name: `${keyword}${suffix}`, source: "名称建议" }))
            .filter(s => !suggestions.some(existing => existing.name === s.name));
          suggestions.push(...suffixSuggestions);
        }
        
        return suggestions.slice(0, 10);
      }),
  }),
```

**位置**：修改 `generateCompanyReport` 函数中的 `systemPrompt` 和 `userPrompt`

**旧的 systemPrompt**（需要替换）：
```typescript
const systemPrompt = `你是一位专业的企业分析师，擅长撰写高质量的公司调研报告。

**重要提示**：
1. 你只能基于你确实了解的、真实存在的企业信息来生成报告
2. 如果你不了解或不确定某个企业是否存在，你必须明确告知，不能编造虚假信息
...
```

**新的 systemPrompt**（替换为）：
```typescript
const systemPrompt = `你是一位专业的企业分析师，擅长撰写高质量的公司调研报告。

**核心原则**：
1. 对于中国境内注册的企业，请积极尝试生成报告，即使你不熟悉该企业，也可以基于企业名称推断其可能的业务范围和行业特点
2. 只有当企业名称明显不像一个真实企业（如随机字符串、明显的测试名称）时，才返回未找到
3. 对于包含"有限公司"、"集团"、"科技"、"实业"等关键词的企业名称，应该默认为真实企业并生成报告
4. 报告内容应基于合理推断和行业通用信息，明确标注哪些是推断内容

**返回格式**：
请生成完整的Markdown格式报告，报告必须包含以下章节：
1. 公司概况与研究背景
2. 发展历程与关键节点
3. 高管团队变化分析
4. 市场营销变化分析
5. 营收利润情况分析
6. 行业背景与竞争环境
7. 风险提示与规避建议
8. 园区匹配分析
9. 结语：发展前景与战略建议

**仅在以下情况返回[NOT_FOUND]**：
- 企业名称是明显的测试数据（如"test"、"123"、"测试公司"）
- 企业名称是随机字符串或无意义的组合
- 企业名称明显不符合中国企业命名规范

**风险提示章节要求**：
必须从以下维度全面分析公司潜在风险：
- 经营风险、财务风险、法律合规风险、技术风险、管理风险、行业风险
针对每类风险，必须提供具体的风险规避建议和应对措施。

**内容要求**：
- 使用Markdown格式
- 对于不确定的信息，使用"根据企业名称推断"、"可能"、"预计"等词汇标注
- 分析要有深度，结合行业特点
- 报告长度不少于2000字`;
```

**旧的 userPrompt**（需要替换）：
```typescript
const userPrompt = `请为以下公司生成一份详细的企业分析报告：
...
如果你不了解这家企业或无法确认其真实存在，请返回 [NOT_FOUND]未找到该企业的可靠信息`;
```

**新的 userPrompt**（替换为）：
```typescript
const userPrompt = `请为以下公司生成一份详细的企业分析报告：

**目标公司**：${companyName}

**园区现有企业列表**（用于分析上下游关系和入驻可能性）：
${parkCompanyList || "暂无园区企业数据"}

请生成一份专业的企业分析报告。如果你不熟悉这家企业的具体信息，请基于企业名称推断其可能的业务范围、行业特点，并结合行业通用信息生成报告。

注意：只有当企业名称明显是测试数据或无意义字符串时，才返回[NOT_FOUND]。`;
```

**位置**：修改 NOT_FOUND 检测逻辑

**旧代码**：
```typescript
if (contentStr.includes("[NOT_FOUND]") || contentStr.trim().startsWith("未找到")) {
```

**新代码**：
```typescript
if (contentStr.includes("[NOT_FOUND]")) {
```

---

### 2. client/src/pages/Home.tsx

**完整替换**整个文件，新版本包含：
- 自动联想下拉列表组件
- 搜索建议API调用
- 点击外部关闭建议列表的逻辑

由于改动较大，建议直接替换整个文件。

---

## 快速更新命令

```bash
# 1. 登录服务器
ssh root@vmanalyersvr

# 2. 进入项目目录
cd /var/www/company-analyzer

# 3. 备份当前文件
cp server/routers.ts server/routers.ts.bak
cp client/src/pages/Home.tsx client/src/pages/Home.tsx.bak

# 4. 下载最新代码（二选一）
# 方式A：如果使用Git
git pull origin main

# 方式B：手动下载并替换
# 从附件下载 company-analyzer-latest.tar.gz
# 解压后只复制这两个文件：
# - server/routers.ts
# - client/src/pages/Home.tsx

# 5. 重新构建
pnpm build

# 6. 重启服务
pm2 restart company-analyzer
```

---

## 验证更新

1. 访问首页，在搜索框输入"华为"
2. 应该看到自动联想下拉列表
3. 输入一个真实企业名称（如"深圳市xxx有限公司"），应该能正常生成报告

---

## 回滚方法

如果更新后出现问题：

```bash
# 恢复备份文件
cp server/routers.ts.bak server/routers.ts
cp client/src/pages/Home.tsx.bak client/src/pages/Home.tsx

# 重新构建并重启
pnpm build
pm2 restart company-analyzer
```
