/**
 * 日志工具模块
 * 根据系统配置决定是否输出日志
 */

import { getSystemConfig } from "./db";

// 日志配置键名
const LOG_CONFIG_KEYS = {
  DEBUG_LOG_ENABLED: 'debug_log_enabled',
  LOG_DB_OPERATIONS: 'log_db_operations',
  LOG_QICHACHA_API: 'log_qichacha_api',
  LOG_LLM_API: 'log_llm_api',
  LOG_REPORT_GENERATION: 'log_report_generation',
} as const;

// 日志配置缓存
let logConfigCache: {
  debugLogEnabled: boolean;
  logDbOperations: boolean;
  logQichachaApi: boolean;
  logLlmApi: boolean;
  logReportGeneration: boolean;
} | null = null;

let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 缓存60秒

// 获取日志配置（带缓存）
async function getLogConfigs() {
  const now = Date.now();
  if (logConfigCache && (now - cacheTimestamp) < CACHE_TTL) {
    return logConfigCache;
  }

  const [debugLogEnabled, logDbOperations, logQichachaApi, logLlmApi, logReportGeneration] = await Promise.all([
    getSystemConfig(LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED, 'false'),
    getSystemConfig(LOG_CONFIG_KEYS.LOG_DB_OPERATIONS, 'false'),
    getSystemConfig(LOG_CONFIG_KEYS.LOG_QICHACHA_API, 'false'),
    getSystemConfig(LOG_CONFIG_KEYS.LOG_LLM_API, 'false'),
    getSystemConfig(LOG_CONFIG_KEYS.LOG_REPORT_GENERATION, 'false'),
  ]);

  logConfigCache = {
    debugLogEnabled: debugLogEnabled === 'true',
    logDbOperations: logDbOperations === 'true',
    logQichachaApi: logQichachaApi === 'true',
    logLlmApi: logLlmApi === 'true',
    logReportGeneration: logReportGeneration === 'true',
  };
  cacheTimestamp = now;

  return logConfigCache;
}

// 刷新日志配置缓存
export function refreshLogConfigCache() {
  logConfigCache = null;
  cacheTimestamp = 0;
}

// 格式化时间戳
function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// 数据库操作日志
export async function logDb(message: string, data?: any) {
  const configs = await getLogConfigs();
  if (configs.debugLogEnabled && configs.logDbOperations) {
    const timestamp = getTimestamp();
    if (data !== undefined) {
      console.log(`[${timestamp}] [DB] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${timestamp}] [DB] ${message}`);
    }
  }
}

// 企查查API调用日志
export async function logQcc(message: string, data?: any) {
  const configs = await getLogConfigs();
  if (configs.debugLogEnabled && configs.logQichachaApi) {
    const timestamp = getTimestamp();
    if (data !== undefined) {
      console.log(`[${timestamp}] [QCC] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${timestamp}] [QCC] ${message}`);
    }
  }
}

// 大模型API调用日志
export async function logLlm(message: string, data?: any) {
  const configs = await getLogConfigs();
  if (configs.debugLogEnabled && configs.logLlmApi) {
    const timestamp = getTimestamp();
    if (data !== undefined) {
      console.log(`[${timestamp}] [LLM] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${timestamp}] [LLM] ${message}`);
    }
  }
}

// 报告生成流程日志
export async function logReport(message: string, data?: any) {
  const configs = await getLogConfigs();
  if (configs.debugLogEnabled && configs.logReportGeneration) {
    const timestamp = getTimestamp();
    if (data !== undefined) {
      console.log(`[${timestamp}] [Report] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${timestamp}] [Report] ${message}`);
    }
  }
}

// 通用调试日志（只需要总开关开启）
export async function logDebug(prefix: string, message: string, data?: any) {
  const configs = await getLogConfigs();
  if (configs.debugLogEnabled) {
    const timestamp = getTimestamp();
    if (data !== undefined) {
      console.log(`[${timestamp}] [${prefix}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${timestamp}] [${prefix}] ${message}`);
    }
  }
}
