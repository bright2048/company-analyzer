// 著作权软著查询API (ApiCode: 233)
interface QccCopyright {
    Category: string;        // 作品类别 (如：美术)
    Name: string;            // 软件/作品名称
    Owner: string;           // 权利人
    RegisterNo: string;      // 登记号
    RegisterDate: string;    // 登记日期
    FinishDate: string;      // 完成日期  
    PublishDate: string;     // 发布日期
}

// 著作权软著查询API (ApiCode: 233)
async function callQichachaCopyrightApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccCopyright[] }> {
    const config = await getQichachaConfig();
    if (!config) return { total: 0, list: [] };

    const { appKey, secretKey } = config;

    // 从数据库获取API端点配置
    const apiConfig = await getQichachaApiConfigByCode('233');
    const endpoint = apiConfig?.endpoint || 'CopyRight/SearchCopyRight';
    const apiCost = apiConfig?.cost || '0.30';
    const paramName = apiConfig?.primaryParam || 'searchKey';

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
            // 修正：从Paging中获取总数，Result是数组
            const total = data.Paging?.TotalRecords || data.Result?.length || 0;

            await recordApiCall({
                apiType: 'qichacha_copyright',
                apiName: apiConfig?.apiName || '著作权软著查询',
                status: 'success',
                cost: apiCost,
                requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
                responseSummary: JSON.stringify({ total }),
            });

            return {
                total,
                list: data.Result || [], // Result直接是数组
            };
        }

        await recordApiCall({
            apiType: 'qichacha_copyright',
            apiName: apiConfig?.apiName || '著作权软著查询',
            status: 'failed',
            cost: apiCost,
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: data.Message || 'Unknown error',
        });
        return { total: 0, list: [] };
    } catch (error) {
        await recordApiCall({
            apiType: 'qichacha_copyright',
            apiName: apiConfig?.apiName || '著作权软著查询',
            status: 'failed',
            requestParams: JSON.stringify({ creditCode, endpoint }),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return { total: 0, list: [] };
    }
}