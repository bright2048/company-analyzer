/**
 * 企查查 API 服务层
 * 从 routers.ts 抽取，便于维护
 */
import crypto from "crypto";
import {
  getActiveDataSource,
  getDataSourceConfigs,
  getQichachaApiConfigByCode,
  recordApiCall,
  getCacheDaysConfig,
  getQichachaFullDataCache,
  isCacheValid,
  updateCacheHitCount,
  saveQichachaFullDataCache,
} from "../db";
import { logQcc } from "../logger";

// 企查查API签名生成（导出供 fix 脚本使用）
export function generateQccSign(appKey: string, secretKey: string, timestamp: string): string {
  const signStr = appKey + timestamp + secretKey;
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

// 企查查API基础URL（导出供 fix 脚本使用）
export const QCC_BASE_URL = 'https://api.qichacha.com';

// 获取企查查API配置（优先从数据库读取，其次从环境变量读取）
export async function getQichachaConfig(): Promise<{ appKey: string; secretKey: string } | null> {
  try {
    // 1. 检查当前启用的数据源是否是企查查
    const activeSource = await getActiveDataSource();
    if (activeSource?.sourceType !== 'qichacha') {
      console.log('[QCC] Data source is not qichacha, current:', activeSource?.sourceType || 'web');
      return null;
    }

    // 2. 从数据库读取企查查配置
    const configs = await getDataSourceConfigs();
    const qccConfig = configs.find(c => c.sourceType === 'qichacha');

    if (qccConfig && qccConfig.apiKey && qccConfig.apiSecret) {
      console.log('[QCC] Using config from database');
      return {
        appKey: qccConfig.apiKey,
        secretKey: qccConfig.apiSecret,
      };
    }

    // 3. 其次从环境变量读取
    const envAppKey = process.env.QICHACHA_APP_KEY;
    const envSecretKey = process.env.QICHACHA_SECRET_KEY;

    if (envAppKey && envSecretKey) {
      console.log('[QCC] Using config from environment variables');
      return {
        appKey: envAppKey,
        secretKey: envSecretKey,
      };
    }

    console.log('[QCC] No config found in database or environment');
    return null;
  } catch (error) {
    console.error('[QCC] Error getting config:', error);

    // 数据库读取失败时，尝试从环境变量读取
    const envAppKey = process.env.QICHACHA_APP_KEY;
    const envSecretKey = process.env.QICHACHA_SECRET_KEY;

    if (envAppKey && envSecretKey) {
      return {
        appKey: envAppKey,
        secretKey: envSecretKey,
      };
    }

    return null;
  }
}

/**
 * 通用企查查API调用函数
 * 从数据库读取API端点配置，然后拼接URL调用
 * 
 * @param apiCode API代码（如417、730、731等）
 * @param params 请求参数（不含基础参数key）
 * @returns API响应数据
 */
async function callQichachaApiGeneric(
  apiCode: string,
  params: Record<string, string>
): Promise<{ success: boolean; data?: unknown; error?: string; httpStatus?: number; apiStatus?: string }> {
  // 获取基础配置
  const config = await getQichachaConfig();
  if (!config) {
    return { success: false, error: 'API not configured' };
  }

  // 获取API配置
  const apiConfig = await getQichachaApiConfigByCode(apiCode);
  if (!apiConfig) {
    await logQcc(`API配置未找到: ${apiCode}`);
    return { success: false, error: `API config not found: ${apiCode}` };
  }

  if (!apiConfig.isEnabled) {
    await logQcc(`API ${apiCode} (${apiConfig.apiName}) 已禁用`);
    return { success: false, error: `API disabled: ${apiConfig.apiName}` };
  }

  const { appKey, secretKey } = config;

  let httpStatus = 0;
  let responseText = '';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 构建请求URL
    const queryParams = new URLSearchParams({ key: appKey, ...params });
    const url = `${QCC_BASE_URL}/${apiConfig.endpoint}?${queryParams.toString()}`;

    await logQcc(`调用API ${apiCode} (${apiConfig.apiName})`, { url: url.replace(appKey, '***'), params });

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    httpStatus = response.status;
    responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      const errorDetail = `JSON解析失败 | HTTP状态码: ${httpStatus}`;
      await logQcc(`API ${apiCode} 响应解析失败`, { httpStatus, rawResponse: responseText.substring(0, 500) });
      return { success: false, error: errorDetail, httpStatus };
    }

    await logQcc(`API ${apiCode} 响应`, { httpStatus, apiStatus: data.Status, message: data.Message });

    if (data.Status === '200') {
      return { success: true, data: data.Result, httpStatus, apiStatus: data.Status };
    }

    // API返回非200状态，记录详细错误信息
    const errorDetail = `错误码: ${data.Status} | 错误信息: ${data.Message || '无'} | HTTP状态码: ${httpStatus}`;
    await logQcc(`API ${apiCode} 调用失败`, { errorDetail, rawResponse: responseText.substring(0, 500) });
    return { success: false, error: errorDetail, httpStatus, apiStatus: data.Status };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorDetail = `异常类型: ${error instanceof Error ? error.constructor.name : 'Unknown'} | 错误信息: ${errorMsg} | HTTP状态码: ${httpStatus || '未知'}`;
    await logQcc(`API ${apiCode} 调用异常`, { errorDetail, httpStatus, rawResponse: responseText?.substring(0, 500) });
    return { success: false, error: errorDetail, httpStatus: httpStatus || undefined };
  }
}

// 企查查API返回结果类型
export interface QccCompanyResult {
  name: string;
  creditCode: string;
  legalPerson?: string;
  status?: string;
  establishDate?: string;
  registeredCapital?: string;
  address?: string;
}

