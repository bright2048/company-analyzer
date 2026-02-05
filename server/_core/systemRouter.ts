import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getSystemConfig, setSystemConfig } from "../db";

// 日志配置键名常量
const LOG_CONFIG_KEYS = {
  DEBUG_LOG_ENABLED: 'debug_log_enabled',
  LOG_DB_OPERATIONS: 'log_db_operations',
  LOG_QICHACHA_API: 'log_qichacha_api',
  LOG_LLM_API: 'log_llm_api',
  LOG_REPORT_GENERATION: 'log_report_generation',
} as const;

// 获取日志配置
async function getLogConfig(key: string): Promise<boolean> {
  const value = await getSystemConfig(key, 'false');
  return value === 'true' || value === '1';
}

// 设置日志配置
async function setLogConfigValue(key: string, enabled: boolean): Promise<void> {
  const descriptions: Record<string, string> = {
    [LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED]: '调试日志总开关',
    [LOG_CONFIG_KEYS.LOG_DB_OPERATIONS]: '数据库操作日志',
    [LOG_CONFIG_KEYS.LOG_QICHACHA_API]: '企查查API调用日志',
    [LOG_CONFIG_KEYS.LOG_LLM_API]: '大模型API调用日志',
    [LOG_CONFIG_KEYS.LOG_REPORT_GENERATION]: '报告生成流程日志',
  };
  
  await setSystemConfig(key, enabled ? 'true' : 'false', descriptions[key] || '日志配置');
}

// 获取所有日志配置
async function getAllLogConfigs(): Promise<{
  debugLogEnabled: boolean;
  logDbOperations: boolean;
  logQichachaApi: boolean;
  logLlmApi: boolean;
  logReportGeneration: boolean;
}> {
  const [debugLogEnabled, logDbOperations, logQichachaApi, logLlmApi, logReportGeneration] = await Promise.all([
    getLogConfig(LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED),
    getLogConfig(LOG_CONFIG_KEYS.LOG_DB_OPERATIONS),
    getLogConfig(LOG_CONFIG_KEYS.LOG_QICHACHA_API),
    getLogConfig(LOG_CONFIG_KEYS.LOG_LLM_API),
    getLogConfig(LOG_CONFIG_KEYS.LOG_REPORT_GENERATION),
  ]);
  
  return {
    debugLogEnabled,
    logDbOperations,
    logQichachaApi,
    logLlmApi,
    logReportGeneration,
  };
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  getBatchQueryLimit: publicProcedure
    .query(async () => {
      const rawValue = await getSystemConfig("batch_query_max_count", "50");
      const limit = Number.parseInt(rawValue, 10);
      const normalized = Number.isFinite(limit) ? limit : 50;
      return {
        limit: normalized,
        disabled: normalized <= 0,
      };
    }),

  // 获取日志配置
  getLogConfigs: adminProcedure
    .query(async () => {
      const configs = await getAllLogConfigs();
      return configs;
    }),

  // 设置单个日志配置
  setLogConfig: adminProcedure
    .input(
      z.object({
        key: z.enum([
          'debug_log_enabled',
          'log_db_operations',
          'log_qichacha_api',
          'log_llm_api',
          'log_report_generation',
        ]),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await setLogConfigValue(input.key, input.enabled);
      return { success: true };
    }),

  // 批量设置日志配置
  setAllLogConfigs: adminProcedure
    .input(
      z.object({
        debugLogEnabled: z.boolean(),
        logDbOperations: z.boolean(),
        logQichachaApi: z.boolean(),
        logLlmApi: z.boolean(),
        logReportGeneration: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await Promise.all([
        setLogConfigValue(LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED, input.debugLogEnabled),
        setLogConfigValue(LOG_CONFIG_KEYS.LOG_DB_OPERATIONS, input.logDbOperations),
        setLogConfigValue(LOG_CONFIG_KEYS.LOG_QICHACHA_API, input.logQichachaApi),
        setLogConfigValue(LOG_CONFIG_KEYS.LOG_LLM_API, input.logLlmApi),
        setLogConfigValue(LOG_CONFIG_KEYS.LOG_REPORT_GENERATION, input.logReportGeneration),
      ]);
      return { success: true };
    }),
});
