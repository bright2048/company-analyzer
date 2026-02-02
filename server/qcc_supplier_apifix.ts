// ... existing code ...
interface QccSupplier {
  SupplierName: string;    // 供应商名称 (来自 Name 字段)
  Ratio: string;           // 采购占比 (来自 PurchasePercent 字段)
  Amount: string;          // 采购金额 (来自 PurchaseAmount 字段)
  Year: string;            // 年份
  DataSource: string;      // 数据来源 (来自 Source 字段)
  KeyNo?: string;          // 供应商唯一标识
  ImageUrl?: string;       // 供应商头像/Logo地址
  Relationship?: string;   // 关系描述
}
// 供应商查询API (ApiCode: 724)
async function callQichachaSupplierApi(creditCode: string): Promise<QccSupplier[]> {
    const config = await getQichachaConfig();
    if (!config) return [];

    const { appKey, secretKey } = config;

    // 从数据库获取API端点配置
    const apiConfig = await getQichachaApiConfigByCode('724');
    const endpoint = apiConfig?.endpoint || 'Supplier/GetList';
    const apiCost = apiConfig?.cost || '0.50';
    const paramName = apiConfig?.primaryParam || 'searchKey';

    try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sign = generateQccSign(appKey, secretKey, timestamp);

        // 使用数据库配置的端点
        const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}`;

        const response = await fetch(url, {
            headers: { 'Token': sign, 'Timespan': timestamp },
        });

        const data = await response.json();

        if (data.Status === '200' && data.Result && Array.isArray(data.Result.DistributorList)) {
            // 修正：从 Result.DistributorList 中提取数据
            const supplierList = data.Result.DistributorList.map((supplier: any) => ({
                SupplierName: supplier.Name || '',      // 供应商名称对应 Name 字段
                Ratio: supplier.PurchasePercent || '',  // 采购占比对应 PurchasePercent 字段
                Amount: supplier.PurchaseAmount || '',  // 采购金额对应 PurchaseAmount 字段
                Year: supplier.Year || '',              // 年份对应 Year 字段
                DataSource: supplier.Source || ''       // 数据来源对应 Source 字段
            }));

            await recordApiCall({
                apiType: 'qichacha_supplier',
                apiName: apiConfig?.apiName || '供应商查询',
                status: 'success',
                cost: apiCost,
                requestParams: JSON.stringify({ creditCode, endpoint }),
                responseSummary: JSON.stringify({ count: supplierList.length }),
            });
            return supplierList;
        }

        await recordApiCall({
            apiType: 'qichacha_supplier',
            apiName: apiConfig?.apiName || '供应商查询',
            status: 'failed',
            cost: apiCost,
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: data.Message || 'Unknown error',
        });
        return [];
    } catch (error) {
        await recordApiCall({
            apiType: 'qichacha_supplier',
            apiName: apiConfig?.apiName || '供应商查询',
            status: 'failed',
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}



// 1. 开始映射API返回的供应商列表
const supplierList = data.Result.DistributorList.map((supplier: any) => ({
  // 2. 将API返回的Name字段赋值给我们的SupplierName属性
  SupplierName: supplier.Name || '',      // 供应商名称对应 Name 字段
  
  // 3. 将API返回的PurchasePercent字段赋值给我们的Ratio属性
  Ratio: supplier.PurchasePercent || '',  // 采购占比对应 PurchasePercent 字段
  
  // 4. 将API返回的PurchaseAmount字段赋值给我们的Amount属性
  Amount: supplier.PurchaseAmount || '',  // 采购金额对应 PurchaseAmount 字段
  
  // 5. 将API返回的Year字段赋值给我们的Year属性
  Year: supplier.Year || '',              // 年份对应 Year 字段
  
  // 6. 将API返回的Source字段赋值给我们的DataSource属性
  DataSource: supplier.Source || ''       // 数据来源对应 Source 字段
}));
// ... existing code ...