// 调用企查查企业模糊搜索API (ApiCode: 886)
export async function callQichachaApi(keyword: string): Promise<QccCompanyResult[]> {
  // 优先从数据库读取配置，其次从环境变量读取
  const config = await getQichachaConfig();

  // 如果没有配置API密钥，返回空数组
  if (!config) {
    console.log('[QCC] API not configured, skipping');
    return [];
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('886');
  const endpoint = apiConfig?.endpoint || 'FuzzySearch/GetList';
  const apiCost = apiConfig?.cost || '0.10';

  let httpStatus = 0;
  let responseText = '';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&searchKey=${encodeURIComponent(keyword)}`;

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    httpStatus = response.status;
    responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // JSON解析失败，记录原始响应
      const error = parseError as Error;
      console.error('[QCC Search] JSON parse error:', error.message);
      console.error('[QCC Search] JSON parse error, raw response:', responseText.substring(0, 500));
      await recordApiCall({
        apiType: 'qichacha_search',
        apiName: apiConfig?.apiName || '企业模糊搜索',
        status: 'failed',
        cost: apiCost,
        companyName: keyword,
        requestParams: JSON.stringify({ keyword, endpoint }),
        errorMessage: `JSON解析失败 | HTTP状态码: ${httpStatus}`,
        responseSummary: JSON.stringify({ httpStatus, rawResponse: responseText.substring(0, 1000) }),
      });
      return [];
    }

    console.log('[QCC Search] HTTP Status:', httpStatus, 'API Status:', data.Status, 'Message:', data.Message);

    if (data.Status === '200' && data.Result && Array.isArray(data.Result)) {
      // 记录API调用成功
      await recordApiCall({
        apiType: 'qichacha_search',
        apiName: apiConfig?.apiName || '企业模糊搜索',
        status: 'success',
        cost: apiCost,
        companyName: keyword,
        requestParams: JSON.stringify({ keyword, endpoint }),//2026-01-30：把 json 对象转换成字符串
        responseSummary: JSON.stringify({ count: data.Result.length, httpStatus }),
      });
      //2026-01-30：返回企查查接口调用结果
      return data.Result.map((item: {
        Name?: string;
        CreditCode?: string;
        OperName?: string;
        Status?: string;
        StartDate?: string;
        RegistCapi?: string;
        Address?: string;
      }) => ({
        name: item.Name || '',
        creditCode: item.CreditCode || '',
        legalPerson: item.OperName,
        status: item.Status,
        establishDate: item.StartDate,
        registeredCapital: item.RegistCapi,
        address: item.Address,
      })).filter((c: QccCompanyResult) => c.name && c.creditCode);
    }

    // API返回非200状态，记录详细错误信息
    const errorDetail = `错误码: ${data.Status} | 错误信息: ${data.Message || '无'} | HTTP状态码: ${httpStatus}`;
    console.error('[QCC Search] API Error:', errorDetail);

    await recordApiCall({
      apiType: 'qichacha_search',
      apiName: apiConfig?.apiName || '企业模糊搜索',
      status: 'failed',
      cost: apiCost,
      companyName: keyword,
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: errorDetail,
      responseSummary: JSON.stringify({
        httpStatus,
        apiStatus: data.Status,
        apiMessage: data.Message,
        rawResponse: responseText.substring(0, 500)
      }),
    });

    return [];
  } catch (error) {
    // 网络错误或其他异常
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorDetail = `异常类型: ${error instanceof Error ? error.constructor.name : 'Unknown'} | 错误信息: ${errorMsg} | HTTP状态码: ${httpStatus || '未知'}`;
    console.error('[QCC Search] API call failed:', errorDetail, error);

    await recordApiCall({
      apiType: 'qichacha_search',
      apiName: apiConfig?.apiName || '企业模糊搜索',
      status: 'failed',
      companyName: keyword,
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: errorDetail,
      responseSummary: httpStatus ? JSON.stringify({ httpStatus, rawResponse: responseText?.substring(0, 500) }) : undefined,
    });

    return [];
  }
}

// 调用企查查企业工商信息详情API
interface QccCompanyDetail {
  Name: string;
  CreditCode: string;
  OperName: string;
  Status: string;
  StartDate: string;
  RegistCapi: string;
  RecCap: string;  // 实缴资本
  Address: string;
  Scope: string;
  Industry: string;
  Province: string;
  City: string;
  District: string;
  EconKind: string;
  TermStart: string;
  TermEnd: string;
  CheckDate: string;
  OrgNo: string;
  TaxNo: string;
}

// 调用企查查企业工商信息API (ApiCode: 410)
async function callQichachaDetailApi(creditCode: string): Promise<QccCompanyDetail | null> {
  // 优先从数据库读取配置，其次从环境变量读取
  const config = await getQichachaConfig();

  if (!config) {
    console.log('[QCC] API not configured, skipping detail');
    return null;
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('410');
  const endpoint = apiConfig?.endpoint || 'ECIV4/GetBasicDetailsByName';
  const apiCost = apiConfig?.cost || '0.20';
  const paramName = apiConfig?.primaryParam || 'keyword';

  let httpStatus = 0;
  let responseText = '';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点和参数名
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}`;

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    httpStatus = response.status;
    responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // JSON解析失败，记录原始响应
      console.error('[QCC Detail] JSON parse error, raw response:', responseText.substring(0, 500));
      await recordApiCall({
        apiType: 'qichacha_detail',
        apiName: apiConfig?.apiName || '企业工商详情',
        status: 'failed',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, endpoint }),
        errorMessage: `JSON解析失败 | HTTP状态码: ${httpStatus}`,
        responseSummary: JSON.stringify({ httpStatus, rawResponse: responseText.substring(0, 1000) }),
      });
      return null;
    }

    console.log('[QCC Detail] HTTP Status:', httpStatus, 'API Status:', data.Status, 'Message:', data.Message, 'Has Result:', !!data.Result);
    if (data.Result) {
      console.log('[QCC Detail] Result Name:', data.Result.Name, 'CreditCode:', data.Result.CreditCode);
    }

    if (data.Status === '200' && data.Result) {
      await recordApiCall({
        apiType: 'qichacha_detail',
        apiName: apiConfig?.apiName || '企业工商信息',
        status: 'success',
        cost: apiCost,
        companyName: data.Result.Name,
        requestParams: JSON.stringify({ creditCode, endpoint }),
        responseSummary: JSON.stringify({ name: data.Result.Name, httpStatus }),
      });
      return data.Result;
    }

    // API返回非200状态，记录详细错误信息
    const errorDetail = `错误码: ${data.Status} | 错误信息: ${data.Message || '无'} | HTTP状态码: ${httpStatus}`;
    console.error('[QCC Detail] API Error:', errorDetail);

    await recordApiCall({
      apiType: 'qichacha_detail',
      apiName: apiConfig?.apiName || '企业工商详情',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: errorDetail,
      responseSummary: JSON.stringify({
        httpStatus,
        apiStatus: data.Status,
        apiMessage: data.Message,
        rawResponse: responseText.substring(0, 500)
      }),
    });

    return null;
  } catch (error) {
    // 网络错误或其他异常
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorDetail = `异常类型: ${error instanceof Error ? error.constructor.name : 'Unknown'} | 错误信息: ${errorMsg} | HTTP状态码: ${httpStatus || '未知'}`;
    console.error('[QCC Detail] API call failed:', errorDetail, error);

    await recordApiCall({
      apiType: 'qichacha_detail',
      apiName: apiConfig?.apiName || '企业工商详情',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: errorDetail,
      responseSummary: httpStatus ? JSON.stringify({ httpStatus, rawResponse: responseText?.substring(0, 500) }) : undefined,
    });
    return null;
  }
}

// 调用企查查企业股东信息API
interface QccShareholder {
  StockName: string;
  StockType: string;
  StockPercent: string;
  ShouldCapi: string;
  ShoudDate: string;
  InvestType: string;
  InvestName: string;
}

