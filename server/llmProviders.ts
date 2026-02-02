/**
 * 多大模型提供商适配器模块
 * 
 * 功能说明：
 * - 支持多种大模型提供商：智谱AI、百度文心一言、通义千问
 * - 提供统一的调用接口
 * - 自动处理不同提供商的API差异
 * - 使用axios替代fetch，提高网络请求稳定性
 * - 支持自动重试机制
 * 
 * 支持的提供商：
 * - zhipu: 智谱AI (GLM-4系列)
 * - wenxin: 百度文心一言 (ERNIE系列)
 * - qwen: 通义千问 (默认，使用内置API)
 */

import axios, { AxiosError } from 'axios';
import { ENV } from './_core/env';
import { invokeLLM as invokeBuiltInLLM, InvokeParams, InvokeResult, Message } from './_core/llm';

// ============================================================
// 类型定义
// ============================================================

/**
 * LLM提供商类型
 */
export type LLMProvider = 'qwen' | 'zhipu' | 'wenxin';

/**
 * LLM提供商配置
 */
export interface LLMProviderConfig {
  apiKey?: string;
  apiSecret?: string;  // 百度文心需要
  model?: string;
}

/**
 * LLM提供商信息
 */
export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  models: {
    id: string;
    name: string;
    description: string;
    contextLength: number;
    inputPrice: string;
    outputPrice: string;
  }[];
  requiresApiKey: boolean;
  requiresApiSecret: boolean;
}

// ============================================================
// 配置常量
// ============================================================

/**
 * HTTP请求超时时间（毫秒）
 */
const HTTP_TIMEOUT = 120000; // 2分钟，LLM生成可能较慢

/**
 * 最大重试次数
 */
const MAX_RETRIES = 3;

/**
 * 重试延迟（毫秒）
 */
const RETRY_DELAY = 2000;

// ============================================================
// 提供商信息
// ============================================================

/**
 * 所有支持的LLM提供商信息
 */
export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'zhipu',
    name: '智谱AI',
    description: '智谱AI GLM系列大模型，国产领先的大语言模型',
    models: [
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        description: '最新旗舰版，性能最强',
        contextLength: 128000,
        inputPrice: '￥10/百万tokens',
        outputPrice: '￥10/百万tokens',
      },
      {
        id: 'glm-4-plus',
        name: 'GLM-4-Plus',
        description: '旗舰版，质量最好',
        contextLength: 128000,
        inputPrice: '￥5/百万tokens',
        outputPrice: '￥5/百万tokens',
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4-Air',
        description: '高性能版，性价比高',
        contextLength: 128000,
        inputPrice: '¥0.5/百万tokens',
        outputPrice: '¥0.5/百万tokens',
      },
      {
        id: 'glm-4-airx',
        name: 'GLM-4-AirX',
        description: '极速版，响应最快',
        contextLength: 8000,
        inputPrice: '¥10/百万tokens',
        outputPrice: '¥10/百万tokens',
      },
      {
        id: 'glm-4-flashx',
        name: 'GLM-4-FlashX',
        description: '经济版，快速便宜',
        contextLength: 128000,
        inputPrice: '¥0.1/百万tokens',
        outputPrice: '¥0.1/百万tokens',
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4.5-Flash',
        description: '免费版，适合测试',
        contextLength: 128000,
        inputPrice: '免费',
        outputPrice: '免费',
      },
    ],
    requiresApiKey: true,
    requiresApiSecret: false,
  },
  {
    id: 'wenxin',
    name: '百度文心一言',
    description: '百度千帆大模型ERNIE系列，中文理解能力强',
    models: [
      {
        id: 'ernie-4.5-8k-preview',
        name: 'ERNIE-4.5',
        description: '最新旗舰模型',
        contextLength: 128000,
        inputPrice: '¥0.004/千tokens',
        outputPrice: '¥0.016/千tokens',
      },
      {
        id: 'ernie-4.0-8k-preview',
        name: 'ERNIE-4.0-8K',
        description: '稳定版本',
        contextLength: 8000,
        inputPrice: '¥0.04/千tokens',
        outputPrice: '¥0.12/千tokens',
      },
      {
        id: 'ernie-3.5-8k',
        name: 'ERNIE-3.5-8K',
        description: '经济实惠',
        contextLength: 8000,
        inputPrice: '¥0.0008/千tokens',
        outputPrice: '¥0.002/千tokens',
      },
      {
        id: 'deepseek-v3',
        name: 'DeepSeek-V3',
        description: 'DeepSeek模型（千帆接入）',
        contextLength: 64000,
        inputPrice: '¥0.001/千tokens',
        outputPrice: '¥0.002/千tokens',
      },
    ],
    requiresApiKey: true,
    requiresApiSecret: false,
  },
  {
    id: 'qwen',
    name: '通义千问',
    description: '阿里云通义千问，系统默认模型',
    models: [
      {
        id: 'qwen-plus',
        name: 'Qwen-Plus',
        description: '默认模型，已集成',
        contextLength: 128000,
        inputPrice: '系统内置',
        outputPrice: '系统内置',
      },
    ],
    requiresApiKey: false,
    requiresApiSecret: false,
  },
];

