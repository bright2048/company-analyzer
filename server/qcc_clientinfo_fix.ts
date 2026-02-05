// 客户查询API (ApiCode: 723)
interface QccCustomer {
    CustomerName: string;    // 客户名称
    Ratio: string;           // 销售占比
    Amount: string;          // 销售金额
    Year: string;            // 年份
    DataSource: string;      // 数据来源
}

// 客户查询API (ApiCode: 723)
async function callQichachaCustomerApi(creditCode: string): Promise<QccCustomer[]> {
    const config = await getQichachaConfig();
    if (!config) return [];

    const { appKey, secretKey } = config;

    // 从数据库获取API端点配置
    const apiConfig = await getQichachaApiConfigByCode('723');
    const endpoint = apiConfig?.endpoint || 'Customer/GetList';
    const apiCost = apiConfig?.cost || '0.50';
    const paramName = apiConfig?.primaryParam || 'searchKey';

    try {
        const pageSize = 50;
        let pageIndex = 1;
        let totalRecords: number | null = null;
        const allClients: QccCustomer[] = [];

        while (true) {
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const sign = generateQccSign(appKey, secretKey, timestamp);

            // 使用数据库配置的端点
            const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;

            const response = await fetch(url, {
                headers: { 'Token': sign, 'Timespan': timestamp },
            });

            const data = await response.json();

            if (data.Status === '200' && data.Result) {
                if (pageIndex === 1) {
                    const parsedTotal = Number(data.Result.TotalRecords);
                    if (Number.isFinite(parsedTotal) && parsedTotal > 0) {
                        totalRecords = parsedTotal;
                    }
                }

                const clientList = Array.isArray(data.Result.ClientList)
                    ? data.Result.ClientList.map((client: any) => ({
                        CustomerName: client.Name || '',      // 客户名称对应 Name 字段
                        Ratio: client.SalesPercent || '',     // 销售占比对应 SalesPercent 字段
                        Amount: client.SalesAmount || '',     // 销售金额对应 SalesAmount 字段
                        Year: client.Year || '',              // 年份对应 Year 字段
                        DataSource: client.Source || ''       // 数据来源对应 Source 字段
                    }))
                    : [];

                allClients.push(...clientList);

                await recordApiCall({
                    apiType: 'qichacha_customer',
                    apiName: apiConfig?.apiName || '客户查询',
                    status: 'success',
                    cost: apiCost,
                    requestParams: JSON.stringify({ creditCode, endpoint, pageIndex, pageSize }),
                    responseSummary: JSON.stringify({
                        count: clientList.length,
                        totalRecords: totalRecords ?? 0,
                        pageIndex,
                        pageSize,
                    }),
                });

                const reachedEnd = totalRecords !== null
                    ? allClients.length >= totalRecords
                    : clientList.length < pageSize;

                if (reachedEnd) {
                    break;
                }

                pageIndex += 1;
                continue;
            }

            await recordApiCall({
                apiType: 'qichacha_customer',
                apiName: apiConfig?.apiName || '客户查询',
                status: 'failed',
                cost: apiCost,
                requestParams: JSON.stringify({ creditCode, endpoint, pageIndex, pageSize }),
                errorMessage: data.Message || 'Unknown error',
            });
            return [];
        }

        return allClients;
    } catch (error) {
        await recordApiCall({
            apiType: 'qichacha_customer',
            apiName: apiConfig?.apiName || '客户查询',
            status: 'failed',
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}