// 调用企查查企业股东信息API (ApiCode: 731)
async function callQichachaShareholderApi(creditCode: string): Promise<QccShareholder[]> {
  // 优先从数据库读取配置，其次从环境变量读取
  const config = await getQichachaConfig();

  if (!config) {
    return [];
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('731');
  const endpoint = apiConfig?.endpoint || 'ECIPartner/GetList';
  const apiCost = apiConfig?.cost || '0.10';
  const paramName = apiConfig?.primaryParam || 'searchKey';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}`;
    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    const data = await response.json();

    // 官方文档确认: Result直接是数组，不是Result.PartnerList
    console.log('[QCC Shareholder] API Response Status:', data.Status, 'Result type:', typeof data.Result, 'Is Array:', Array.isArray(data.Result));
    if (data.Status === '200' && data.Result && Array.isArray(data.Result)) {
      await recordApiCall({
        apiType: 'qichacha_shareholder',
        apiName: apiConfig?.apiName || '股东信息',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, endpoint }),
        responseSummary: JSON.stringify({ count: data.Result.length }),
      });
      return data.Result;
    }

    // 记录失败原因
    console.log('[QCC Shareholder] API Failed - Status:', data.Status, 'Message:', data.Message);
    console.log('[QCC Shareholder] Full response:', JSON.stringify(data).substring(0, 500));

    await recordApiCall({
      apiType: 'qichacha_shareholder',
      apiName: apiConfig?.apiName || '股东信息',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });

    return [];
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_shareholder',
      apiName: apiConfig?.apiName || '股东信息',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

// 调用企查查企业高管信息API
interface QccExecutive {
  Name: string;
  Job: string;
}

// 调用企查查企业高管信息API (ApiCode: 732)
async function callQichachaExecutiveApi(creditCode: string): Promise<QccExecutive[]> {
  // 优先从数据库读取配置，其次从环境变量读取
  const config = await getQichachaConfig();

  if (!config) {
    return [];
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('732');
  const endpoint = apiConfig?.endpoint || 'ECIEmployee/GetList';
  const apiCost = apiConfig?.cost || '0.10';
  const paramName = apiConfig?.primaryParam || 'searchKey';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}`;

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    const data = await response.json();

    // 官方文档确认: Result直接是数组，不是Result.EmployeeList
    console.log('[QCC Executive] API Response Status:', data.Status, 'Result type:', typeof data.Result, 'Is Array:', Array.isArray(data.Result));
    if (data.Status === '200' && data.Result && Array.isArray(data.Result)) {
      await recordApiCall({
        apiType: 'qichacha_executive',
        apiName: apiConfig?.apiName || '高管信息',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, endpoint }),
        responseSummary: JSON.stringify({ count: data.Result.length }),
      });
      return data.Result;
    }

    // 记录失败原因
    console.log('[QCC Executive] API Failed - Status:', data.Status, 'Message:', data.Message);
    console.log('[QCC Executive] Full response:', JSON.stringify(data).substring(0, 500));

    await recordApiCall({
      apiType: 'qichacha_executive',
      apiName: apiConfig?.apiName || '高管信息',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });

    return [];
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_executive',
      apiName: apiConfig?.apiName || '高管信息',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

// ============ 新增企查查API接口 ============

// 专利查询API (ApiCode: 514)
interface QccPatent {
  Title: string;           // 专利名称
  PatentType: string;      // 专利类型（发明专利/实用新型/外观设计）
  ApplicationNumber: string; // 申请号
  ApplicationDate: string; // 申请日期
  PublicationNumber: string; // 公开号
  PublicationDate: string; // 公开日期
  LegalStatus: string;     // 法律状态
  Inventor: string;        // 发明人
  Agency: string;          // 代理机构
  Abstract: string;        // 摘要
}

// 专利查询API (ApiCode: 514)
async function callQichachaPatentApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccPatent[] }> {
  const config = await getQichachaConfig();
  if (!config) return { total: 0, list: [] };

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('514');
  const endpoint = apiConfig?.endpoint || 'PatentV4/SearchMultiPatents';
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

    if (data.Status === '200') {
      // PatentV4/SearchMultiPatents 接口返回结构：
      // { Paging: { TotalRecords: N }, Result: [...] }
      // 兼容旧结构：{ Result: { Total: N, Data: [...] } }
      let total = 0;
      let list: any[] = [];

      if (data.Paging && Array.isArray(data.Result)) {
        // 新结构：PatentV4/SearchMultiPatents
        total = data.Paging.TotalRecords || data.Result.length;
        list = data.Result.map((item: any) => ({
          Title: item.Title || '',
          PatentType: item.KindCodeDesc || '',
          ApplicationNumber: item.ApplicationNumber || '',
          ApplicationDate: item.ApplicationDate || '',
          PublicationNumber: item.PublicationNumber || '',
          PublicationDate: item.PublicationDate || '',
          LegalStatus: item.LegalStatusDesc || '',
          Inventor: Array.isArray(item.InventorStringList) ? item.InventorStringList.join('、') : '',
          Agency: Array.isArray(item.Agency) ? item.Agency.join('、') : '',
          Abstract: '',  // 该接口不返回摘要
          IPCDesc: Array.isArray(item.IPCDesc) ? item.IPCDesc.join('、') : '',
        }));
      } else if (data.Result && data.Result.Data) {
        // 旧结构：PatentV4/Search
        total = data.Result.Total || 0;
        list = data.Result.Data || [];
      }

      await recordApiCall({
        apiType: 'qichacha_patent',
        apiName: apiConfig?.apiName || '专利查询',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
        responseSummary: JSON.stringify({ total, listCount: list.length }),
      });
      return { total, list };
    }

    await recordApiCall({
      apiType: 'qichacha_patent',
      apiName: apiConfig?.apiName || '专利查询',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });
    return { total: 0, list: [] };
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_patent',
      apiName: apiConfig?.apiName || '专利查询',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return { total: 0, list: [] };
  }
}

// 商标查询API (ApiCode: 231)
interface QccTrademark {
  Name: string;            // 商标名称
  RegNo: string;           // 注册号
  IntCls: string;          // 国际分类
  Status: string;          // 商标状态
  AppDate: string;         // 申请日期
  RegDate: string;         // 注册日期
  ImageUrl: string;        // 商标图片
  FlowList: { Date: string; Status: string }[]; // 流程信息
}

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
      // 根据真实API返回格式：tm/SearchByApplicant 接口
      // { Paging: { TotalRecords: N }, Result: [...] }
      const total = data.Paging?.TotalRecords || data.Result.length || 0;

      // 直接使用Result数组作为商标列表
      const list: QccTrademark[] = data.Result.map((item: any) => ({
        Name: item.Name || '',                      // 商标名称
        RegNo: item.RegNo || '',                    // 注册号
        IntCls: item.CategoryId?.toString() || item.IntClass || '',  // 国际分类
        Status: item.FlowStatusDesc || item.Status || '',           // 商标状态
        AppDate: item.AppDate || '',                // 申请日期
        RegDate: item.RegDate || '',                // 注册日期
        ImageUrl: item.ImageUrl || '',              // 商标图片
        FlowList: item.FlowList || item.Flow ? [{ Date: '', Status: item.Flow }] : [], // 流程信息
      }));

      await recordApiCall({
        apiType: 'qichacha_trademark',
        apiName: apiConfig?.apiName || '商标查询',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
        responseSummary: JSON.stringify({ total, listCount: list.length }),
      });
      return { total, list };
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


// // 商标查询API (ApiCode: 231)
// async function callQichachaTrademarkApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccTrademark[] }> {
//   const config = await getQichachaConfig();
//   if (!config) return { total: 0, list: [] };

//   const { appKey, secretKey } = config;

