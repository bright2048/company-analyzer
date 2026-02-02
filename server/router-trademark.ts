// 商标查询API (ApiCode: 231)
async function callQichachaTrademarkApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccTrademark[] }> {
    const config = await getQichachaConfig();
    if (!config) return { total: 0, list: [] };

    const { appKey, secretKey } = config;

    // 从数据库获取API端点配置
    const apiConfig = await getQichachaApiConfigByCode('231');
  const endpoint = apiConfig?.endpoint || 'tm/SearchByApplicant';  // 修正端点为正确值
    const apiCost = apiConfig?.cost || '0.30';
    const paramName = apiConfig?.primaryParam || 'keyword';

    try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sign = generateQccSign(appKey, secretKey, timestamp);

        // 使用数据库配置的端点
        const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;

        const response = await fetch(url, {
            headers: { 'Token': sign, 'Timespan': timestamp },
        });

        const data = await response.json();

        if (data.Status === '200' && data.Result) {
      // tm/SearchByApplicant 接口返回结构：
      // { Result: { Total: N, Data: [...] } }
      let total = 0;
      let list: any[] = [];

      if (data.Result && data.Result.Data) {
        // 标准结构：{ Result: { Total: N, Data: [...] } }
        total = data.Result.Total || 0;
        list = data.Result.Data || [];
      } else if (Array.isArray(data.Result)) {
        // 兼容其他可能的结构：{ Result: [...] }
        total = data.Result.length;
        list = data.Result;
      }

            await recordApiCall({
                apiType: 'qichacha_trademark',
                apiName: apiConfig?.apiName || '商标查询',
                status: 'success',
                cost: apiCost,
                requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
                responseSummary: JSON.stringify({ total: data.Result.Total || 0 }),
            });
            return {
                total: data.Result.Total || 0,
                list: data.Result.Data || [],
            };
        }

        await recordApiCall({
            apiType: 'qichacha_trademark',
            apiName: apiConfig?.apiName || '商标查询',
            status: 'failed',
            cost: apiCost,
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: data.Message || 'Unknown error',
        });
        return { total: 0, list: [] };
    } catch (error) {
        await recordApiCall({
            apiType: 'qichacha_trademark',
            apiName: apiConfig?.apiName || '商标查询',
            status: 'failed',
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return { total: 0, list: [] };
    }
}