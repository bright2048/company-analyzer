// ... existing code ...

// 资质证书API (ApiCode: 255)
interface QccCertificate {
  Id: string;              // 证书ID
  Name: string;            // 证书名称
  Type: string;            // 证书类型代码
  StartDate: string;       // 生效日期
  EndDate: string;         // 失效日期
  No: string;              // 证书编号
  TypeDesc: string;        // 证书类型描述
  InstitutionList: string[] | null; // 发证机构列表
  Status: string;          // 证书状态
}
// 资质证书API (ApiCode: 255)
async function callQichachaCertificateApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccCertificate[] }> {
  const config = await getQichachaConfig();
  if (!config) return { total: 0, list: [] };

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('255');
  const endpoint = apiConfig?.endpoint || 'ECICertification/SearchCertification';
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
      // 根据API实际返回结构调整：Result是数组，总数从Paging中获取
      const total = data.Paging?.TotalRecords || data.Result?.length || 0;

      await recordApiCall({
        apiType: 'qichacha_certificate',
        apiName: apiConfig?.apiName || '资质证书',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
        responseSummary: JSON.stringify({ total }),
      });

      return {
        total,
        list: data.Result || [],
      };
    }

    await recordApiCall({
      apiType: 'qichacha_certificate',
      apiName: apiConfig?.apiName || '资质证书',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });
    return { total: 0, list: [] };
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_certificate',
      apiName: apiConfig?.apiName || '资质证书',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return { total: 0, list: [] };
  }
}

// ... existing code ...