//   // 从数据库获取API端点配置
//   const apiConfig = await getQichachaApiConfigByCode('231');
//   const endpoint = apiConfig?.endpoint || 'tm/SearchByApplicant';
//   const apiCost = apiConfig?.cost || '0.30';
//   const paramName = apiConfig?.primaryParam || 'keyword';

//   try {
//     const timestamp = Math.floor(Date.now() / 1000).toString();
//     const sign = generateQccSign(appKey, secretKey, timestamp);

//     // 使用数据库配置的端点
//     const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;

//     const response = await fetch(url, {
//       headers: { 'Token': sign, 'Timespan': timestamp },
//     });

//     const data = await response.json();

//     if (data.Status === '200' && data.Result) {
//       await recordApiCall({
//         apiType: 'qichacha_trademark',
//         apiName: apiConfig?.apiName || '商标查询',
//         status: 'success',
//         cost: apiCost,
//         requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
//         responseSummary: JSON.stringify({ total: data.Result.Total || 0 }),
//       });
//       return {
//         total: data.Result.Total || 0,
//         list: data.Result.Data || [],
//       };
//     }

//     await recordApiCall({
//       apiType: 'qichacha_trademark',
//       apiName: apiConfig?.apiName || '商标查询',
//       status: 'failed',
//       cost: apiCost,
//       requestParams: JSON.stringify({ creditCode, endpoint }),
//       errorMessage: data.Message || 'Unknown error',
//     });
//     return { total: 0, list: [] };
//   } catch (error) {
//     await recordApiCall({
//       apiType: 'qichacha_trademark',
//       apiName: apiConfig?.apiName || '商标查询',
//       status: 'failed',
//       requestParams: JSON.stringify({ creditCode, endpoint }),
//       errorMessage: error instanceof Error ? error.message : 'Unknown error',
//     });
//     return { total: 0, list: [] };
//   }
// }

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

// 供应商查询API (ApiCode: 724)
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
    const pageSize = 50;
    let pageIndex = 1;
    let totalRecords: number | null = null;
    const allSuppliers: QccSupplier[] = [];

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

        const supplierList = Array.isArray(data.Result.DistributorList)
          ? data.Result.DistributorList.map((supplier: any) => ({
              SupplierName: supplier.Name || '',      // 供应商名称对应 Name 字段
              Ratio: supplier.PurchasePercent || '',  // 采购占比对应 PurchasePercent 字段
              Amount: supplier.PurchaseAmount || '',  // 采购金额对应 PurchaseAmount 字段
              Year: supplier.Year || '',              // 年份对应 Year 字段
              DataSource: supplier.Source || ''       // 数据来源对应 Source 字段
            }))
          : [];

        allSuppliers.push(...supplierList);

        await recordApiCall({
          apiType: 'qichacha_supplier',
          apiName: apiConfig?.apiName || '供应商查询',
          status: 'success',
          cost: apiCost,
          requestParams: JSON.stringify({ creditCode, endpoint, pageIndex, pageSize }),
          responseSummary: JSON.stringify({
            count: supplierList.length,
            totalRecords: totalRecords ?? 0,
            pageIndex,
            pageSize,
          }),
        });

        const reachedEnd = totalRecords !== null
          ? allSuppliers.length >= totalRecords
          : supplierList.length < pageSize;

        if (reachedEnd) {
          break;
        }

        pageIndex += 1;
        continue;
      }

      await recordApiCall({
        apiType: 'qichacha_supplier',
        apiName: apiConfig?.apiName || '供应商查询',
        status: 'failed',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, endpoint, pageIndex, pageSize }),
        errorMessage: data.Message || 'Unknown error',
      });
      return [];
    }

    return allSuppliers;
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

// 企业年报信息API (ApiCode: 213)
// 社保信息结构
interface QccSocialSecurityInfo {
  UrbanBasicIns: string;           // 城镇职工基本养老保险参保人数
  EmployeeBasicIns: string;        // 职工基本医疗保险参保人数
  MaternityIns: string;            // 生育保险参保人数
  UnemploymentIns: string;         // 失业保险参保人数
  IndustrialInjuryIns: string;     // 工伤保险参保人数
}

interface QccAnnualReport {
  Year: string;            // 年报年份
  TotalAssets: string;     // 资产总额
  TotalEquity: string;     // 所有者权益
  TotalSales: string;      // 营业总收入
  TotalProfit: string;     // 利润总额
  NetProfit: string;       // 净利润
  TotalTax: string;        // 纳税总额
  TotalLiability: string;  // 负债总额
  SocialSecurityInfo: QccSocialSecurityInfo; // 社保信息（包含参保人数）- 代码字段
  SocialInsurance: QccSocialSecurityInfo; // 社保信息 - API实际返回字段
  SocialSecurityNum: string; // 社保人数（兼容旧字段）
  WebsiteInfos: { Name: string; Website: string }[]; // 网站信息 - 代码字段
  WebSiteList: { No: number; Type: string; Name: string; WebSite: string }[]; // 网站信息 - API实际返回字段
  PartnerInfos: { Name: string; Amount: string; Percent: string }[]; // 股东出资信息
}

