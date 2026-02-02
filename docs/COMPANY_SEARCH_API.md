# 企业名称实时联想功能实现方案

## 一、功能需求

实现类似企查查的企业名称实时联想功能：
- 用户输入关键词时，实时显示匹配的企业列表
- 显示企业名称、法定代表人、状态、成立日期等信息
- 支持模糊搜索（企业名、人名、产品名等）

## 二、可选API服务对比

| 服务商 | API名称 | 单价 | 返回信息 | 推荐度 |
|--------|---------|------|----------|--------|
| 企查查 | 企业模糊搜索(886) | 0.10元/次 | 企业名称、法人、状态、成立日期、信用代码 | ⭐⭐⭐⭐⭐ |
| 天眼查 | 企业搜索 | 约0.10元/次 | 类似信息 | ⭐⭐⭐⭐ |
| 爱企查(百度) | 企业搜索 | 免费额度 | 基础信息 | ⭐⭐⭐ |

**推荐使用企查查「企业模糊搜索」API（ApiCode: 886）**，原因：
1. 价格便宜（0.10元/次）
2. 返回信息丰富（企业名称、法人、状态、成立日期、信用代码等）
3. 每次返回最多5条记录，适合联想场景
4. 支持多种关键词搜索（企业名、人名、产品名、地址等）

## 三、企查查API接入步骤

### 1. 注册开放平台账号

访问 [企查查开放平台](https://openapi.qcc.com) 注册账号并完成企业认证。

### 2. 申请API权限

在控制台申请「企业模糊搜索」(ApiCode: 886) 接口权限。

### 3. 获取API密钥

获取 `appKey` 和 `secretKey`，用于接口签名。

### 4. 配置环境变量

在 `.env` 文件中添加：

```bash
# 企查查API配置
QICHACHA_APP_KEY="your-app-key"
QICHACHA_SECRET_KEY="your-secret-key"
```

## 四、代码实现

### 后端接口 (server/routers.ts)

```typescript
import crypto from 'crypto';

// 企查查API签名生成
function generateQccSign(appKey: string, secretKey: string, timestamp: string): string {
  const signStr = appKey + timestamp + secretKey;
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

// 企业模糊搜索接口
company: t.router({
  search: publicProcedure
    .input(z.object({ keyword: z.string().min(2) }))
    .query(async ({ input }) => {
      const appKey = process.env.QICHACHA_APP_KEY;
      const secretKey = process.env.QICHACHA_SECRET_KEY;
      
      if (!appKey || !secretKey) {
        // 如果没有配置API，返回本地数据
        return { companies: [] };
      }
      
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const sign = generateQccSign(appKey, secretKey, timestamp);
      
      const response = await fetch(
        `https://api.qichacha.com/FuzzySearch/GetList?key=${appKey}&searchKey=${encodeURIComponent(input.keyword)}`,
        {
          headers: {
            'Token': sign,
            'Timespan': timestamp,
          },
        }
      );
      
      const data = await response.json();
      
      if (data.Status === '200' && data.Result) {
        return {
          companies: data.Result.map((item: any) => ({
            name: item.Name,
            creditCode: item.CreditCode,
            legalPerson: item.OperName,
            status: item.Status,
            establishDate: item.StartDate,
            registeredCapital: item.RegistCapi,
            address: item.Address,
          })),
        };
      }
      
      return { companies: [] };
    }),
}),
```

### 前端组件 (client/src/pages/Home.tsx)

```tsx
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';

function CompanySearchInput() {
  const [keyword, setKeyword] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // 使用防抖查询
  const { data, isLoading } = trpc.company.search.useQuery(
    { keyword },
    { 
      enabled: keyword.length >= 2,
      staleTime: 30000, // 缓存30秒
    }
  );
  
  const handleInputChange = (value: string) => {
    setKeyword(value);
    
    // 防抖处理
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (value.length >= 2) {
        setShowSuggestions(true);
      }
    }, 300);
  };
  
  return (
    <div className="relative">
      <input
        type="text"
        value={keyword}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="请输入企业名称"
        className="w-full px-4 py-3 border rounded-lg"
      />
      
      {showSuggestions && data?.companies?.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-50">
          {data.companies.map((company, index) => (
            <div
              key={index}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              onClick={() => {
                setKeyword(company.name);
                setShowSuggestions(false);
              }}
            >
              <div className="font-medium">{company.name}</div>
              <div className="text-sm text-gray-500 flex gap-4">
                <span>法人: {company.legalPerson}</span>
                <span>状态: {company.status}</span>
                <span>成立: {company.establishDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 五、成本估算

| 场景 | 日均调用次数 | 月成本 |
|------|-------------|--------|
| 小型团队（10人） | 100次 | 约30元 |
| 中型团队（50人） | 500次 | 约150元 |
| 大型企业（200人） | 2000次 | 约600元 |

## 六、优化建议

### 1. 本地缓存
对热门企业搜索结果进行本地缓存，减少API调用次数。

### 2. 防抖处理
用户输入时使用300ms防抖，避免频繁调用API。

### 3. 最小字符限制
设置最少2个字符才触发搜索，减少无效调用。

### 4. 混合模式
优先使用本地历史记录和园区企业库，无结果时再调用企查查API。

## 七、替代方案（免费）

如果不想付费，可以使用以下免费方案：

### 方案A：爬取国家企业信用信息公示系统
- 网址：https://www.gsxt.gov.cn
- 缺点：需要处理验证码，可能被封IP

### 方案B：使用百度爱企查
- 网址：https://aiqicha.baidu.com
- 提供一定免费额度

### 方案C：本地企业库
- 导入全国企业基础数据（可从公开渠道获取）
- 建立本地搜索索引
- 缺点：数据更新不及时

## 八、总结

推荐使用**企查查「企业模糊搜索」API**，原因：
1. 官方正规渠道，数据准确可靠
2. 价格合理（0.10元/次）
3. 接入简单，文档完善
4. 返回信息丰富，满足联想需求

如需接入，请先在企查查开放平台注册账号并申请API权限。