// ============================================================
// 工具函数
// ============================================================

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
  // 网络错误可重试
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'EAI_AGAIN') {
    return true;
  }
  
  // axios网络错误可重试
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    // 网络错误（无响应）
    if (!axiosError.response) {
      return true;
    }
    // 5xx服务器错误可重试
    if (axiosError.response.status >= 500) {
      return true;
    }
    // 429 Too Many Requests 可重试
    if (axiosError.response.status === 429) {
      return true;
    }
  }
  
  // TypeError: fetch failed 可重试
  if (error instanceof TypeError && error.message.includes('fetch failed')) {
    return true;
  }
  
  return false;
}

/**
 * 格式化错误信息
 */
function formatErrorDetail(error: any, model: string, provider: string): string {
  let httpStatus = '未知';
  let errorCode = '无';
  let errorMsg = error.message || 'Unknown error';
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    httpStatus = axiosError.response?.status?.toString() || '无响应';
    
    if (axiosError.response?.data) {
      const data = axiosError.response.data as any;
      errorCode = data.error?.code || data.error_code || data.code || '无';
      errorMsg = data.error?.message || data.error_msg || data.message || errorMsg;
    }
    
    // 特殊处理网络错误
    if (!axiosError.response) {
      errorMsg = `网络错误: ${axiosError.code || axiosError.message}`;
    }
  }
  
  return `HTTP状态码: ${httpStatus} | 错误码: ${errorCode} | 错误信息: ${errorMsg} | 模型: ${model} | 提供商: ${provider}`;
}

// ============================================================
// 智谱AI适配器
// ============================================================

/**
 * 调用智谱AI GLM模型（使用axios）
 * 
 * @param messages 消息列表
 * @param apiKey API密钥
 * @param model 模型ID
 */
async function invokeZhipuLLM(
  messages: Message[],
  apiKey: string,
  model: string = 'glm-4-plus'
): Promise<InvokeResult> {
  const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  
  // 转换消息格式
  const formattedMessages = messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'string' 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.map(c => typeof c === 'string' ? c : (c as any).text || '').join('')
        : '',
  }));
  
  const payload = {
    model: model,
    messages: formattedMessages,
    max_tokens: 8192,
    temperature: 0.7,
  };
  
  console.log('[ZhipuAI] Calling API with model:', model);
  console.log('[ZhipuAI] URL:', url);
  console.log('[ZhipuAI] Timeout:', HTTP_TIMEOUT, 'ms');
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ZhipuAI] Attempt ${attempt}/${MAX_RETRIES}...`);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: HTTP_TIMEOUT,
        // 禁用代理（如果有环境变量设置）
        proxy: false,
      });
      
      const result = response.data;
      
      // 检查API返回的错误
      if (result.error) {
        const errorDetail = `API错误码: ${result.error.code || '无'} | 错误信息: ${result.error.message || JSON.stringify(result.error)} | 模型: ${model}`;
        console.error('[ZhipuAI] API Error in response:', errorDetail);
        throw new Error(`智谱AI错误: ${errorDetail}`);
      }
      
      console.log('[ZhipuAI] Response received successfully');
      console.log('[ZhipuAI] Tokens used:', result.usage?.total_tokens);
      
      return result as InvokeResult;
      
    } catch (error: any) {
      lastError = error;
      const errorDetail = formatErrorDetail(error, model, 'zhipu');
      console.error(`[ZhipuAI] Attempt ${attempt} failed:`, errorDetail);
      
      // 如果是已格式化的业务错误，不重试
      if (error.message?.includes('智谱AI错误:')) {
        throw error;
      }
      
      // 判断是否可重试
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        console.log(`[ZhipuAI] Will retry in ${RETRY_DELAY}ms...`);
        await delay(RETRY_DELAY * attempt); // 递增延迟
        continue;
      }
      
      // 不可重试或已达最大重试次数
      throw new Error(`智谱AI调用失败: ${errorDetail}`);
    }
  }
  
  // 理论上不会到这里，但为了类型安全
  throw lastError || new Error('智谱AI调用失败: 未知错误');
}

// ============================================================
// 百度千帆大模型适配器（新版v2接口）
// ============================================================

/**
 * 调用百度千帆大模型（使用axios）
 * 
 * API文档: https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Fm2vrveyu
 * 
 * @param messages 消息列表
 * @param apiKey Bearer Token (bce-v3/ALTAK-xxx/xxx 格式)
 * @param model 模型ID
 */
async function invokeWenxinLLM(
  messages: Message[],
  apiKey: string,
  model: string = 'ernie-4.5-8k-preview'
): Promise<InvokeResult> {
  // 新版v2接口端点
  const url = 'https://qianfan.baidubce.com/v2/chat/completions';
  
  // 转换消息格式（v2接口支持system角色）
  const formattedMessages = messages.map(msg => {
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.map(c => typeof c === 'string' ? c : (c as any).text || '').join('')
        : '';
    return {
      role: msg.role,
      content: content,
    };
  });
  
  const payload = {
    model: model,
    messages: formattedMessages,
  };
  
  console.log('[Wenxin] Calling v2 API with model:', model);
  console.log('[Wenxin] URL:', url);
  console.log('[Wenxin] Timeout:', HTTP_TIMEOUT, 'ms');
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Wenxin] Attempt ${attempt}/${MAX_RETRIES}...`);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: HTTP_TIMEOUT,
        // 禁用代理（如果有环境变量设置）
        proxy: false,
      });
      
      const result = response.data;
      
      // 检查API返回的错误
      if (result.error || result.error_code) {
        const errorCode = result.error?.code || result.error_code || '';
        const errorMsg = result.error?.message || result.error_msg || JSON.stringify(result.error || result);
        const errorDetail = `API错误码: ${errorCode || '无'} | 错误信息: ${errorMsg} | 模型: ${model}`;
        console.error('[Wenxin] API Error in response:', errorDetail);
        throw new Error(`文心一言错误: ${errorDetail}`);
      }
      
      console.log('[Wenxin] Response received successfully');
      console.log('[Wenxin] Tokens used:', result.usage?.total_tokens);
      
      // v2接口返回格式与OpenAI兼容，直接返回
      return result as InvokeResult;
      
    } catch (error: any) {
      lastError = error;
      const errorDetail = formatErrorDetail(error, model, 'wenxin');
      console.error(`[Wenxin] Attempt ${attempt} failed:`, errorDetail);
      
      // 如果是已格式化的业务错误，不重试
      if (error.message?.includes('文心一言错误:')) {
        throw error;
      }
      
      // 判断是否可重试
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        console.log(`[Wenxin] Will retry in ${RETRY_DELAY}ms...`);
        await delay(RETRY_DELAY * attempt); // 递增延迟
        continue;
      }
      
      // 不可重试或已达最大重试次数
      throw new Error(`文心一言调用失败: ${errorDetail}`);
    }
  }
  
  // 理论上不会到这里，但为了类型安全
  throw lastError || new Error('文心一言调用失败: 未知错误');
}