// 企业年报信息API (ApiCode: 213)
async function callQichachaAnnualReportApi(creditCode: string): Promise<QccAnnualReport[]> {
  const config = await getQichachaConfig();
  if (!config) return [];

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('213');
  const endpoint = apiConfig?.endpoint || 'AR/GetAnnualReport';
  const apiCost = apiConfig?.cost || '1.00';
  const paramName = apiConfig?.primaryParam || 'keyNo';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}`;

    const response = await fetch(url, {
      headers: { 'Token': sign, 'Timespan': timestamp },
    });

    const data = await response.json();

    if (data.Status === '200' && data.Result && Array.isArray(data.Result)) {
      await recordApiCall({
        apiType: 'qichacha_annual_report',
        apiName: apiConfig?.apiName || '企业年报信息',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, endpoint }),
        responseSummary: JSON.stringify({ count: data.Result.length }),
      });
      return data.Result;
    }

    await recordApiCall({
      apiType: 'qichacha_annual_report',
      apiName: apiConfig?.apiName || '企业年报信息',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });
    return [];
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_annual_report',
      apiName: apiConfig?.apiName || '企业年报信息',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

// 资质证书API (ApiCode: 255)
interface QccCertificate {
  Id: string;              // 证书ID
  Name: string;            // 证书名称
  CertName?: string;       // 证书名称（API 别名）
  Type: string;            // 证书类型代码
  StartDate: string;       // 生效日期
  EndDate: string;         // 失效日期
  No: string;              // 证书编号
  CertNo?: string;         // 证书编号（API 别名）
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
    console.log(`Calling Qichacha API（资质证书 255）: ${url}`);

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
      console.log('API call recorded successfully with total records:', total);
      console.log('API call recorded successfully with list:', data.Result);
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

// 企业人员董监高详细信息API (ApiCode: 669)
// ECISeniorPerson/GetList 接口返回的是某个人在哪些企业任职的信息
interface QccExecutiveRelation {
  Name: string;            // 企业名称
  CreditCode: string;      // 统一社会信用代码
  OperName: string;        // 法人姓名
  Status: string;          // 企业状态
  RegCap: string;          // 注册资本
  Date: string;            // 成立日期
  RelationList: { Type: string; TypeDesc: string; Value: string }[];  // 关系列表
  Industry: { Industry: string; SubIndustry: string };  // 行业
  Area: { Province: string; City: string; County: string };  // 地区
}

// 高管详细信息（整合后的结构）
interface QccExecutiveDetail {
  Name: string;            // 姓名
  Job: string;             // 在本企业的职务
  Education: string;       // 学历（此接口不返回）
  Introduction: string;    // 简介（此接口不返回）
  OtherCompany: { Name: string; Job: string; Status: string }[]; // 其他任职企业
  TotalCompanies: number;  // 关联企业总数
  AsLegalRep: number;      // 担任法人的企业数
  AsExecutive: number;     // 任职的企业数
}

// 企业人员董监高详细信息API (ApiCode: 669)
// 此接口需要传入 searchKey(企业信用代码) 和 personName(人员姓名)
// 返回该人员在其他企业的任职情况
async function callQichachaExecutiveDetailApi(
  creditCode: string,
  executives: QccExecutive[] = []
): Promise<QccExecutiveDetail[]> {
  const config = await getQichachaConfig();
  if (!config) return [];

  // 如果没有高管列表，无法查询详细信息
  if (!executives || executives.length === 0) {
    console.log('[QCC] No executives provided, skipping executive detail query');
    return [];
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('669');
  const endpoint = apiConfig?.endpoint || 'ECISeniorPerson/GetList';
  const apiCost = apiConfig?.cost || '0.30';

  // 只查询前5位关键高管，避免过多API调用
  const keyExecutives = executives.slice(0, 5);
  const results: QccExecutiveDetail[] = [];

  for (const exec of keyExecutives) {
    if (!exec.Name) continue;

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const sign = generateQccSign(appKey, secretKey, timestamp);

      // ECISeniorPerson/GetList 需要两个参数：searchKey 和 personName
      const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&searchKey=${encodeURIComponent(creditCode)}&personName=${encodeURIComponent(exec.Name)}`;

      console.log(`[QCC] Querying executive detail for: ${exec.Name}`);

      const response = await fetch(url, {
        headers: { 'Token': sign, 'Timespan': timestamp },
      });

      const data = await response.json();

      if (data.Status === '200') {
        // 解析返回数据
        const totalRecords = data.Paging?.TotalRecords || 0;
        const relationList = data.Result || [];

        // 统计担任法人和任职的企业数
        let asLegalRep = 0;
        let asExecutive = 0;

        // 从 GroupItems 中获取统计信息
        if (data.GroupItems && Array.isArray(data.GroupItems)) {
          const typeGroup = data.GroupItems.find((g: any) => g.Key === 'type');
          if (typeGroup && typeGroup.Items) {
            const legalRepItem = typeGroup.Items.find((i: any) => i.Value === '0');
            const execItem = typeGroup.Items.find((i: any) => i.Value === '2');
            asLegalRep = legalRepItem ? parseInt(legalRepItem.Count) || 0 : 0;
            asExecutive = execItem ? parseInt(execItem.Count) || 0 : 0;
          }
        }

        // 构建其他任职企业列表（排除当前企业）
        const otherCompanies = relationList
          .filter((r: any) => r.CreditCode !== creditCode)
          .slice(0, 10)  // 最多取10家
          .map((r: any) => {
            // 从 RelationList 中提取职务
            const jobs = r.RelationList?.map((rel: any) => rel.Value).filter(Boolean).join('、') || '';
            return {
              Name: r.Name || '',
              Job: jobs,
              Status: r.Status || '',
            };
          });

        results.push({
          Name: exec.Name,
          Job: exec.Job || '',
          Education: '',  // 此接口不返回学历
          Introduction: '',  // 此接口不返回简介
          OtherCompany: otherCompanies,
          TotalCompanies: totalRecords,
          AsLegalRep: asLegalRep,
          AsExecutive: asExecutive,
        });

        await recordApiCall({
          apiType: 'qichacha_executive_detail',
          apiName: apiConfig?.apiName || '企业人员董监高信息',
          status: 'success',
          cost: apiCost,
          requestParams: JSON.stringify({ creditCode, personName: exec.Name, endpoint }),
          responseSummary: JSON.stringify({
            totalCompanies: totalRecords,
            asLegalRep,
            asExecutive,
            otherCompaniesCount: otherCompanies.length
          }),
        });
      } else {
        // API返回错误
        const errorMsg = `错误码: ${data.Status} | 错误信息: ${data.Message || 'Unknown'}`;
        console.log(`[QCC] Executive detail query failed for ${exec.Name}: ${errorMsg}`);

        await recordApiCall({
          apiType: 'qichacha_executive_detail',
          apiName: apiConfig?.apiName || '企业人员董监高信息',
          status: 'failed',
          cost: '0',  // 失败不计费
          requestParams: JSON.stringify({ creditCode, personName: exec.Name, endpoint }),
          errorMessage: errorMsg,
          responseSummary: JSON.stringify(data).substring(0, 500),
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[QCC] Executive detail query exception for ${exec.Name}: ${errorMsg}`);

      await recordApiCall({
        apiType: 'qichacha_executive_detail',
        apiName: apiConfig?.apiName || '企业人员董监高信息',
        status: 'failed',
        requestParams: JSON.stringify({ creditCode, personName: exec.Name, endpoint }),
        errorMessage: errorMsg,
      });
    }

    // 添加延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[QCC] Executive details fetched: ${results.length} executives`);
  return results;
}

// 股权穿透(四层)API (ApiCode: 642) - 查询上游股东
async function callQichachaEquityThroughApi(keyword: string): Promise<QccEquityThrough | null> {
  const config = await getQichachaConfig();
  if (!config) {
    console.log('[QCC] API not configured, skipping equity through');
    return null;
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('642');
  const endpoint = apiConfig?.endpoint || 'EquityThrough/GetEquityThrough';
  const apiCost = apiConfig?.cost || '0.50';
  const paramName = apiConfig?.primaryParam || 'keyWord';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(keyword)}&level=4`;

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    const data = await response.json();

    if (data.Status === '200' && data.Result) {
      await recordApiCall({
        apiType: 'qichacha_equity_through',
        apiName: apiConfig?.apiName || '股权穿透(四层)',
        status: 'success',
        cost: apiCost,
        companyName: data.Result.Name,
        requestParams: JSON.stringify({ keyword, endpoint }),
        responseSummary: JSON.stringify({ childrenCount: data.Result.Count }),
      });
      return data.Result;
    }

    await recordApiCall({
      apiType: 'qichacha_equity_through',
      apiName: apiConfig?.apiName || '股权穿透(四层)',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });

    return null;
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_equity_through',
      apiName: apiConfig?.apiName || '股权穿透(四层)',
      status: 'failed',
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[QCC] Equity Through API call failed:', error);
    return null;
  }
}

// 对外投资穿透(十层)API (ApiCode: 663) - 查询下游子公司
async function callQichachaInvestmentThroughApi(keyword: string): Promise<QccInvestmentThrough | null> {
  const config = await getQichachaConfig();
  if (!config) {
    console.log('[QCC] API not configured, skipping investment through');
    return null;
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('663');
  const endpoint = apiConfig?.endpoint || 'ECIInvestmentThrough/GetInfo';
  const apiCost = apiConfig?.cost || '0.50';
  const paramName = apiConfig?.primaryParam || 'searchKey';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    // percent: 持股比例阈值，设为0表示查询所有对外投资
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(keyword)}&percent=0&pageSize=20`;

    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    const data = await response.json();

    if (data.Status === '200' && data.Result) {
      await recordApiCall({
        apiType: 'qichacha_investment_through',
        apiName: apiConfig?.apiName || '对外投资穿透(十层)',
        status: 'success',
        cost: apiCost,
        companyName: data.Result.CompanyName,
        requestParams: JSON.stringify({ keyword, endpoint }),
        responseSummary: JSON.stringify({
          investmentCount: data.Result.BreakThroughList?.length || 0,
          findMatched: data.Result.FindMatched
        }),
      });
      return data.Result;
    }

    await recordApiCall({
      apiType: 'qichacha_investment_through',
      apiName: apiConfig?.apiName || '对外投资穿透(十层)',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });

    return null;
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_investment_through',
      apiName: apiConfig?.apiName || '对外投资穿透(十层)',
      status: 'failed',
      requestParams: JSON.stringify({ keyword, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[QCC] Investment Through API call failed:', error);
    return null;
  }
}

// 股权穿透数据结构
interface QccEquityThrough {
  KeyNo: string;
  Name: string;
  Count: string;
  Children: QccEquityThroughChild[] | null;
}

interface QccEquityThroughChild {
  KeyNo: string;
  Name: string;
  Category: string;  // 0-企业, 2-自然人
  FundedRatio: string;  // 出资比例
  InParentActualRadio: string;  // 查询企业的出资比例
  Count: string;
  Grade: string;  // 层级
  ShouldCapi: string;  // 认缴出资额
  StockRightNum: string;  // 持股数
  ShortStatus: string;  // 状态
  Children: QccEquityThroughChild[] | null;
}

// 对外投资穿透数据结构
interface QccInvestmentThrough {
  KeyNo: string;
  CompanyName: string;
  FindMatched: string;
  Remark: string | null;
  BreakThroughList: QccInvestmentThroughItem[];
}

interface QccInvestmentThroughItem {
  KeyNo: string;
  Name: string;
  CreditCode: string;
  CorpStatus: string;
  TotalStockPercent: string;
  DetailInfoList: QccInvestmentDetailInfo[];
}

interface QccInvestmentDetailInfo {
  Level: string;
  ShouldCapi: string;
  CapitalType: string;
  BreakThroughStockPercent: string;
  StockType: string;  // 直接/间接
  Path: string;  // 层级关系
  StockPercent: string;
}

// 融资信息核查API (ApiCode: 950)
interface QccFinancing {
  Date: string;           // 融资日期
  ProductName: string;    // 产品名称
  Round: string;          // 融资轮次
  Amount: string;         // 融资金额
  Valuation: string;      // 估值
  Investment: string;     // 投资方
  NewsUrl: string;        // 新闻链接
}

// 融资信息核查API (ApiCode: 950)
async function callQichachaFinancingApi(creditCode: string, pageIndex: number = 1, pageSize: number = 20): Promise<{ total: number; list: QccFinancing[] }> {
  const config = await getQichachaConfig();
  if (!config) return { total: 0, list: [] };

  const { appKey, secretKey } = config;

  // 从数据库获取API端点配置
  const apiConfig = await getQichachaApiConfigByCode('950');
  const endpoint = apiConfig?.endpoint || 'CompanyFinancingSearch/GetList';
  const apiCost = apiConfig?.cost || '0.50';
  const paramName = apiConfig?.primaryParam || 'searchKey';

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = generateQccSign(appKey, secretKey, timestamp);

    // 使用数据库配置的端点
    const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(creditCode)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;

    console.log('[QCC Financing] Calling API:', url.replace(appKey, '***'));

    const response = await fetch(url, {
      headers: { 'Token': sign, 'Timespan': timestamp },
    });

    const data = await response.json();

    console.log('[QCC Financing] API Response Status:', data.Status, 'VerifyResult:', data.Result?.VerifyResult);

    if (data.Status === '200' && data.Result) {
      await recordApiCall({
        apiType: 'qichacha_financing',
        apiName: apiConfig?.apiName || '融资信息核查',
        status: 'success',
        cost: apiCost,
        requestParams: JSON.stringify({ creditCode, pageIndex, pageSize, endpoint }),
        responseSummary: JSON.stringify({
          total: data.Paging?.TotalRecords || 0,
          verifyResult: data.Result.VerifyResult
        }),
      });
      return {
        total: data.Paging?.TotalRecords || 0,
        list: data.Result.Data || [],
      };
    }

    await recordApiCall({
      apiType: 'qichacha_financing',
      apiName: apiConfig?.apiName || '融资信息核查',
      status: 'failed',
      cost: apiCost,
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: data.Message || 'Unknown error',
    });
    return { total: 0, list: [] };
  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_financing',
      apiName: apiConfig?.apiName || '融资信息核查',
      status: 'failed',
      requestParams: JSON.stringify({ creditCode, endpoint }),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[QCC Financing] API call failed:', error);
    return { total: 0, list: [] };
  }
}
// 综合风险核查API (ApiCode: 2006)
// 风险扫描接口返回的风险信息类型
interface QccRiskInfo {
  ShiXin: any[] | null;           // 失信被执行人
  ZhiXing: any[] | null;          // 被执行人
  AdminPenalty: any[] | null;     // 行政处罚
  Exception: any[] | null;        // 经营异常
  ChattelMortgage: any[] | null;  // 动产抵押
  Liquidation: any[] | null;      // 清算信息
  EquityPledge: any[] | null;     // 股权质押
  SeriousIllegal: any[] | null;   // 严重违法
  EquityFreeze: any[] | null;     // 股权冻结
  JudicialSale: any[] | null;     // 司法拍卖
  Bankruptcy: any[] | null;       // 破产信息
  Sumptuary: any[] | null;        // 限制消费
  EnvPunishment: any[] | null;    // 环保处罚
  TaxOweNotice: any[] | null;     // 欠税公告
  TaxIllegal: any[] | null;       // 税务违法
  TaxAbnormal: any[] | null;      // 税务异常
  TaxHurry: any[] | null;         // 税务催报
  TaxReminder: any[] | null;      // 税务提醒
  PublicSecurityNotice: any[] | null; // 公安通知
}

// 风险扫描完整返回类型
interface QccRiskScanResult {
  VerifyResult: number;
  Data: {
    KeyNo: string;
    Name: string;
    CreditCode: string;
    OperName: string;
    Status: string;
    StartDate: string;
    RegistCapi: string;
    RealCapi: string;
    // ... 其他基础信息字段
    // 风险信息
    ShiXin: any[] | null;
    ZhiXing: any[] | null;
    AdminPenalty: any[] | null;
    Exception: any[] | null;
    ChattelMortgage: any[] | null;
    Liquidation: any[] | null;
    EquityPledge: any[] | null;
    SeriousIllegal: any[] | null;
    EquityFreeze: any[] | null;
    JudicialSale: any[] | null;
    Bankruptcy: any[] | null;
    Sumptuary: any[] | null;
    EnvPunishment: any[] | null;
    TaxOweNotice: any[] | null;
    TaxIllegal: any[] | null;
    TaxAbnormal: any[] | null;
    TaxHurry: any[] | null;
    TaxReminder: any[] | null;
    PublicSecurityNotice: any[] | null;
    // 额外信息
    TagList: Array<{ Type: string; Name: string }> | null;
    BeneficiaryList: any[] | null;
    ActualControllerList: any[] | null;
    GroupInfo: { GroupId: string; Name: string; Logo: string } | null;
    FinancialInformation: { AccountTitle: string; Amount: string; Year: string } | null;
    // 重要变更记录（法人、地址、注册资本、经营范围等）
    ChangeList?: Array<{ ChangeItem: string; ChangeBefore?: string; ChangeAfter?: string; ChangeDate?: string }>;
  };
}


/**
 * 调用企查查风险扫描API
 * 接口编码：2006
 * 
 * @param searchKey 企业名称或统一社会信用代码
 * @returns 风险扫描结果，包含工商信息和风险信息
 */







async function callQichachaRiskScanApi(searchKey: string): Promise<QccRiskScanResult | null> {
  const config = await getQichachaConfig();
  if (!config) {
    console.log('[QCC RiskScan] No QCC config available');
    return null;
  }

  const { appKey, secretKey } = config;

  // 从数据库获取API配置
  const apiConfig = await getQichachaApiConfigByCode('2006');
  if (!apiConfig || !apiConfig.isEnabled) {
    console.log('[QCC RiskScan] API 2006 is not configured or disabled');
    return null;
  }

  const endpoint = apiConfig?.endpoint || 'RiskControl/Scan';
  const apiCost = apiConfig?.cost || '6.00';
  const paramName = apiConfig?.primaryParam || 'searchKey';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = generateQccSign(appKey, secretKey, timestamp);


  const url = `${QCC_BASE_URL}/${endpoint}?key=${appKey}&${paramName}=${encodeURIComponent(searchKey)}`;

  try {
    console.log(`[QCC RiskScan] Calling API for: ${searchKey}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });

    const responseText = await response.text();
    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[QCC RiskScan] JSON parse error:', responseText.substring(0, 500));
      await recordApiCall({
        apiType: 'qichacha_risk_scan',
        apiName: apiConfig.apiName,
        status: 'failed',
        cost: '0.00',
        companyName: searchKey,
        requestParams: JSON.stringify({ searchKey }),
        responseSummary: 'JSON解析失败',
        errorMessage: responseText.substring(0, 500),
      });
      return null;
    }

    if (data.Status === '200' && data.Result) {
      await recordApiCall({
        apiType: 'qichacha_risk_scan',
        apiName: apiConfig.apiName,
        status: 'success',
        cost: apiConfig.cost || '1.00',
        companyName: searchKey,
        requestParams: JSON.stringify({ searchKey }),
        responseSummary: JSON.stringify({
          name: data.Result.Data?.Name,
          hasRisk: !!(data.Result.Data?.ShiXin || data.Result.Data?.ZhiXing ||
            data.Result.Data?.AdminPenalty || data.Result.Data?.Exception),
        }),
      });
      return data.Result;
    }

    await recordApiCall({
      apiType: 'qichacha_risk_scan',
      apiName: apiConfig.apiName,
      status: 'failed',
      cost: '0.00',
      companyName: searchKey,
      requestParams: JSON.stringify({ searchKey }),
      responseSummary: `Status: ${data.Status}, Message: ${data.Message}`,
    });
    return null;

  } catch (error) {
    await recordApiCall({
      apiType: 'qichacha_risk_scan',
      apiName: apiConfig.apiName,
      status: 'failed',
      cost: '0.00',
      companyName: searchKey,
      requestParams: JSON.stringify({ searchKey }),
      errorMessage: error instanceof Error ? error.message : '未知错误',
    });
    return null;
  }
}

// 获取企业完整信息（包括工商信息、股东、高管、知识产权、客户供应商、年报等）
export interface CompanyFullInfo {
  basicInfo: QccCompanyDetail | null;
  shareholders: QccShareholder[];
  executives: QccExecutive[];
  executiveDetails: QccExecutiveDetail[];  // 高管详细信息
  patents: { total: number; list: QccPatent[] };  // 专利信息
  trademarks: { total: number; list: QccTrademark[] };  // 商标信息
  copyrights: { total: number; list: QccCopyright[] };  // 软著信息
  customers: QccCustomer[];  // 客户信息
  suppliers: QccSupplier[];  // 供应商信息
  annualReports: QccAnnualReport[];  // 年报信息
  certificates: { total: number; list: QccCertificate[] };  // 资质证书
  equityThrough: QccEquityThrough | null;  // 股权穿透（上游股东）
  investmentThrough: QccInvestmentThrough | null;  // 对外投资穿透（下游子公司）
  financings: { total: number; list: QccFinancing[] };  // 融资信息
  riskScan: QccRiskScanResult | null;  // 新增：风险扫描结果
}

/**
 * 获取企业完整信息（包含缓存逻辑）
 * 
 * 缓存策略：
 * 1. 先检查数据库缓存是否存在且未过期
 * 2. 如果缓存有效，直接返回缓存数据，节省API费用
 * 3. 如果缓存不存在或已过期，调用企查查API获取数据
 * 4. 获取新数据后保存到缓存
 * 
 * @param companyNameOrCreditCode 企业名称或统一社会信用代码
 * @returns 企业完整信息
 */
export async function getCompanyFullInfo(companyNameOrCreditCode: string): Promise<CompanyFullInfo> {
  // 先搜索获取信用代码
  let creditCode = companyNameOrCreditCode;
  let companyName = companyNameOrCreditCode;

  // 如果不是信用代码格式，先搜索
  if (!/^[0-9A-Z]{18}$/.test(companyNameOrCreditCode)) {
    const searchResults = await callQichachaApi(companyNameOrCreditCode);
    if (searchResults.length > 0 && searchResults[0].creditCode) {
      creditCode = searchResults[0].creditCode;
      companyName = searchResults[0].name || companyNameOrCreditCode;
    } else {
      return {
        basicInfo: null,
        shareholders: [],
        executives: [],
        executiveDetails: [],
        patents: { total: 0, list: [] },
        trademarks: { total: 0, list: [] },
        copyrights: { total: 0, list: [] },
        customers: [],
        suppliers: [],
        annualReports: [],
        certificates: { total: 0, list: [] },
        equityThrough: null,
        investmentThrough: null,
        financings: { total: 0, list: [] },
        riskScan: null,
      };
    }
  }

  // ============ 缓存检查 ============
  // 获取缓存有效期配置（默认30天）
  const cacheDays = await getCacheDaysConfig();

  // 检查缓存是否存在
  const cachedData = await getQichachaFullDataCache(creditCode);

  if (cachedData && isCacheValid(cachedData, cacheDays)) {
    // 缓存命中，直接返回缓存数据
    console.log(`[QCC] Cache HIT for ${creditCode}, cached at ${cachedData.cachedAt}, valid for ${cacheDays} days`);

    // 更新缓存命中次数
    await updateCacheHitCount(creditCode);

    // 记录缓存命中（不计费）
    await recordApiCall({
      apiType: 'qichacha_cache_hit',
      apiName: '缓存命中',
      status: 'success',
      cost: '0.00',
      companyName: companyName,
      requestParams: JSON.stringify({ creditCode }),
      responseSummary: JSON.stringify({
        source: 'cache',
        cachedAt: cachedData.cachedAt,
        hitCount: (cachedData.hitCount || 0) + 1,
        savedCost: '4.35' // 节省的11个API调用费用
      }),
    });

    // 解析缓存的JSON数据
    return {
      basicInfo: cachedData.basicInfo ? JSON.parse(cachedData.basicInfo) : null,
      shareholders: cachedData.shareholders ? JSON.parse(cachedData.shareholders) : [],
      executives: cachedData.executives ? JSON.parse(cachedData.executives) : [],
      executiveDetails: cachedData.executiveDetails ? JSON.parse(cachedData.executiveDetails) : [],
      patents: cachedData.patents ? JSON.parse(cachedData.patents) : { total: 0, list: [] },
      trademarks: cachedData.trademarks ? JSON.parse(cachedData.trademarks) : { total: 0, list: [] },
      copyrights: cachedData.copyrights ? JSON.parse(cachedData.copyrights) : { total: 0, list: [] },
      customers: cachedData.customers ? JSON.parse(cachedData.customers) : [],
      suppliers: cachedData.suppliers ? JSON.parse(cachedData.suppliers) : [],
      annualReports: cachedData.annualReports ? JSON.parse(cachedData.annualReports) : [],
      certificates: cachedData.certificates ? JSON.parse(cachedData.certificates) : { total: 0, list: [] },
      equityThrough: (cachedData as any).equityThrough ? JSON.parse((cachedData as any).equityThrough) : null,
      investmentThrough: (cachedData as any).investmentThrough ? JSON.parse((cachedData as any).investmentThrough) : null,
      financings: (cachedData as any).financings ? JSON.parse((cachedData as any).financings) : { total: 0, list: [] },
      riskScan: (cachedData as any).riskScan ? JSON.parse((cachedData as any).riskScan) : null,
    };
  }

  // ============ 缓存未命中，调用API ============
  console.log(`[QCC] Cache MISS for ${creditCode}, fetching from API...`);
  console.log(`[QCC] Company Name: ${companyName}, Credit Code: ${creditCode}`);

  // 并行调用所有API获取完整信息
  const [
    basicInfo,
    shareholders,
    executives,
    executiveDetails,
    patents,
    trademarks,
    copyrights,
    customers,
    suppliers,
    annualReports,
    certificates,
    equityThrough,
    investmentThrough,
    financings,
    riskScan,
  ] = await Promise.all([
    callQichachaDetailApi(creditCode),
    callQichachaShareholderApi(creditCode),
    callQichachaExecutiveApi(creditCode),
    Promise.resolve([]),  // executiveDetails 需要先获取executives后再查询
    callQichachaPatentApi(creditCode),
    callQichachaTrademarkApi(creditCode),
    callQichachaCopyrightApi(creditCode),
    callQichachaCustomerApi(creditCode),
    callQichachaSupplierApi(creditCode),
    callQichachaAnnualReportApi(creditCode),
    callQichachaCertificateApi(creditCode),
    callQichachaEquityThroughApi(companyName),  // 股权穿透使用企业名称
    callQichachaInvestmentThroughApi(companyName),  // 对外投资穿透使用企业名称
    callQichachaFinancingApi(creditCode),  // 融资信息查询
    callQichachaRiskScanApi(creditCode),
  ]);

  // 获取高管详细信息（需要先有executives列表）
  let executiveDetailsResult: QccExecutiveDetail[] = [];
  if (executives && executives.length > 0) {
    console.log(`[QCC] Fetching executive details for ${executives.length} executives...`);
    executiveDetailsResult = await callQichachaExecutiveDetailApi(creditCode, executives);
  }

  console.log(`[QCC] Full info fetched:`);
  console.log(`  - basicInfo: ${basicInfo ? basicInfo.Name : 'null'}`);
  console.log(`  - shareholders: ${shareholders.length}`);
  console.log(`  - executives: ${executives.length}`);
  console.log(`  - executiveDetails: ${executiveDetailsResult.length}`);
  console.log(`  - patents: ${patents.total}`);
  console.log(`  - trademarks: ${trademarks.total}`);
  console.log(`  - copyrights: ${copyrights.total}`);
  console.log(`  - customers: ${customers.length}`);
  console.log(`  - suppliers: ${suppliers.length}`);
  console.log(`  - annualReports: ${annualReports.length}`);
  console.log(`  - certificates: ${certificates.total}`);
  console.log(`  - equityThrough: ${equityThrough?.Count || 0}`);
  console.log(`  - investmentThrough: ${investmentThrough?.BreakThroughList?.length || 0}`);
  console.log(`  - financings: ${financings.total}`);

  // ============ 保存到缓存 ============
  try {
    await saveQichachaFullDataCache({
      creditCode,
      companyName: basicInfo?.Name || companyName,
      basicInfo: basicInfo ? JSON.stringify(basicInfo) : null,
      shareholders: shareholders.length > 0 ? JSON.stringify(shareholders) : null,
      executives: executives.length > 0 ? JSON.stringify(executives) : null,
      executiveDetails: executiveDetailsResult.length > 0 ? JSON.stringify(executiveDetailsResult) : null,
      patents: patents.total > 0 ? JSON.stringify(patents) : null,
      trademarks: trademarks.total > 0 ? JSON.stringify(trademarks) : null,
      copyrights: copyrights.total > 0 ? JSON.stringify(copyrights) : null,
      customers: customers.length > 0 ? JSON.stringify(customers) : null,
      suppliers: suppliers.length > 0 ? JSON.stringify(suppliers) : null,
      annualReports: annualReports.length > 0 ? JSON.stringify(annualReports) : null,
      certificates: certificates.total > 0 ? JSON.stringify(certificates) : null,
      equityThrough: equityThrough ? JSON.stringify(equityThrough) : null,
      investmentThrough: investmentThrough ? JSON.stringify(investmentThrough) : null,
      financings: financings.total > 0 ? JSON.stringify(financings) : null,
      riskScan: riskScan ? JSON.stringify(riskScan) : null,
    } as any);
    console.log(`[QCC] Data cached for ${creditCode}`);
  } catch (cacheError) {
    // 缓存失败不影响主流程
    console.error(`[QCC] Failed to cache data for ${creditCode}:`, cacheError);
  }

  return {
    basicInfo,
    shareholders,
    executives,
    executiveDetails: executiveDetailsResult,
    patents,
    trademarks,
    copyrights,
    customers,
    suppliers,
    annualReports,
    certificates,
    equityThrough,
    investmentThrough,
    financings,
    riskScan,
  };
}