// ============================================================
// 统一调用接口
// ============================================================

/**
 * 统一的LLM调用接口
 * 
 * @param params 调用参数
 * @param provider LLM提供商
 * @param config 提供商配置
 */
export async function invokeLLMWithProvider(
  params: InvokeParams,
  provider: LLMProvider = 'zhipu',
  config?: LLMProviderConfig
): Promise<InvokeResult> {
  console.log('[LLM] ========== 开始调用LLM ==========');
  console.log('[LLM] 提供商:', provider);
  console.log('[LLM] 模型:', config?.model || '默认');
  console.log('[LLM] API Key状态:', config?.apiKey ? `已配置(前10位: ${config.apiKey.substring(0, 10)}...)` : '未配置');
  console.log('[LLM] 消息数量:', params.messages.length);
  console.log('[LLM] HTTP库: axios (替代fetch)');
  console.log('[LLM] 超时设置:', HTTP_TIMEOUT, 'ms');
  console.log('[LLM] 最大重试:', MAX_RETRIES, '次');
  
  switch (provider) {
    case 'zhipu': {
      if (!config?.apiKey) {
        console.error('[LLM] 错误: 智谱AI缺少API Key!');
        throw new Error('智谱AI需要配置API Key');
      }
      console.log('[LLM] 调用智谱AI, URL: https://open.bigmodel.cn/api/paas/v4/chat/completions');
      return invokeZhipuLLM(
        params.messages,
        config.apiKey,
        config.model || 'glm-4-plus'
      );
    }
    
    case 'wenxin': {
      if (!config?.apiKey) {
        console.error('[LLM] 错误: 文心一言缺少API Key!');
        throw new Error('文心一言需要配置API Key (Bearer Token)');
      }
      console.log('[LLM] 调用文心一言, URL: https://qianfan.baidubce.com/v2/chat/completions');
      return invokeWenxinLLM(
        params.messages,
        config.apiKey,
        config.model || 'ernie-4.5-8k-preview'
      );
    }
    
    case 'qwen':
    default: {
      // 使用内置的通义千问
      console.log('[LLM] 调用内置通义千问');
      return invokeBuiltInLLM(params);
    }
  }
}

/**
 * 获取所有LLM提供商信息
 */
export function getLLMProviders(): LLMProviderInfo[] {
  return LLM_PROVIDERS;
}

/**
 * 获取指定提供商信息
 */
export function getLLMProviderById(id: LLMProvider): LLMProviderInfo | undefined {
  return LLM_PROVIDERS.find(p => p.id === id);
}
