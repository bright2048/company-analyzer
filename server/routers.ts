import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as XLSX from "xlsx";
import { TRPCError } from "@trpc/server";
import {
  createParkCompany,
  createParkCompanies,
  getParkCompanies,
  getParkCompanyById,
  searchParkCompanies,
  updateParkCompany,
  deleteParkCompany,
  getParkCompaniesCount,
  getAllParkCompanyNames,
  createCompanyReport,
  getCompanyReports,
  getCompanyReportById,
  updateCompanyReport,
  deleteCompanyReport,
  getDataSourceConfigs,
  getActiveDataSource,
  upsertDataSourceConfig,
  setActiveDataSource,
  createBatchTask,
  getBatchTasks,
  getBatchTaskById,
  updateBatchTask,
  getBatchTaskReports,
  deleteBatchTask,
  getCachedSearchResults,
  saveSearchResultsToCache,
  searchCompanyCache,
  getCacheDays,
  getCacheStats,
  recordApiCall,
  getApiCallStats,
  getRecentApiCalls,
  getTodayApiStats,
  getMonthlyApiStats,
  // 企查查完整数据缓存相关
  getQichachaFullDataCache,
  saveQichachaFullDataCache,
  updateCacheHitCount,
  isCacheValid,
  getQichachaCacheStats,
  cleanExpiredCache,
  getAllQichachaCacheRecords,
  getQichachaCacheByCompanyName,
  deleteQichachaCache,
  checkCachedCompanies,
  // 系统配置相关
  getSystemConfig,
  setSystemConfig,
  getAllSystemConfigs,
  getCacheDaysConfig,
  setCacheDaysConfig,
  // 缓存预热任务相关
  createCacheWarmupTask,
  getCacheWarmupTasks,
  getCacheWarmupTaskById,
  updateCacheWarmupTask,
  deleteCacheWarmupTask,
  // 企查查API配置相关
  initQichachaApiConfig,
  getAllQichachaApiConfigs,
  getQichachaApiConfigByCode,
  updateQichachaApiConfig,
  batchUpdateQichachaApiConfigs,
  resetQichachaApiConfig,
  getQichachaApiEndpoint,
  getQichachaApiInfo,
  // 系统级LLM配置相关
  saveLlmConfig,
  getLlmConfig,
  getAllLlmConfigs,
  getDefaultLlmConfig,
  getEnabledLlmProviders,
  deleteLlmConfig,
  setDefaultLlmProvider,
  // 用户认证相关
  getUserByPhone,
  verifyUserLogin,
  createUser,
  batchCreateUsers,
  getAllUsers,
  getUsersCount,
  updateUser,
  deleteUser,
  incrementUserReportUsed,
  checkUserQuota,
  resetUserPassword,
  getUserById,
  changeUserPassword,
  rechargeUserQuota,
  recordLoginLog,
  getLoginLogs,
  getUserLoginLogs,
} from "./db";
import crypto from "crypto";
import { invokeLLM } from "./_core/llm";
import { invokeLLMWithProvider, getLLMProviders, getLLMProviderById, LLMProvider, LLMProviderConfig } from "./llmProviders";
import type { Message } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { generateWordDocument } from "./reportExport";
import { logDb, logQcc, logLlm, logReport, logDebug } from "./logger";
import { getCompanyFullInfo, callQichachaApi, type CompanyFullInfo } from "./services/qichacha";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // 手机号登录
    loginByPhone: publicProcedure
      .input(z.object({
        phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
        password: z.string().min(6, '密码至少6位'),
      }))
      .mutation(async ({ input, ctx }) => {
        // 获取客户端IP地址
        const ipAddress = ctx.req.headers['x-forwarded-for'] as string ||
          ctx.req.headers['x-real-ip'] as string ||
          ctx.req.socket?.remoteAddress ||
          'unknown';
        const userAgent = ctx.req.headers['user-agent'] || 'unknown';

        const user = await verifyUserLogin(input.phone, input.password);
        if (!user) {
          // 记录登录失败日志
          await recordLoginLog({
            userId: 0,
            phone: input.phone,
            ipAddress,
            userAgent,
            status: 'failed',
            failReason: '手机号或密码错误',
          });
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '手机号或密码错误' });
        }

        // 记录登录成功日志
        await recordLoginLog({
          userId: user.id,
          phone: user.phone || input.phone,
          userName: user.name || undefined,
          ipAddress,
          userAgent,
          status: 'success',
        });

        // 创建会话并设置cookie
        const { sdk } = await import('./_core/sdk');
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || '' });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            reportQuota: user.reportQuota,
            reportUsed: user.reportUsed,
            preferredLlm: user.preferredLlm,
          },
        };
      }),

    // 获取当前用户额度信息
    getQuota: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录' });
      }
      const quota = await checkUserQuota(ctx.user.id);
      return {
        total: ctx.user.reportQuota,
        used: ctx.user.reportUsed,
        remaining: quota.remaining,
        preferredLlm: ctx.user.preferredLlm,
      };
    }),

    // 更新用户偏好的LLM
    updatePreferredLlm: protectedProcedure
      .input(z.object({
        preferredLlm: z.enum(['qwen', 'zhipu', 'wenxin']),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录' });
        }
        const success = await updateUser(ctx.user.id, { preferredLlm: input.preferredLlm });
        return { success, message: success ? '已更新默认大模型' : '更新失败' };
      }),

    // 修改密码
    changePassword: protectedProcedure
      .input(z.object({
        oldPassword: z.string().min(6, '旧密码至少6位'),
        newPassword: z.string().min(6, '新密码至少6位'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录' });
        }
        const result = await changeUserPassword(ctx.user.id, input.oldPassword, input.newPassword);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
        }
        return result;
      }),

    // 获取当前用户的登录历史
    getLoginHistory: protectedProcedure
      .input(z.object({
        limit: z.number().default(10),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '未登录' });
        }
        const logs = await getUserLoginLogs(ctx.user.id, input?.limit ?? 10);
        return logs;
      }),
  }),

  // ============ 用户管理（管理员用） ============
  userManagement: router({
    // 获取用户列表
    list: adminProcedure
      .input(z.object({
        limit: z.number().default(100),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 100;
        const offset = input?.offset ?? 0;
        const users = await getAllUsers(limit, offset);
        const total = await getUsersCount();
        return { users, total };
      }),

    // 批量导入用户（通过手机号）
    batchImport: adminProcedure
      .input(z.object({
        phones: z.array(z.string()).min(1).max(500),
        reportQuota: z.number().default(50),
      }))
      .mutation(async ({ input }) => {
        const results = await batchCreateUsers(input.phones, input.reportQuota);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        return {
          success: true,
          message: `成功导入 ${successCount} 个用户，失败 ${failCount} 个`,
          results,
        };
      }),

    // 更新用户信息
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        role: z.enum(['user', 'admin']).optional(),
        reportQuota: z.number().optional(),
        preferredLlm: z.enum(['qwen', 'zhipu', 'wenxin']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const success = await updateUser(id, data);
        return { success, message: success ? '更新成功' : '更新失败' };
      }),

    // 重置用户密码
    resetPassword: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const newPassword = await resetUserPassword(input.id);
        if (!newPassword) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '重置密码失败' });
        }
        return { success: true, newPassword };
      }),

    // 删除用户
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await deleteUser(input.id);
        return { success, message: success ? '删除成功' : '删除失败' };
      }),

    // 获取单个用户信息
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await getUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }
        return user;
      }),

    // 为用户充值额度
    rechargeQuota: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().min(1, '充值数量必须大于0'),
      }))
      .mutation(async ({ input }) => {
        const result = await rechargeUserQuota(input.userId, input.amount);
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.message });
        }
        return result;
      }),

    // 获取登录日志列表
    getLoginLogs: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        phone: z.string().optional(),
        status: z.enum(['success', 'failed']).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        const result = await getLoginLogs({
          userId: input?.userId,
          phone: input?.phone,
          status: input?.status,
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
        });
        return result;
      }),
  }),

  // ============ LLM提供商管理（系统级配置） ============
  llmProvider: router({
    // 获取所有支持的LLM提供商列表（静态配置）
    list: publicProcedure.query(async () => {
      return getLLMProviders();
    }),

    // 获取单个提供商信息
    getById: publicProcedure
      .input(z.object({ id: z.enum(['qwen', 'zhipu', 'wenxin']) }))
      .query(async ({ input }) => {
        return getLLMProviderById(input.id);
      }),

    // 获取启用的LLM提供商列表（从数据库读取，用于前端选择）
    getEnabled: publicProcedure.query(async () => {
      return getEnabledLlmProviders();
    }),

    // 获取默认LLM配置
    getDefault: publicProcedure.query(async () => {
      return getDefaultLlmConfig();
    }),

    // 获取所有LLM配置（管理员用，脱敏显示）
    getConfigs: publicProcedure.query(async () => {
      return getAllLlmConfigs();
    }),

    // 保存系统级LLM配置（管理员用）
    saveConfig: publicProcedure
      .input(z.object({
        provider: z.enum(['qwen', 'zhipu', 'wenxin']),
        providerName: z.string(),
        defaultModel: z.string(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        isEnabled: z.boolean().optional().default(true),
        isDefault: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input }) => {
        const success = await saveLlmConfig(
          input.provider,
          input.providerName,
          input.defaultModel,
          input.apiKey,
          input.apiSecret,
          input.isEnabled,
          input.isDefault
        );
        return { success, message: success ? '配置已保存' : '保存失败' };
      }),

    // 删除LLM配置（管理员用）
    deleteConfig: publicProcedure
      .input(z.object({ provider: z.enum(['qwen', 'zhipu', 'wenxin']) }))
      .mutation(async ({ input }) => {
        const success = await deleteLlmConfig(input.provider);
        return { success, message: success ? '配置已删除' : '删除失败' };
      }),

    // 设置默认LLM提供商（管理员用）
    setDefault: publicProcedure
      .input(z.object({ provider: z.enum(['qwen', 'zhipu', 'wenxin']) }))
      .mutation(async ({ input }) => {
        const success = await setDefaultLlmProvider(input.provider);
        return { success, message: success ? '已设为默认' : '设置失败' };
      }),

    // 测试LLM连接（验证API Key有效性）
    testConnection: publicProcedure
      .input(z.object({ provider: z.enum(['qwen', 'zhipu', 'wenxin']) }))
      .mutation(async ({ input }) => {
        console.log('[LLM Test] ========== 测试连接开始 ==========');
        console.log('[LLM Test] 提供商:', input.provider);

        try {
          // 从数据库获取配置
          console.log('[LLM Test] 正在从数据库获取配置...');
          const config = await getLlmConfig(input.provider);
          console.log('[LLM Test] 数据库返回配置:', config ? {
            provider: config.provider,
            providerName: config.providerName,
            defaultModel: config.defaultModel,
            hasApiKey: !!config.apiKey,
            apiKeyLength: config.apiKey?.length || 0,
            isEnabled: config.isEnabled,
            isDefault: config.isDefault
          } : null);

          if (!config) {
            console.log('[LLM Test] 错误: 未找到配置');
            return { success: false, message: '未找到该提供商的配置' };
          }

          if (!config.apiKey) {
            console.log('[LLM Test] 错误: API Key为空');
            return { success: false, message: 'API Key未配置' };
          }

          console.log('[LLM Test] API Key已配置，长度:', config.apiKey.length);

          // 构建测试消息
          const testMessages: Message[] = [
            { role: 'user', content: '你好，请回复"测试成功"四个字' }
          ];

          const llmConfig: LLMProviderConfig = {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            model: config.defaultModel,
          };

          // 调用LLM
          const startTime = Date.now();
          const result = await invokeLLMWithProvider(
            { messages: testMessages },
            input.provider,
            llmConfig
          );
          const duration = Date.now() - startTime;

          // 检查返回结果
          const content = result.choices?.[0]?.message?.content;
          if (content) {
            const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
            return {
              success: true,
              message: `连接成功！响应时间: ${duration}ms`,
              response: contentStr.substring(0, 100),
              duration
            };
          } else {
            return { success: false, message: 'API返回结果异常' };
          }
        } catch (error) {
          console.error('[LLM Test] Error:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          return { success: false, message: `连接失败: ${errorMessage}` };
        }
      }),
  }),

  // ============ 企查查API配置管理 ============
  qichachaApiConfig: router({
    // 获取所有API配置
    list: publicProcedure.query(async () => {
      return getAllQichachaApiConfigs();
    }),

    // 获取单个API配置
    getByCode: publicProcedure
      .input(z.object({ apiCode: z.string() }))
      .query(async ({ input }) => {
        return getQichachaApiConfigByCode(input.apiCode);
      }),

    // 更新API配置
    update: publicProcedure
      .input(z.object({
        apiCode: z.string(),
        apiName: z.string().optional(),
        endpoint: z.string().optional(),
        primaryParam: z.string().optional(),
        cost: z.string().optional(),
        description: z.string().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { apiCode, ...data } = input;
        await updateQichachaApiConfig(apiCode, data);
        return { success: true, message: 'API配置已更新' };
      }),

    // 初始化默认配置
    initDefaults: publicProcedure.mutation(async () => {
      await initQichachaApiConfig();
      return { success: true, message: '默认配置已初始化' };
    }),
  }),

  // ============ API调用统计 ============
  apiStats: router({
    // 获取今日统计
    today: publicProcedure.query(async () => {
      return getTodayApiStats();
    }),

    // 获取月度统计
    monthly: publicProcedure
      .input(z.object({ year: z.number(), month: z.number() }).optional())
      .query(async ({ input }) => {
        const now = new Date();
        const year = input?.year || now.getFullYear();
        const month = input?.month || now.getMonth() + 1;
        return getMonthlyApiStats(year, month);
      }),

    // 获取最近调用记录
    recent: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return getRecentApiCalls(input?.limit || 50);
      }),

    // 获取统计汇总
    summary: publicProcedure.query(async () => {
      return getApiCallStats();
    }),
  }),

  // ============ 园区企业管理 ============
  parkCompany: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }).optional())
      .query(async ({ input }) => {
        const { limit = 100, offset = 0 } = input || {};
        const companies = await getParkCompanies(limit, offset);
        const total = await getParkCompaniesCount();
        return { companies, total };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getParkCompanyById(input.id);
      }),

    search: publicProcedure
      .input(z.object({ keyword: z.string() }))
      .query(async ({ input }) => {
        return searchParkCompanies(input.keyword);
      }),

    create: publicProcedure
      .input(z.object({
        companyName: z.string(),
        industry: z.string().optional(),
        businessScope: z.string().optional(),
        registeredCapital: z.string().optional(),
        establishedDate: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        officeArea: z.string().optional(),
        employeeCount: z.number().optional(),
        tags: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createParkCompany(input);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        companyName: z.string().optional(),
        industry: z.string().optional(),
        businessScope: z.string().optional(),
        registeredCapital: z.string().optional(),
        establishedDate: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        officeArea: z.string().optional(),
        employeeCount: z.number().optional(),
        tags: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateParkCompany(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteParkCompany(input.id);
        return { success: true };
      }),

    // XLS文件导入（支持普通格式和企查查导出格式）
    importFromXls: publicProcedure
      .input(z.object({ fileContent: z.string() })) // base64 encoded file
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileContent, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

          // 调试日志：打印解析结果
          console.log('[Excel Import] Sheet name:', sheetName);
          console.log('[Excel Import] Total rows:', data.length);
          if (data.length > 0) {
            console.log('[Excel Import] First row keys:', Object.keys(data[0]));
            console.log('[Excel Import] First row data:', JSON.stringify(data[0], null, 2));
          }

          // 检测是否为企查查导出格式（通过特征字段判断）
          const isQichachaFormat = data.length > 0 && (
            '原文件导入名称' in data[0] ||
            '统一社会信用代码' in data[0] ||
            '登记状态' in data[0]
          );
          console.log('[Excel Import] Is Qichacha format:', isQichachaFormat);

          let companies;

          if (isQichachaFormat) {
            // 企查查导出格式解析
            // 字段：原文件导入名称,登记状态,统一社会信用代码,法定代表人,企业规模,注册资本,电话,更多电话,成立日期,实缴资本,所属省份,所属城市,所属区县,企业地址
            companies = data.map((row) => {
              // 合并电话字段
              const phone = row['电话'] ? String(row['电话']) : '';
              const morePhone = row['更多电话'] ? String(row['更多电话']) : '';
              const allPhones = [phone, morePhone].filter(p => p && p !== '-').join(';');

              return {
                companyName: String(row['原文件导入名称'] || ''),
                creditCode: row['统一社会信用代码'] ? String(row['统一社会信用代码']) : undefined,
                legalPerson: row['法定代表人'] ? String(row['法定代表人']) : undefined,
                companyStatus: row['登记状态'] ? String(row['登记状态']) : undefined,
                companyScale: row['企业规模'] ? String(row['企业规模']) : undefined,
                registeredCapital: row['注册资本'] ? String(row['注册资本']) : undefined,
                paidCapital: row['实缴资本'] ? String(row['实缴资本']) : undefined,
                contactPhone: allPhones || undefined,
                establishedDate: row['成立日期'] ? String(row['成立日期']) : undefined,
                province: row['所属省份'] ? String(row['所属省份']) : undefined,
                city: row['所属城市'] ? String(row['所属城市']) : undefined,
                district: row['所属区县'] ? String(row['所属区县']) : undefined,
                address: row['企业地址'] ? String(row['企业地址']) : undefined,
                dataSource: 'qichacha_import',
              };
            }).filter(c => c.companyName);
            console.log('[Excel Import] Qichacha format - valid companies count:', companies.length);
            if (companies.length > 0) {
              console.log('[Excel Import] First company:', JSON.stringify(companies[0], null, 2));
            }
          } else {
            // 普通格式解析
            companies = data.map((row) => ({
              companyName: String(row["公司名称"] || row["企业名称"] || row["companyName"] || ""),
              industry: row["行业"] || row["industry"] ? String(row["行业"] || row["industry"]) : undefined,
              businessScope: row["经营范围"] || row["businessScope"] ? String(row["经营范围"] || row["businessScope"]) : undefined,
              registeredCapital: row["注册资本"] || row["registeredCapital"] ? String(row["注册资本"] || row["registeredCapital"]) : undefined,
              establishedDate: row["成立日期"] || row["establishedDate"] ? String(row["成立日期"] || row["establishedDate"]) : undefined,
              contactPerson: row["联系人"] || row["contactPerson"] ? String(row["联系人"] || row["contactPerson"]) : undefined,
              contactPhone: row["联系电话"] || row["contactPhone"] ? String(row["联系电话"] || row["contactPhone"]) : undefined,
              contactEmail: row["邮箱"] || row["contactEmail"] ? String(row["邮箱"] || row["contactEmail"]) : undefined,
              officeArea: row["办公面积"] || row["officeArea"] ? String(row["办公面积"] || row["officeArea"]) : undefined,
              employeeCount: row["员工数量"] || row["employeeCount"] ? Number(row["员工数量"] || row["employeeCount"]) : undefined,
              tags: row["标签"] || row["tags"] ? String(row["标签"] || row["tags"]) : undefined,
              notes: row["备注"] || row["notes"] ? String(row["备注"] || row["notes"]) : undefined,
              dataSource: 'manual',
            })).filter(c => c.companyName);
            console.log('[Excel Import] Standard format - valid companies count:', companies.length);
            if (companies.length > 0) {
              console.log('[Excel Import] First company:', JSON.stringify(companies[0], null, 2));
            }
          }

          console.log('[Excel Import] Total valid companies to insert:', companies.length);
          const count = await createParkCompanies(companies);
          console.log('[Excel Import] Actually inserted count:', count);
          return {
            success: true,
            count,
            format: isQichachaFormat ? 'qichacha' : 'standard',
            message: isQichachaFormat
              ? `成功导入 ${count} 家企业（企查查格式）`
              : `成功导入 ${count} 家企业`
          };
        } catch (error) {
          console.error("XLS import error:", error);
          throw new Error("文件解析失败，请确保文件格式正确");
        }
      }),

    // 获取所有企业名称（用于匹配分析）
    getAllNames: publicProcedure.query(async () => {
      return getAllParkCompanyNames();
    }),
  }),

  // ============ 企业名称搜索建议 ============
  companySearch: router({
    // 企业名称搜索建议（优先缓存 -> 园区企业库 -> 企查查API）
    suggest: publicProcedure
      .input(z.object({ keyword: z.string().min(1) }))
      .query(async ({ input }) => {
        const { keyword } = input;
        const suggestions: {
          name: string;
          source: string;
          creditCode?: string;
          legalPerson?: string;
          status?: string;
          establishDate?: string;
        }[] = [];

        // 1. 从本地缓存中搜索（优先级最高）
        const cachedResults = await getCachedSearchResults(keyword);
        if (cachedResults && cachedResults.length > 0) {
          const cachedSuggestions = cachedResults.slice(0, 5).map(c => ({
            name: c.companyName,
            source: "缓存数据",
            creditCode: c.creditCode,
            legalPerson: c.legalPerson || undefined,
            status: c.status || undefined,
            establishDate: c.establishDate || undefined,
          }));
          suggestions.push(...cachedSuggestions);
        }

        // 2. 从本地缓存表中模糊搜索（可能命中其他关键词缓存的企业）
        if (suggestions.length < 5) {
          const localCacheResults = await searchCompanyCache(keyword);
          const localSuggestions = localCacheResults
            .filter(c => !suggestions.some(s => s.creditCode === c.creditCode))
            .slice(0, 5 - suggestions.length)
            .map(c => ({
              name: c.companyName,
              source: "本地缓存",
              creditCode: c.creditCode,
              legalPerson: c.legalPerson || undefined,
              status: c.status || undefined,
              establishDate: c.establishDate || undefined,
            }));
          suggestions.push(...localSuggestions);
        }

        // 3. 从园区企业库中搜索
        const parkCompaniesData = await getAllParkCompanyNames();
        const matchedParkCompanies = parkCompaniesData
          .filter(c => c.companyName.toLowerCase().includes(keyword.toLowerCase()))
          .filter(c => !suggestions.some(s => s.name === c.companyName))
          .slice(0, 3)
          .map(c => ({ name: c.companyName, source: "园区企业" }));
        suggestions.push(...matchedParkCompanies);

        // 4. 从历史报告中搜索
        const reports = await getCompanyReports(100, 0);
        const matchedReports = reports
          .filter(r => r.companyName.toLowerCase().includes(keyword.toLowerCase()))
          .filter(r => !suggestions.some(s => s.name === r.companyName))
          .slice(0, 3)
          .map(r => ({ name: r.companyName, source: "历史查询" }));
        suggestions.push(...matchedReports);

        // 5. 如果本地没有结果且配置了企查查API，则调用API
        if (suggestions.length < 3 && keyword.length >= 2) {
          const qccResults = await callQichachaApi(keyword);
          if (qccResults.length > 0) {
            // 保存到缓存
            await saveSearchResultsToCache(keyword, qccResults.map(r => ({
              creditCode: r.creditCode,
              companyName: r.name,
              legalPerson: r.legalPerson,
              status: r.status,
              establishDate: r.establishDate,
              registeredCapital: r.registeredCapital,
              address: r.address,
              dataSource: "qichacha",
            })));

            const apiSuggestions = qccResults
              .filter(r => !suggestions.some(s => s.name === r.name))
              .slice(0, 5)
              .map(r => ({
                name: r.name,
                source: "企查查",
                creditCode: r.creditCode,
                legalPerson: r.legalPerson,
                status: r.status,
                establishDate: r.establishDate,
              }));
            suggestions.push(...apiSuggestions);
          }
        }

        // 6. 添加常见企业名称后缀建议（作为备用）
        const commonSuffixes = ["有限公司", "科技有限公司", "集团有限公司"];
        if (suggestions.length < 5 && keyword.length >= 2 && !keyword.includes("有限") && !keyword.includes("公司")) {
          const suffixSuggestions = commonSuffixes
            .slice(0, 5 - suggestions.length)
            .map(suffix => ({ name: `${keyword}${suffix}`, source: "名称建议" }))
            .filter(s => !suggestions.some(existing => existing.name === s.name));
          suggestions.push(...suffixSuggestions);
        }

        return suggestions.slice(0, 10);
      }),

    // 获取缓存统计信息
    cacheStats: publicProcedure.query(async () => {
      const stats = await getCacheStats();
      const cacheDays = getCacheDays();
      return { ...stats, cacheDays };
    }),
  }),

  // ============ 公司报告管理 ============
  report: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional())
      .query(async ({ input }) => {
        const { limit = 50, offset = 0 } = input || {};
        return getCompanyReports(limit, offset);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getCompanyReportById(input.id);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCompanyReport(input.id);
        return { success: true };
      }),

    // 导出报告Word文档
    exportWord: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const report = await getCompanyReportById(input.id);
        if (!report) throw new Error("报告不存在");
        if (!report.reportContent) throw new Error("报告内容为空");

        let parkAnalysis = undefined;
        if (report.parkAnalysis) {
          try {
            parkAnalysis = JSON.parse(report.parkAnalysis);
          } catch (e) {
            console.error("Parse park analysis error:", e);
          }
        }

        const result = await generateWordDocument({
          companyName: report.companyName,
          reportContent: report.reportContent,
          parkAnalysis,
        });

        await updateCompanyReport(input.id, { wordFileUrl: result.url });
        return { url: result.url };
      }),

    // 导出缩略版Word文档
    exportSummaryWord: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const report = await getCompanyReportById(input.id);
        if (!report) throw new Error("报告不存在");
        if (!report.summaryContent) throw new Error("缩略版报告内容为空");

        const result = await generateWordDocument({
          companyName: report.companyName + "（摘要）",
          reportContent: report.summaryContent,
        });

        return { url: result.url };
      }),

    // 创建报告（开始生成流程）- 创建后立即后台异步生成
    // 需要登录并检查额度
    create: protectedProcedure
      .input(z.object({
        companyName: z.string(),
        llmProvider: z.enum(['qwen', 'zhipu', 'wenxin']).optional(),
        llmModel: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 0. 检查用户额度
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录' });
        }

        const quotaCheck = await checkUserQuota(ctx.user.id);
        if (!quotaCheck.hasQuota) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `您的报告额度已用完（已使用 ${quotaCheck.used}/${quotaCheck.total} 份），请联系管理员增加额度`
          });
        }

        // 1. 获取系统级LLM配置
        // 优先使用用户偏好的LLM
        let provider = input.llmProvider || (ctx.user.preferredLlm as 'qwen' | 'zhipu' | 'wenxin' | null);
        let model = input.llmModel;
        let apiKey: string | undefined;
        let apiSecret: string | undefined;

        // 如果没有指定提供商，使用默认配置
        if (!provider) {
          console.log('[Report] 未指定提供商，查找默认配置...');
          const defaultConfig = await getDefaultLlmConfig();
          if (defaultConfig) {
            provider = defaultConfig.provider as 'qwen' | 'zhipu' | 'wenxin';
            model = model || defaultConfig.defaultModel;
            apiKey = defaultConfig.apiKey;
            apiSecret = defaultConfig.apiSecret;
            console.log(`[Report] 使用默认LLM提供商: ${provider}, 模型: ${model}, API Key长度: ${apiKey?.length || 0}`);
          } else {
            provider = 'zhipu'; // 默认使用智谱
            console.log('[Report] 未找到默认配置，使用智谱AI作为默认');
          }
        } else {
          console.log(`[Report] 用户指定提供商: ${provider}`);
        }

        // 如果指定了提供商但没有API Key，从数据库获取
        if (!apiKey && provider !== 'qwen') {
          console.log(`[Report] 提供商 ${provider} 缺少API Key，从数据库查找...`);
          const savedConfig = await getLlmConfig(provider);
          if (savedConfig) {
            apiKey = savedConfig.apiKey;
            apiSecret = savedConfig.apiSecret;
            model = model || savedConfig.defaultModel;
            console.log(`[Report] 从数据库获取到 ${provider} 的API Key, 长度: ${apiKey?.length || 0}, 模型: ${model}`);
          } else {
            console.error(`[Report] 警告: 数据库中未找到 ${provider} 的配置！`);
          }
        }

        // 2. 创建报告记录
        const id = await createCompanyReport({
          companyName: input.companyName,
          status: "pending",
          dataSource: "web",
          llmProvider: provider,
        } as any);

        // 3. 扣减用户额度
        await incrementUserReportUsed(ctx.user.id);

        // 4. 准备LLM配置
        const llmConfig: LLMProviderConfig = {
          apiKey,
          apiSecret,
          model,
        };

        console.log('[Report] ========== LLM配置摘要 ==========');
        console.log('[Report] 提供商:', provider);
        console.log('[Report] 模型:', model || '默认');
        console.log('[Report] API Key状态:', apiKey ? `已配置(长度${apiKey.length})` : '未配置');
        console.log('[Report] API Secret状态:', apiSecret ? '已配置' : '未配置');
        console.log('[Report] =====================================');

        // 5. 立即触发后台异步生成（不等待完成）
        generateReportAsync(id, provider, llmConfig).catch(err => {
          console.error("[Report] Background generation error for report", id, ":", err);
        });

        // 6. 立即返回报告ID，用户无需等待
        return { id, message: "报告正在后台生成中" };
      }),

    // 生成报告（搜索信息 + LLM生成）- 改为后台任务模式
    generate: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const report = await getCompanyReportById(input.id);
        if (!report) throw new Error("报告不存在");

        // 立即返回，后台异步生成
        generateReportAsync(input.id).catch(err => {
          console.error("Background report generation error:", err);
        });

        return { success: true, message: "报告生成任务已提交，请稍后刷新查看结果" };
      }),
  }),

  // ============ 批量任务管理 ============
  batchTask: router({
    // 获取批量任务列表
    list: publicProcedure
      .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }).optional())
      .query(async ({ input }) => {
        const { limit = 20, offset = 0 } = input || {};
        return getBatchTasks(limit, offset);
      }),

    // 获取批量任务详情
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const task = await getBatchTaskById(input.id);
        if (!task) return null;

        const reports = await getBatchTaskReports(input.id);
        return { ...task, reports };
      }),

    // 创建批量任务（CSV导入）
    create: publicProcedure
      .input(z.object({
        fileContent: z.string(), // base64 encoded CSV
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const batchLimitRaw = await getSystemConfig("batch_query_max_count", "50");
          const batchLimit = Number.parseInt(batchLimitRaw, 10);
          const maxCount = Number.isFinite(batchLimit) ? batchLimit : 50;
          if (maxCount <= 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "批量查询已禁用",
            });
          }

          // 解析CSV文件
          const buffer = Buffer.from(input.fileContent, "base64");
          const content = buffer.toString("utf-8");
          const lines = content.split(/\r?\n/).filter(line => line.trim());

          // 跳过表头，获取企业名称列表
          const companyNames: string[] = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // 尝试解析CSV格式（支持逗号分隔）
            const parts = line.split(",");
            const name = parts[0].replace(/^["']|["']$/g, "").trim();

            // 跳过表头
            if (i === 0 && (name === "企业名称" || name === "公司名称" || name === "companyName" || name === "name")) {
              continue;
            }

            if (name) {
              companyNames.push(name);
            }
          }

          // 检查数量限制
          if (companyNames.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "CSV文件中没有找到有效的企业名称",
            });
          }

          if (companyNames.length > maxCount) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `每次最多支持${maxCount}个企业，当前文件包含${companyNames.length}个企业`,
            });
          }

          // 创建批量任务
          const taskId = await createBatchTask({
            totalCount: companyNames.length,
            completedCount: 0,
            failedCount: 0,
            status: "pending",
            companyNames: JSON.stringify(companyNames),
          });

          // 创建各个报告记录
          for (const companyName of companyNames) {
            await createCompanyReport({
              companyName,
              status: "pending",
              dataSource: "web",
              batchTaskId: taskId,
            });
          }

          // 启动后台任务
          processBatchTaskAsync(taskId).catch(err => {
            console.error("Background batch task error:", err);
          });

          return {
            success: true,
            taskId,
            count: companyNames.length,
            message: `已创建批量任务，共${companyNames.length}个企业，正在后台生成中...`
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("CSV import error:", error);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CSV文件解析失败，请确保文件格式正确",
          });
        }
      }),

    // 打包下载批量任务的所有报告
    downloadAll: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const task = await getBatchTaskById(input.id);
        if (!task) throw new Error("任务不存在");

        if (task.status !== "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务尚未完成，请等待所有报告生成完毕",
          });
        }

        // 如果已有打包文件，直接返回
        if (task.zipFileUrl) {
          return { url: task.zipFileUrl };
        }

        // 获取所有报告并打包
        const reports = await getBatchTaskReports(input.id);
        const completedReports = reports.filter(r => r.status === "completed" && r.reportContent);

        if (completedReports.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "没有成功生成的报告可供下载",
          });
        }

        // 生成合并的Markdown文件
        let combinedContent = `# 批量企业分析报告\n\n`;
        combinedContent += `生成时间：${new Date().toLocaleString("zh-CN")}\n`;
        combinedContent += `共${completedReports.length}个企业\n\n---\n\n`;

        for (const report of completedReports) {
          combinedContent += `# ${report.companyName}\n\n`;
          combinedContent += report.reportContent + "\n\n";
          combinedContent += "---\n\n";
        }

        // 上传到S3
        const fileName = `batch-reports-${task.id}-${Date.now()}.md`;
        const { url } = await storagePut(fileName, Buffer.from(combinedContent, "utf-8"), "text/markdown");

        // 更新任务记录
        await updateBatchTask(input.id, { zipFileUrl: url });

        return { url };
      }),

    // 删除批量任务
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const task = await getBatchTaskById(input.id);
        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在",
          });
        }

        // 不允许删除正在处理中的任务
        if (task.status === "processing") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "无法删除正在处理中的任务，请等待任务完成",
          });
        }

        await deleteBatchTask(input.id);
        return { success: true, message: "任务已删除" };
      }),
  }),

  // ============ 数据源配置 ============
  dataSource: router({
    list: publicProcedure.query(async () => {
      return getDataSourceConfigs();
    }),

    getActive: publicProcedure.query(async () => {
      return getActiveDataSource();
    }),

    update: publicProcedure
      .input(z.object({
        sourceType: z.enum(["web", "tianyancha", "qichacha"]),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        baseUrl: z.string().optional(),
        isEnabled: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        await upsertDataSourceConfig(input);
        return { success: true };
      }),

    setActive: publicProcedure
      .input(z.object({ sourceType: z.enum(["web", "tianyancha", "qichacha"]) }))
      .mutation(async ({ input }) => {
        await setActiveDataSource(input.sourceType);
        return { success: true };
      }),
  }),

  // ============ 企查查数据缓存管理 ============
  qichachaCache: router({
    // 获取缓存统计信息
    stats: publicProcedure.query(async () => {
      const stats = await getQichachaCacheStats();
      const cacheDays = await getCacheDaysConfig();
      return { ...stats, cacheDays };
    }),

    // 获取缓存有效期配置
    getCacheDays: publicProcedure.query(async () => {
      return getCacheDaysConfig();
    }),

    // 设置缓存有效期
    setCacheDays: publicProcedure
      .input(z.object({ days: z.number().min(1).max(365) }))
      .mutation(async ({ input }) => {
        await setCacheDaysConfig(input.days);
        return { success: true, message: `缓存有效期已设置为 ${input.days} 天` };
      }),

    // 清理过期缓存
    cleanExpired: publicProcedure.mutation(async () => {
      const cacheDays = await getCacheDaysConfig();
      const deletedCount = await cleanExpiredCache(cacheDays);
      return { success: true, deletedCount, message: `已清理 ${deletedCount} 条过期缓存` };
    }),

    // 获取所有缓存记录（用于导出）
    list: publicProcedure.query(async () => {
      return getAllQichachaCacheRecords();
    }),

    // 导出缓存数据为Excel
    export: publicProcedure.mutation(async () => {
      const records = await getAllQichachaCacheRecords();

      if (records.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "没有可导出的缓存数据",
        });
      }

      // 构建Excel数据
      const exportData = records.map(r => {
        const basicInfo = r.basicInfo ? JSON.parse(r.basicInfo) : {};
        const shareholders = r.shareholders ? JSON.parse(r.shareholders) : [];
        const executives = r.executives ? JSON.parse(r.executives) : [];
        const patents = r.patents ? JSON.parse(r.patents) : { total: 0 };
        const trademarks = r.trademarks ? JSON.parse(r.trademarks) : { total: 0 };
        const copyrights = r.copyrights ? JSON.parse(r.copyrights) : { total: 0 };
        const customers = r.customers ? JSON.parse(r.customers) : [];
        const suppliers = r.suppliers ? JSON.parse(r.suppliers) : [];
        const annualReports = r.annualReports ? JSON.parse(r.annualReports) : [];
        const certificates = r.certificates ? JSON.parse(r.certificates) : { total: 0 };

        return {
          '企业名称': r.companyName,
          '统一社会信用代码': r.creditCode,
          '法定代表人': basicInfo.OperName || '',
          '注册资本': basicInfo.RegistCapi || '',
          '成立日期': basicInfo.StartDate || '',
          '企业状态': basicInfo.Status || '',
          '所属行业': basicInfo.Industry || '',
          '注册地址': basicInfo.Address || '',
          '经营范围': basicInfo.Scope || '',
          '股东数量': shareholders.length,
          '高管数量': executives.length,
          '专利数量': patents.total || 0,
          '商标数量': trademarks.total || 0,
          '软著数量': copyrights.total || 0,
          '客户数量': customers.length,
          '供应商数量': suppliers.length,
          '年报数量': annualReports.length,
          '资质证书数量': certificates.total || 0,
          '缓存时间': r.cachedAt ? new Date(r.cachedAt).toLocaleString('zh-CN') : '',
          '命中次数': r.hitCount || 0,
        };
      });

      // 创建Excel工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // 设置列宽
      ws['!cols'] = [
        { wch: 30 }, // 企业名称
        { wch: 22 }, // 信用代码
        { wch: 12 }, // 法人
        { wch: 15 }, // 注册资本
        { wch: 12 }, // 成立日期
        { wch: 10 }, // 状态
        { wch: 20 }, // 行业
        { wch: 40 }, // 地址
        { wch: 50 }, // 经营范围
        { wch: 10 }, // 股东数
        { wch: 10 }, // 高管数
        { wch: 10 }, // 专利数
        { wch: 10 }, // 商标数
        { wch: 10 }, // 软著数
        { wch: 10 }, // 客户数
        { wch: 10 }, // 供应商数
        { wch: 10 }, // 年报数
        { wch: 12 }, // 资质数
        { wch: 20 }, // 缓存时间
        { wch: 10 }, // 命中次数
      ];

      XLSX.utils.book_append_sheet(wb, ws, '企业缓存数据');

      // 生成Excel文件
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // 上传到S3
      const fileName = `cache-export-${Date.now()}.xlsx`;
      const { url } = await storagePut(fileName, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      return {
        success: true,
        url,
        count: records.length,
        message: `已导出 ${records.length} 条缓存记录`
      };
    }),

    // 刷新指定企业的缓存（删除旧缓存并重新获取）
    refresh: publicProcedure
      .input(z.object({ creditCode: z.string() }))
      .mutation(async ({ input }) => {
        // 删除旧缓存
        await deleteQichachaCache(input.creditCode);

        // 重新获取数据（会自动缓存）
        const newData = await getCompanyFullInfo(input.creditCode);

        return {
          success: true,
          companyName: newData.basicInfo?.Name || '',
          message: '缓存已刷新'
        };
      }),

    // 检查企业是否已缓存
    checkCached: publicProcedure
      .input(z.object({ companyNames: z.array(z.string()) }))
      .query(async ({ input }) => {
        const cached = await checkCachedCompanies(input.companyNames);
        return {
          cached,
          notCached: input.companyNames.filter(n => !cached.includes(n)),
        };
      }),
  }),

  // ============ 缓存预热任务 ============
  cacheWarmup: router({
    // 创建预热任务
    create: publicProcedure
      .input(z.object({
        companyNames: z.array(z.string()).min(1).max(500),
        skipExisting: z.boolean().default(true), // 是否跳过已缓存的企业
      }))
      .mutation(async ({ input }) => {
        let companyNames = input.companyNames;
        let skippedCount = 0;

        // 检查已缓存的企业
        if (input.skipExisting) {
          const cached = await checkCachedCompanies(companyNames);
          skippedCount = cached.length;
          companyNames = companyNames.filter(n => !cached.includes(n));
        }

        if (companyNames.length === 0) {
          return {
            success: true,
            taskId: null,
            message: `所有 ${skippedCount} 家企业已有缓存，无需预热`,
            skippedCount,
          };
        }

        // 创建预热任务
        const taskId = await createCacheWarmupTask({
          totalCount: companyNames.length + skippedCount,
          skippedCount,
          companyNames: JSON.stringify(companyNames),
          status: 'pending',
        });

        // 异步执行预热
        executeCacheWarmup(taskId, companyNames);

        return {
          success: true,
          taskId,
          message: `预热任务已创建，共 ${companyNames.length} 家企业待预热，${skippedCount} 家已跳过`,
          toWarmup: companyNames.length,
          skippedCount,
        };
      }),

    // 获取预热任务列表
    list: publicProcedure.query(async () => {
      return getCacheWarmupTasks();
    }),

    // 获取单个预热任务详情
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getCacheWarmupTaskById(input.id);
      }),

    // 取消预热任务
    cancel: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const task = await getCacheWarmupTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        if (task.status !== 'processing' && task.status !== 'pending') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "只能取消进行中或等待中的任务" });
        }
        await updateCacheWarmupTask(input.id, { status: 'cancelled' });
        return { success: true, message: '任务已取消' };
      }),

    // 删除预热任务
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const task = await getCacheWarmupTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        if (task.status === 'processing') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "无法删除进行中的任务" });
        }
        await deleteCacheWarmupTask(input.id);
        return { success: true, message: '任务已删除' };
      }),

    // 从园区企业创建预热任务
    createFromPark: publicProcedure
      .input(z.object({ skipExisting: z.boolean().default(true) }))
      .mutation(async ({ input }) => {
        // 获取所有园区企业
        const parkCompanies = await getAllParkCompanyNames();
        const companyNames = parkCompanies.map(c => c.companyName);

        if (companyNames.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "园区企业库为空" });
        }

        let toWarmup = companyNames;
        let skippedCount = 0;

        if (input.skipExisting) {
          const cached = await checkCachedCompanies(companyNames);
          skippedCount = cached.length;
          toWarmup = companyNames.filter(n => !cached.includes(n));
        }

        if (toWarmup.length === 0) {
          return {
            success: true,
            taskId: null,
            message: `所有 ${skippedCount} 家园区企业已有缓存`,
            skippedCount,
          };
        }

        const taskId = await createCacheWarmupTask({
          totalCount: companyNames.length,
          skippedCount,
          companyNames: JSON.stringify(toWarmup),
          status: 'pending',
        });

        executeCacheWarmup(taskId, toWarmup);

        return {
          success: true,
          taskId,
          message: `预热任务已创建，共 ${toWarmup.length} 家企业待预热，${skippedCount} 家已跳过`,
          toWarmup: toWarmup.length,
          skippedCount,
        };
      }),
  }),
});

// ============ 后台异步生成报告 ============
async function generateReportAsync(
  reportId: number,
  llmProvider?: LLMProvider,
  llmConfig?: LLMProviderConfig
) {
  const report = await getCompanyReportById(reportId);
  if (!report) return;

  // 使用传入的LLM配置，或从报告记录中获取
  const provider = llmProvider || (report as any).llmProvider || 'zhipu';
  console.log('[Report] Using LLM provider:', provider);

  try {
    // 更新状态为搜索中
    await updateCompanyReport(reportId, { status: "searching" });

    // 获取园区企业列表用于匹配分析
    const parkCompanies = await getAllParkCompanyNames();

    // 检查当前启用的数据源
    const activeDataSource = await getActiveDataSource();
    const useQichacha = activeDataSource?.sourceType === "qichacha";
    console.log('[Report] Active data source:', activeDataSource?.sourceType || 'web (default)');

    // 根据数据源配置决定是否调用企查查API
    let companyFullInfo: CompanyFullInfo | null = null;
    if (useQichacha) {
      try {
        companyFullInfo = await getCompanyFullInfo(report.companyName);
        console.log('[Report] Got company info from QCC:', companyFullInfo.basicInfo?.Name || 'No data');
      } catch (qccError) {
        console.log('[Report] QCC API error:', qccError);
      }
    } else {
      console.log('[Report] Skipping QCC API - data source is:', activeDataSource?.sourceType || 'web');
    }

    // 更新状态为生成中
    await updateCompanyReport(reportId, { status: "generating" });

    // 使用LLM生成报告，传入企查查数据和LLM配置
    const reportResult = await generateCompanyReport(
      report.companyName,
      parkCompanies,
      companyFullInfo,
      provider as LLMProvider,
      llmConfig
    );

    // 检查是否找到企业信息 - 只有明显无效的输入才会返回 found=false
    if (!reportResult.found) {
      await updateCompanyReport(reportId, {
        status: "failed",
        errorMessage: reportResult.message || "请输入有效的企业名称",
      });
      return;
    }

    // 解析园区匹配分析
    const parkAnalysis = await generateParkAnalysis(report.companyName, parkCompanies);

    // 保存企查查获取的企业信息（包含知识产权、资质证书、客户供应商等）
    const companyInfo = companyFullInfo?.basicInfo ? JSON.stringify({
      name: companyFullInfo.basicInfo.Name,
      creditCode: companyFullInfo.basicInfo.CreditCode,
      legalPerson: companyFullInfo.basicInfo.OperName,
      status: companyFullInfo.basicInfo.Status,
      establishDate: companyFullInfo.basicInfo.StartDate,
      registeredCapital: companyFullInfo.basicInfo.RegistCapi,
      realCapital: companyFullInfo.basicInfo.RecCap,  // 实缴资本
      address: companyFullInfo.basicInfo.Address,
      scope: companyFullInfo.basicInfo.Scope,
      industry: companyFullInfo.basicInfo.Industry || "暂无公开数据",
      // 股东和高管
      shareholders: companyFullInfo.shareholders,
      executives: companyFullInfo.executives,
      // 知识产权（专利、商标、软著）
      patents: companyFullInfo.patents,
      trademarks: companyFullInfo.trademarks,
      copyrights: companyFullInfo.copyrights,
      // 资质证书
      certificates: companyFullInfo.certificates,
      // 客户和供应商
      customers: companyFullInfo.customers,
      suppliers: companyFullInfo.suppliers,
      // 年报信息
      annualReports: companyFullInfo.annualReports,
      // 融资信息
      financings: companyFullInfo.financings,
    }) : null;

    // 生成缩略版报告（供领导快速查阅）
    let summaryContent = "";
    if (reportResult.content) {
      try {
        console.log('[Report] Generating summary report...');
        summaryContent = await generateSummaryReport(report.companyName, reportResult.content, companyFullInfo, provider as LLMProvider, llmConfig);
        console.log('[Report] Summary report generated, length:', summaryContent.length);
      } catch (summaryError) {
        console.error('[Report] Failed to generate summary:', summaryError);
        // 缩略版生成失败不影响完整版
      }
    }

    // 更新报告内容（包含完整版、缩略版和股权穿透数据）
    await updateCompanyReport(reportId, {
      status: "completed",
      reportContent: reportResult.content,
      summaryContent: summaryContent || null,
      parkAnalysis: JSON.stringify(parkAnalysis),
      companyInfo: companyInfo,
      dataSource: companyFullInfo?.basicInfo ? "qichacha" : "web",
      equityThrough: companyFullInfo?.equityThrough ? JSON.stringify(companyFullInfo.equityThrough) : null,
      investmentThrough: companyFullInfo?.investmentThrough ? JSON.stringify(companyFullInfo.investmentThrough) : null,
    } as any);
  } catch (error) {
    console.error("Report generation error:", error);
    await updateCompanyReport(reportId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "生成失败",
    });
  }
}

// ============ 后台处理批量任务 ============
async function processBatchTaskAsync(taskId: number) {
  const task = await getBatchTaskById(taskId);
  if (!task) return;

  try {
    await updateBatchTask(taskId, { status: "processing" });

    const reports = await getBatchTaskReports(taskId);
    let completedCount = 0;
    let failedCount = 0;

    for (const report of reports) {
      try {
        await generateReportAsync(report.id);

        // 重新获取报告状态
        const updatedReport = await getCompanyReportById(report.id);
        if (updatedReport?.status === "completed") {
          completedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        console.error(`Failed to generate report for ${report.companyName}:`, error);
      }

      // 更新任务进度
      await updateBatchTask(taskId, { completedCount, failedCount });
    }

    // 更新任务状态为完成
    await updateBatchTask(taskId, {
      status: "completed",
      completedCount,
      failedCount,
    });
  } catch (error) {
    console.error("Batch task error:", error);
    await updateBatchTask(taskId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "批量任务处理失败",
    });
  }
}

// ============ LLM报告生成函数 ============
interface ReportResult {
  found: boolean;
  content?: string;
  message?: string;
}

async function generateCompanyReport(
  companyName: string,
  parkCompanies: {
    id: number;
    companyName: string;
    industry: string | null;
    businessScope: string | null;
    creditCode?: string | null;
    legalPerson?: string | null;
    companyStatus?: string | null;
    companyScale?: string | null;
    registeredCapital?: string | null;
    address?: string | null;
    tags?: string | null;
  }[],
  companyFullInfo?: CompanyFullInfo | null,
  llmProvider?: LLMProvider,
  llmConfig?: LLMProviderConfig
): Promise<ReportResult> {
  // 构建园区企业列表，包含更多信息用于上下游分析
  const parkCompanyList = parkCompanies.map(c => {
    const parts = [`- ${c.companyName}`];
    if (c.industry) parts.push(`行业：${c.industry}`);
    if (c.businessScope) parts.push(`业务：${c.businessScope.substring(0, 100)}...`);
    if (c.companyScale) parts.push(`规模：${c.companyScale}`);
    return parts.join(' | ');
  }).join("\n");

  // 检查企业名称是否明显无效（在调用LLM之前先过滤）
  const invalidPatterns = [
    /^test$/i,
    /^\d+$/,
    /^测试/,
    /^[a-zA-Z]{1,3}$/,
    /^\s*$/,
  ];

  const isInvalidName = invalidPatterns.some(pattern => pattern.test(companyName.trim()));
  if (isInvalidName) {
    return {
      found: false,
      message: "请输入有效的企业名称",
    };
  }

  // 构建企查查数据摘要（如果有）
  let qccDataSection = "";
  if (companyFullInfo?.basicInfo) {
    const info = companyFullInfo.basicInfo;
    qccDataSection = `
**企查查工商数据（已验证）**：
- 企业名称：${info.Name}
- 统一社会信用代码：${info.CreditCode}
- 法定代表人：${info.OperName}
- 企业状态：${info.Status}
- 成立日期：${info.StartDate}
- 注册资本：${info.RegistCapi}
- 实缴资本：${info.RecCap}
- 注册地址：${info.Address}
- 经营范围：${info.Scope}
- 所属行业：${info.Industry || "暂无公开数据"}
`;

    // 股东信息
    if (companyFullInfo.shareholders && companyFullInfo.shareholders.length > 0) {
      qccDataSection += `\n**股东信息**：\n`;
      companyFullInfo.shareholders.slice(0, 10).forEach(s => {
        qccDataSection += `- ${s.StockName}：持股${s.StockPercent || '未知'}，认缴${s.ShouldCapi || '未知'}\n`;
      });
    }

    // 高管基本信息
    if (companyFullInfo.executives && companyFullInfo.executives.length > 0) {
      qccDataSection += `\n**高管信息**：\n`;
      companyFullInfo.executives.forEach(e => {
        qccDataSection += `- ${e.Name}：${e.Job}\n`;
      });
    }

    // 高管详细信息（包含关联企业、其他任职）
    if (companyFullInfo.executiveDetails && companyFullInfo.executiveDetails.length > 0) {
      qccDataSection += `\n**高管关联企业信息**：\n`;
      companyFullInfo.executiveDetails.slice(0, 5).forEach(e => {
        qccDataSection += `- ${e.Name}(${e.Job})：`;
        // 显示关联企业统计
        const stats: string[] = [];
        if (e.TotalCompanies > 0) stats.push(`关联企业${e.TotalCompanies}家`);
        if (e.AsLegalRep > 0) stats.push(`担任法人${e.AsLegalRep}家`);
        if (e.AsExecutive > 0) stats.push(`任职${e.AsExecutive}家`);
        if (stats.length > 0) {
          qccDataSection += stats.join('、');
        } else {
          qccDataSection += `无其他关联企业`;
        }
        // 显示其他任职企业名称
        if (e.OtherCompany && e.OtherCompany.length > 0) {
          const otherNames = e.OtherCompany
            .filter(c => c.Status === '存续' || c.Status === '在业')  // 只显示存续企业
            .slice(0, 3)
            .map(c => `${c.Name}(${c.Job || '未知职务'})`)
            .join('、');
          if (otherNames) {
            qccDataSection += `，包括：${otherNames}`;
          }
        }
        qccDataSection += `\n`;
      });
    }

    // 专利信息
    if (companyFullInfo.patents && companyFullInfo.patents.total > 0) {
      qccDataSection += `\n**专利信息**（共${companyFullInfo.patents.total}项）：\n`;
      companyFullInfo.patents.list.slice(0, 10).forEach(p => {
        qccDataSection += `- ${p.Title}（${p.PatentType || '未知类型'}）- ${p.LegalStatus || '状态未知'}，申请日期：${p.ApplicationDate || '未知'}\n`;
      });
      if (companyFullInfo.patents.total > 10) {
        qccDataSection += `- ...等共${companyFullInfo.patents.total}项专利\n`;
      }
    }

    // 商标信息
    if (companyFullInfo.trademarks && companyFullInfo.trademarks.total > 0) {
      qccDataSection += `\n**商标信息**（共${companyFullInfo.trademarks.total}项）：\n`;
      companyFullInfo.trademarks.list.slice(0, 10).forEach(t => {
        qccDataSection += `- ${t.Name}（注册号：${t.RegNo}，分类：${t.IntCls}）- ${t.Status || '状态未知'}\n`;
      });
      if (companyFullInfo.trademarks.total > 10) {
        qccDataSection += `- ...等共${companyFullInfo.trademarks.total}项商标\n`;
      }
    }

    // 软著信息
    if (companyFullInfo.copyrights && companyFullInfo.copyrights.total > 0) {
      qccDataSection += `\n**软件著作权**（共${companyFullInfo.copyrights.total}项）：\n`;
      companyFullInfo.copyrights.list.slice(0, 10).forEach(c => {
        qccDataSection += `- ${c.Name}（登记号：${c.RegisterNo}）- 登记日期：${c.RegisterDate || '未知'}\n`;
      });
      if (companyFullInfo.copyrights.total > 10) {
        qccDataSection += `- ...等共${companyFullInfo.copyrights.total}项软著\n`;
      }
    }

    // 资质证书
    if (companyFullInfo.certificates && companyFullInfo.certificates.total > 0) {
      qccDataSection += `\n**资质证书**（共${companyFullInfo.certificates.total}项）：\n`;
      companyFullInfo.certificates.list.slice(0, 10).forEach(c => {
        qccDataSection += `- ${c.CertName ?? c.Name}（证书号：${c.CertNo ?? c.No}）- 有效期：${c.StartDate || '未知'}至${c.EndDate || '未知'}\n`;
      });
    }

    // 客户信息（用于附录，需完整呈现）
    if (companyFullInfo.customers && companyFullInfo.customers.length > 0) {
      qccDataSection += `\n**主要客户清单（来源：招股书/年报，共${companyFullInfo.customers.length}家，附录需完整呈现）**：\n`;
      qccDataSection += `| 客户名称 | 销售占比 | 销售金额 | 年度 |\n|---|---|---|---|\n`;
      companyFullInfo.customers.forEach(c => {
        qccDataSection += `| ${c.CustomerName || '未知'} | ${c.Ratio || '未知'} | ${c.Amount || '未知'} | ${c.Year || '未知'} |\n`;
      });
    }

    // 供应商信息（用于附录，需完整呈现）
    if (companyFullInfo.suppliers && companyFullInfo.suppliers.length > 0) {
      qccDataSection += `\n**主要供应商清单（来源：招股书/年报，共${companyFullInfo.suppliers.length}家，附录需完整呈现）**：\n`;
      qccDataSection += `| 供应商名称 | 采购占比 | 采购金额 | 年度 |\n|---|---|---|---|\n`;
      companyFullInfo.suppliers.forEach(s => {
        qccDataSection += `| ${s.SupplierName || '未知'} | ${s.Ratio || '未知'} | ${s.Amount || '未知'} | ${s.Year || '未知'} |\n`;
      });
    }

    // 年报财务数据
    if (companyFullInfo.annualReports && companyFullInfo.annualReports.length > 0) {
      qccDataSection += `\n**年报财务数据**：\n`;
      companyFullInfo.annualReports.slice(0, 3).forEach(ar => {
        qccDataSection += `${ar.Year}年度：`;
        const parts = [];
        if (ar.TotalAssets) parts.push(`资产总额${ar.TotalAssets}`);
        if (ar.TotalSales) parts.push(`营业收入${ar.TotalSales}`);
        if (ar.TotalProfit) parts.push(`利润总额${ar.TotalProfit}`);
        if (ar.NetProfit) parts.push(`净利润${ar.NetProfit}`);
        if (ar.TotalTax) parts.push(`纳税总额${ar.TotalTax}`);
        // 提取社保人数：优先从SocialInsurance（API实际返回字段）中获取，其次SocialSecurityInfo，最后使用SocialSecurityNum
        const socialInsurance = ar.SocialInsurance || ar.SocialSecurityInfo;
        const socialSecurityNum = socialInsurance?.UrbanBasicIns || socialInsurance?.EmployeeBasicIns || ar.SocialSecurityNum;
        if (socialSecurityNum) {
          // 移除可能包含的"人"字，避免重复
          const numStr = String(socialSecurityNum).replace(/人$/, '');
          parts.push(`社保人数${numStr}人`);
        }
        qccDataSection += parts.join('，') || '无详细数据';
        qccDataSection += `\n`;
      });
    }

    // 融资信息
    if (companyFullInfo.financings && companyFullInfo.financings.total > 0) {
      qccDataSection += `\n**融资历程**（共${companyFullInfo.financings.total}轮）：\n`;
      companyFullInfo.financings.list.slice(0, 10).forEach(f => {
        qccDataSection += `- ${f.Date || '日期未知'}：${f.Round || '未知轮次'}`;
        if (f.Amount && f.Amount !== '未披露') qccDataSection += `，融资金额${f.Amount}`;
        if (f.Valuation && f.Valuation !== '未披露') qccDataSection += `，估值${f.Valuation}`;
        if (f.Investment) qccDataSection += `，投资方：${f.Investment}`;
        if (f.ProductName) qccDataSection += `（${f.ProductName}）`;
        qccDataSection += `\n`;
      });
      if (companyFullInfo.financings.total > 10) {
        qccDataSection += `- ...等共${companyFullInfo.financings.total}轮融资\n`;
      }
    }
    // 风险扫描信息
    if (companyFullInfo.riskScan && companyFullInfo.riskScan.Data) {
      const riskData = companyFullInfo.riskScan.Data;

      // 失信被执行人信息
      if (riskData.ShiXin && riskData.ShiXin.length > 0) {
        qccDataSection += `\n**失信被执行人信息**（共${riskData.ShiXin.length}条）：\n`;
        riskData.ShiXin.slice(0, 5).forEach((shiXin: any) => {
          qccDataSection += `- 案件:${shiXin.Case || '未知'} | 执行法院:${shiXin.Court || '未知'} | 立案日期:${shiXin.FilingDate || '未知'}\n`;
        });
      }

      // 被执行人信息
      if (riskData.ZhiXing && riskData.ZhiXing.length > 0) {
        qccDataSection += `\n**被执行人信息**（共${riskData.ZhiXing.length}条）：\n`;
        riskData.ZhiXing.slice(0, 5).forEach((zhiXing: any) => {
          qccDataSection += `- 案号:${zhiXing.CaseNo || '未知'} | 执行法院:${zhiXing.Court || '未知'} | 立案日期:${zhiXing.FilingDate || '未知'}\n`;
        });
      }

      // 行政处罚信息
      if (riskData.AdminPenalty && riskData.AdminPenalty.length > 0) {
        qccDataSection += `\n**行政处罚信息**（共${riskData.AdminPenalty.length}条）：\n`;
        riskData.AdminPenalty.slice(0, 5).forEach((penalty: any) => {
          qccDataSection += `- 处罚机关:${penalty.DecisionAuthority || '未知'} | 处罚内容:${penalty.Content || '未知'} | 决定日期:${penalty.DecisionDate || '未知'}\n`;
        });
      }

      // 经营异常信息
      if (riskData.Exception && riskData.Exception.length > 0) {
        qccDataSection += `\n**经营异常信息**（共${riskData.Exception.length}条）：\n`;
        riskData.Exception.slice(0, 5).forEach((exception: any) => {
          qccDataSection += `- 列入原因:${exception.Reasons || '未知'} | 列入日期:${exception.ListedDate || '未知'} | 移出日期:${exception.RemovedDate || '未移出'}\n`;
        });
      }

      // 动产抵押信息
      if (riskData.ChattelMortgage && riskData.ChattelMortgage.length > 0) {
        qccDataSection += `\n**动产抵押信息**（共${riskData.ChattelMortgage.length}条）：\n`;
        riskData.ChattelMortgage.slice(0, 5).forEach((mortgage: any) => {
          qccDataSection += `- 抵押权人:${mortgage.Mortgagee || '未知'} | 被担保债权:${mortgage.GuaranteedDebt || '未知'} | 登记日期:${mortgage.RegistrationDate || '未知'}\n`;
        });
      }

      // 股权质押信息
      if (riskData.EquityPledge && riskData.EquityPledge.length > 0) {
        qccDataSection += `\n**股权质押信息**（共${riskData.EquityPledge.length}条）：\n`;
        riskData.EquityPledge.slice(0, 5).forEach((pledge: any) => {
          qccDataSection += `- 质权人:${pledge.Pledgee || '未知'} | 出质人:${pledge.Pledgor || '未知'} | 质押数额:${pledge.Amount || '未知'}\n`;
        });
      }

      // 税务风险信息
      if (riskData.TaxAbnormal || riskData.TaxIllegal || riskData.TaxOweNotice) {
        qccDataSection += `\n**税务风险信息**：\n`;
        if (riskData.TaxAbnormal && riskData.TaxAbnormal.length > 0) {
          qccDataSection += `- 税务异常信息（共${riskData.TaxAbnormal.length}条）\n`;
        }
        if (riskData.TaxIllegal && riskData.TaxIllegal.length > 0) {
          qccDataSection += `- 税务违法信息（共${riskData.TaxIllegal.length}条）\n`;
        }
        if (riskData.TaxOweNotice && riskData.TaxOweNotice.length > 0) {
          qccDataSection += `- 欠税公告信息（共${riskData.TaxOweNotice.length}条）\n`;
        }
      }

      // 严重违法信息
      if (riskData.SeriousIllegal && riskData.SeriousIllegal.length > 0) {
        qccDataSection += `\n**严重违法信息**（共${riskData.SeriousIllegal.length}条）：\n`;
        riskData.SeriousIllegal.slice(0, 5).forEach((illegal: any) => {
          qccDataSection += `- 列入原因:${illegal.Reasons || '未知'} | 列入日期:${illegal.ListedDate || '未知'} | 移出日期:${illegal.RemovedDate || '未移出'}\n`;
        });
      }

      // 股权冻结信息
      if (riskData.EquityFreeze && riskData.EquityFreeze.length > 0) {
        qccDataSection += `\n**股权冻结信息**（共${riskData.EquityFreeze.length}条）：\n`;
        riskData.EquityFreeze.slice(0, 5).forEach((freeze: any) => {
          qccDataSection += `- 执行法院:${freeze.Court || '未知'} | 执行通知书文号:${freeze.NoticeNo || '未知'} | 冻结日期:${freeze.FreezeDate || '未知'}\n`;
        });
      }

      // 其他风险信息
      if (riskData.Bankruptcy || riskData.JudicialSale || riskData.Sumptuary) {
        qccDataSection += `\n**其他风险信息**：\n`;
        if (riskData.Bankruptcy && riskData.Bankruptcy.length > 0) {
          qccDataSection += `- 破产信息（共${riskData.Bankruptcy.length}条）\n`;
        }
        if (riskData.JudicialSale && riskData.JudicialSale.length > 0) {
          qccDataSection += `- 司法拍卖信息（共${riskData.JudicialSale.length}条）\n`;
        }
        if (riskData.Sumptuary && riskData.Sumptuary.length > 0) {
          qccDataSection += `- 限制消费信息（共${riskData.Sumptuary.length}条）\n`;
        }
      }

      // 变更记录信息 - 这些是您特别关心的风险点（地址变更、法人变更等）
      if (riskData.ChangeList && riskData.ChangeList.length > 0) {
        qccDataSection += `\n**重要变更记录**（共${riskData.ChangeList.length}条）：\n`;

        // 提取法人变更记录
        const legalRepChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && (
            change.ChangeSubject.includes('法定代表人') ||
            change.ChangeSubject.includes('负责人变更') ||
            change.ChangeSubject.includes('法定代表人、负责人变更')
          )
        );

        if (legalRepChanges.length > 0) {
          qccDataSection += `- **法定代表人变更**（共${legalRepChanges.length}次）：\n`;
          legalRepChanges.forEach((change: any) => {
            qccDataSection += `  * ${change.ChangeDate || '未知日期'}：由"${change.BeforeList?.[0] || '未知'}"变更为"${change.AfterList?.[0] || '未知'}"\n`;
          });
        }

        // 提取地址变更记录
        const addressChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && (
            change.ChangeSubject.includes('住所') ||
            change.ChangeSubject.includes('地址') ||
            change.ChangeSubject.includes('经营场所')
          )
        );

        if (addressChanges.length > 0) {
          qccDataSection += `- **注册地址变更**（共${addressChanges.length}次）：\n`;
          addressChanges.forEach((change: any) => {
            qccDataSection += `  * ${change.ChangeDate || '未知日期'}：${change.BeforeList?.[0] || '未知'} → ${change.AfterList?.[0] || '未知'}\n`;
          });
        }

        // 提取注册资本变更记录
        const capitalChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && (
            change.ChangeSubject.includes('注册资本') ||
            change.ChangeSubject.includes('实收资本')
          )
        );

        if (capitalChanges.length > 0) {
          qccDataSection += `- **注册资本变更**（共${capitalChanges.length}次）：\n`;
          capitalChanges.forEach((change: any) => {
            qccDataSection += `  * ${change.ChangeDate || '未知日期'}：${change.BeforeList?.[0] || '未知'} → ${change.AfterList?.[0] || '未知'}\n`;
          });
        }

        // 提取经营范围变更记录
        const scopeChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && change.ChangeSubject.includes('经营范围')
        );

        if (scopeChanges.length > 0) {
          qccDataSection += `- **经营范围变更**（共${scopeChanges.length}次）：\n`;
          scopeChanges.forEach((change: any) => {
            qccDataSection += `  * ${change.ChangeDate || '未知日期'}：由"${change.BeforeList?.[0] || '未知'}"变更为"${change.AfterList?.[0] || '未知'}"\n`;
          });
        }

        // 其他变更记录（限制显示总数，防止内容过多）
        const otherChanges = riskData.ChangeList.filter((change: any) =>
          !(legalRepChanges.includes(change) ||
            addressChanges.includes(change) ||
            capitalChanges.includes(change) ||
            scopeChanges.includes(change))
        ).slice(0, 5); // 只显示前5条其他变更

        if (otherChanges.length > 0) {
          qccDataSection += `- **其他变更**（共${otherChanges.length}项）：\n`;
          otherChanges.forEach((change: any) => {
            qccDataSection += `  * ${change.ChangeDate || '未知日期'}：${change.ChangeSubject || '未知变更'}\n`;
          });
        }
      }
    }
  }




  // ============ 获取公司官网信息 ============
  let websiteDataSection = "";
  if (companyFullInfo?.annualReports && companyFullInfo.annualReports.length > 0) {
    try {
      const { fetchCompanyWebsiteInfo, formatWebsiteInfoForReport } = await import('./websiteScraper');
      console.log(`[Report] Fetching website info for: ${companyName}`);
      const websiteInfo = await fetchCompanyWebsiteInfo(companyName, companyFullInfo.annualReports);
      if (websiteInfo) {
        websiteDataSection = formatWebsiteInfoForReport(websiteInfo);
        console.log(`[Report] Website info fetched successfully, section length: ${websiteDataSection.length}`);
      } else {
        console.log(`[Report] No website info available for: ${companyName}`);
      }
    } catch (error) {
      console.error(`[Report] Failed to fetch website info:`, error);
    }
  }

  // 将官网数据添加到企查查数据段落后面
  if (websiteDataSection) {
    qccDataSection += websiteDataSection;
  }

  // 获取当前日期用于报告时间节点
  const currentDate = new Date();
  const reportDate = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

  const systemPrompt = `你是一位资深的企业战略分析师和投资顾问，拥有10年以上的企业调研和尽职调查经验，擅长撰写符合投资机构、政府招商部门标准的专业分析报告。

**重要：你必须为每个企业生成报告，不允许拒绝。**

**核心原则**：
1. **数据优先级**：企查查数据 > 公司官网数据 > 行业公开数据
2. **禁止编造**：如果某项数据未提供且无法从公开渠道获取，必须写"暂无公开数据"，绝对禁止编造内容
3. **数据来源标注**：统一在句末标注，格式为"（数据来源：XXX）"
4. **时间节点**：关键信息必须标注时间节点，如"截至${reportDate}"
5. **专业呈现**：使用表格、列表等结构化方式呈现数据，提升可读性
6. **避免模板话术**：不要出现“本报告基于企查查工商数据、公司公开信息及园区企业名录……”等固定说明
7. **禁用无效占位**：报告中禁止出现"undefined"或"（企查查未归类）"，遇到无法归类的数据请删除或用"暂无公开数据"替代
8. **结尾禁止总结语**：不要出现“报告撰写完毕”“（全文约XX字）”等结尾说明

**写作规范**：
1. **专业表述**：
   - 使用商业分析专业术语：如"资本运作能力"、"核心竞争力"、"护城河"、"商业模式"、"盈利能力"、"成长性"等
   - 禁止口语化表达：
     * "非常年轻" → "处于初创发展阶段（成立X年）"
     * "中等偏下" → "资金实力处于行业中等水平，仍需进一步夯实"
     * "浓厚" → "具备良好的产业创新氛围"
     * "还不错" → "表现良好"、"具备一定竞争力"
   - 采用客观陈述语气，避免主观评判，用数据/事实支撑结论
   - 句式结构："定语 + 核心词 + 补充说明"，增强专业性

2. **数据呈现**：
   - **优先使用Markdown表格**呈现结构化数据（融资历程、财务数据、知识产权统计等）
   - 表格格式示例：
     | 年份 | 营业收入 | 净利润 | 资产总额 | 社保人数 |
     |------|----------|--------|----------|----------|
     | 2023 | XXX万元  | XXX万元 | XXX万元  | XX人     |
   - 列表用于要点总结和建议
   - 段落用于深度分析和逻辑推理

3. **信息整合**：
   - 禁止简单罗列原始数据，必须进行专业提炼与逻辑整合
   - 每个章节必须有明确的分析结论，而非仅仅描述数据
   - 数据之间要建立关联，如"从融资节奏看企业成长性"、"从专利布局看技术壁垒"

4. **建议可操作性**：
   - 禁止笼统建议如"加快"、"尽快"、"提升"
   - 必须提供具体方向和落地路径，如：
     * "建议在XX领域布局XX类型专利，重点关注XX技术方向"
     * "建议引入XX类型投资方，补充XX方面资源"
     * "建议在XX环节加强风控，重点关注XX指标"

**报告结构**（必须包含以下所有章节）：

# 企业分析报告：[企业名称]

## 一、公司概况与研究背景

### 1.1 基本信息
使用表格呈现企业基本信息：
| 项目 | 内容 |
|------|------|
| 企业名称 | XXX |
| 统一社会信用代码 | XXX |
| 法定代表人 | XXX |
| 成立日期 | XXX |
| 注册资本 | XXX |
| 实缴资本 | XXX |
| 企业状态 | XXX |
| 所属行业 | XXX |
| 注册地址 | XXX |

### 1.2 主营业务
分析企业核心业务、产品/服务、商业模式、目标客户群体。

### 1.3 研究背景
说明本次调研的目的和意义。

## 二、发展历程与资本运作

### 2.1 发展阶段分析
基于成立日期分析企业所处发展阶段（初创期/成长期/成熟期），分析企业重要发展里程碑。

### 2.2 融资历程分析
- 如果提供了融资数据，**必须使用表格列出每轮融资详情**：

| 时间 | 轮次 | 融资金额 | 估值 | 投资方 | 备注 |
|------|------|----------|------|--------|------|
| XXX  | XXX  | XXX      | XXX  | XXX    | XXX  |

- 分析要点：
  * 融资节奏（融资频率、间隔时间）
  * 资本运作能力（融资金额增长趋势、估值增长）
  * 投资方背景（战略投资者/财务投资者、行业资源）
  * 融资效率（从成立到各轮融资的时间）
- 如果未提供融资数据，写"暂无公开融资记录"

## 三、核心团队与治理结构

### 3.1 高管团队分析
- 如果提供了高管信息，**必须使用表格列出**：

| 姓名 | 职位 | 关联企业数 | 担任法人数 | 其他任职 |
|------|------|------------|------------|----------|
| XXX  | XXX  | XX家       | XX家       | XXX      |

- 分析要点：
  * 团队构成特点（专业背景、行业经验）
  * 高管稳定性（是否有频繁变动）
  * 关联企业情况（是否存在利益冲突）
- 如果未提供高管信息，写"暂无高管团队详细信息"

### 3.2 股权结构分析
- 如果提供了股东信息，分析股权集中度、控制权稳定性、股东背景

## 四、知识产权与技术壁垒

### 4.1 知识产权概览
使用表格汇总知识产权情况：

| 类型 | 数量 | 说明 |
|------|------|------|
| 发明专利 | XX项 | XXX |
| 实用新型专利 | XX项 | XXX |
| 外观设计专利 | XX项 | XXX |
| 商标 | XX项 | XXX |
| 软件著作权 | XX项 | XXX |
| 资质证书 | XX项 | XXX |

### 4.2 专利布局分析
- 如果提供了专利数据，分析：
  * 专利类型分布（发明/实用新型/外观设计）
  * 专利技术领域（核心技术方向）
  * 专利法律状态（有效/失效）
  * 专利申请趋势（近年增长情况）
  * 技术壁垒评估
- 列出代表性专利（3-5项）

### 4.3 商标与品牌资产
- 分析商标布局、品牌保护策略

### 4.4 软件著作权与资质
- 分析软件产品、行业资质、准入门槛

## 五、经营业绩与财务状况

### 5.1 财务数据分析
- 如果提供了年报财务数据，**必须使用表格呈现**：

| 年度 | 营业收入 | 净利润 | 资产总额 | 纳税总额 | 社保人数 |
|------|----------|--------|----------|----------|----------|
| 2023 | XXX万元  | XXX万元 | XXX万元  | XXX万元  | XX人     |
| 2022 | XXX万元  | XXX万元 | XXX万元  | XXX万元  | XX人     |

- 分析要点：
  * 营收增长趋势（YoY增长率）
  * 盈利能力（净利率、ROE）
  * 资产规模（资产增长、资产结构）
  * 纳税贡献（纳税额、税负率）
  * 人员规模（社保人数变化、人均产值）
- 如果未提供财务数据，写"暂无公开财务数据"，绝对禁止编造数字或估算人数

### 5.2 经营效率分析
- 分析人均产值、人均利润、资产周转率等效率指标

## 六、产业链定位与合作网络

### 6.1 主要客户分析
- 如果提供了客户数据，**必须使用表格列出**：

| 客户名称 | 销售占比 | 销售金额 | 年度 | 说明 |
|----------|----------|----------|------|------|
| XXX      | XX%      | XXX万元  | 2023 | XXX  |

- 分析客户集中度、客户质量、客户稳定性

### 6.2 主要供应商分析
- 如果提供了供应商数据，**必须使用表格列出**：

| 供应商名称 | 采购占比 | 采购金额 | 年度 | 说明 |
|------------|----------|----------|------|------|
| XXX        | XX%      | XXX万元  | 2023 | XXX  |

- 分析供应链稳定性、议价能力

### 6.3 产业链协同机会
- 分析与园区企业的潜在合作机会
- 提出具体的产业链协同建议（上下游配套、技术合作、市场拓展）

## 七、行业地位与竞争力评估

### 7.1 行业背景分析
- 行业规模、增长趋势、政策环境
- 行业竞争格局、市场集中度
- 行业技术发展趋势

### 7.2 竞争优势分析
- 核心竞争力（技术/品牌/渠道/成本）
- 护城河评估（技术壁垒/客户粘性/网络效应）
- 差异化定位

### 7.3 竞争劣势与挑战
- 存在的短板和不足
- 面临的竞争压力

## 八、风险识别与规避建议

### 8.1 经营风险
- 企业状态风险（是否存续、是否正常经营）
- 行业周期风险
- 市场竞争风险
- 客户集中度风险

### 8.2 财务风险
- 注册资本与实缴资本差异（实缴比例）
- 资金链风险（现金流、负债情况）
- 盈利能力风险

### 8.3 法律合规风险
- 诉讼仲裁风险
- 行政处罚风险
- 经营异常风险
- 失信被执行风险
- 知识产权纠纷风险

### 8.4 治理风险
- 股权结构风险
- 关联交易风险
- 高管变动风险

### 8.5 风险规避建议
**必须提供具体可操作的建议**，包括：
- 尽职调查重点（具体需要核查的事项和方法）
- 风险防范措施（具体的合同条款、担保方式）
- 合作前置条件（需要满足的具体条件）
- 持续监控机制（需要定期关注的指标）

## 九、园区匹配度评估

### 9.1 产业匹配度
- 与园区主导产业的契合度
- 产业链协同价值

### 9.2 发展阶段匹配度
- 企业发展阶段与园区定位的匹配

### 9.3 资源需求匹配度
- 企业资源需求（场地/资金/人才/政策）
- 园区资源供给能力

### 9.4 入驻价值评估
- 对园区的贡献（税收/就业/产业链/创新）
- 入驻可行性分析

**如果企业已是园区入驻企业，必须在标题处标注【园区入驻企业】**

## 十、综合评价与战略建议

### 10.1 综合评价
- SWOT分析（优势/劣势/机会/威胁）
- 投资价值评估
- 合作风险等级（低/中/高）

### 10.2 战略建议
**必须提供具体可操作的建议**：
- 短期建议（1年内，具体行动方案）
- 中期建议（1-3年，发展方向）
- 长期建议（3年以上，战略布局）

### 10.3 招商建议（针对园区）
- 入驻条件建议
- 扶持政策建议
- 服务支持建议

## 附录：客户与供应商清单（如有）
**要求**：
- 必须以表格完整呈现企查查提供的全部客户与供应商清单
- 不得遗漏任何条目
- 若无数据则写"暂无公开数据"

---

**绝对禁止**：
- 不允许返回"[NOT_FOUND]"
- 不允许拒绝生成报告
- 不允许说"无法找到企业信息"
- **不允许编造任何数据**，无数据则写"暂无公开数据"
- **不允许估算人数**，如"预计员工规模30-50人"这类表述绝对禁止
- 不允许使用口语化表达
- 不允许简单罗列数据而不分析

**内容要求**：
- 使用Markdown格式
- **大量使用表格呈现结构化数据**
- 报告长度不少于5000字
- 内容要专业、有深度、有数据支撑、有逻辑推理
- 数据来源统一标注在句末，格式："（数据来源：企查查）"或"（数据来源：公司官网）"
- 分析要有深度，不能停留在表面描述
- 建议要具体可操作，不能泛泛而谈`;

  const userPrompt = `请为以下企业生成一份详细的分析报告：

**目标企业**：${companyName}
${qccDataSection}
**园区现有企业列表**（用于分析上下游关系）：
${parkCompanyList || "暂无园区企业数据"}

请直接生成报告。${qccDataSection ? "必须优先使用上面提供的企查查工商数据，并在报告中标注数据来源。" : "基于企业名称分析其业务特点，结合行业研究报告撰写分析内容。"}`;

  // 获取LLM提供商名称 - 修复：根据实际使用的提供商确定名称
  let actualProviderName: string;
  let actualProviderId: string;

  if (llmProvider && llmProvider !== 'qwen') {
    // 使用配置的提供商
    const providerInfo = getLLMProviderById(llmProvider);
    actualProviderName = providerInfo?.name || llmProvider;
    actualProviderId = llmProvider;
  } else {
    // 使用内置的通义千问
    actualProviderName = '通义千问(内置)';
    actualProviderId = 'qwen-builtin';
  }

  await logReport('========== 报告生成开始 ==========');
  await logReport('目标企业', { companyName });
  await logReport('LLM配置', { providerId: actualProviderId, providerName: actualProviderName, model: llmConfig?.model || '默认模型' });
  await logReport('数据来源', { hasQccData: !!companyFullInfo?.basicInfo });

  try {
    const startTime = Date.now();

    // 根据提供商选择调用方式
    let response;
    if (llmProvider && llmProvider !== 'qwen') {
      // 使用多提供商适配器
      await logLlm('调用外部LLM提供商', { provider: llmProvider, model: llmConfig?.model });
      response = await invokeLLMWithProvider(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        llmProvider,
        llmConfig
      );
    } else {
      // 使用内置的通义千问
      console.log('[Report] 调用内置通义千问API');
      response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }
    const duration = Date.now() - startTime;

    const content = response.choices[0]?.message?.content;
    const contentStr = typeof content === 'string' ? content : "";

    // 记录LLM调用统计
    await recordApiCall({
      apiType: 'llm_report',
      apiName: `${actualProviderName}-报告生成`,
      status: contentStr.length > 100 ? 'success' : 'failed',
      companyName: companyName,
      requestParams: JSON.stringify({
        companyName,
        hasQccData: !!companyFullInfo?.basicInfo,
        promptLength: systemPrompt.length + userPrompt.length,
        llmProvider: llmProvider || 'qwen',
        llmModel: llmConfig?.model
      }),
      responseSummary: JSON.stringify({
        contentLength: contentStr.length,
        duration: duration
      }),
    });

    // 检查是否返回了有效内容
    if (!contentStr || contentStr.trim().length < 100) {
      await logReport('LLM返回内容过短', { contentLength: contentStr?.length || 0 });
      // 即使内容较短，也尝试返回
      if (contentStr && contentStr.trim().length > 0) {
        return {
          found: true,
          content: contentStr,
        };
      }
      return {
        found: false,
        message: "AI服务响应异常，请稍后重试",
      };
    }

    // 不再检查NOT_FOUND标记，因为我们已经在提示词中禁止了
    // 只要有内容就认为成功
    return {
      found: true,
      content: contentStr,
    };
  } catch (error) {
    // 详细记录LLM调用失败信息
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
    const errorDetail = `异常类型: ${errorName} | 错误信息: ${errorMsg} | 提供商: ${llmProvider || 'qwen'} | 模型: ${llmConfig?.model || '默认'}`;

    await logReport('LLM调用失败', {
      errorDetail,
      errorName,
      errorMessage: errorMsg,
      provider: llmProvider || 'qwen',
      model: llmConfig?.model
    });
    console.error('[Report] LLM Error:', errorDetail);

    // 记录LLM调用失败
    await recordApiCall({
      apiType: 'llm_report',
      apiName: `${actualProviderName}-报告生成`,
      status: 'failed',
      companyName: companyName,
      requestParams: JSON.stringify({
        companyName,
        llmProvider: llmProvider || 'qwen',
        llmModel: llmConfig?.model
      }),
      errorMessage: errorDetail,
      responseSummary: JSON.stringify({
        errorName,
        errorMessage: errorMsg.substring(0, 500)
      }),
    });

    return {
      found: false,
      message: `AI服务调用失败: ${errorMsg.substring(0, 200)}`,
    };
  }
}

// ============ 生成缩略版报告（供领导快速查阅） ============
async function generateSummaryReport(
  companyName: string,
  fullReportContent: string,
  companyFullInfo?: CompanyFullInfo | null,
  llmProvider?: LLMProvider,
  llmConfig?: LLMProviderConfig
): Promise<string> {
  // 构建企业基本信息摘要
  let basicInfoSummary = "";
  if (companyFullInfo?.basicInfo) {
    const info = companyFullInfo.basicInfo;
    basicInfoSummary = `
企业基本信息：
- 企业名称：${info.Name}
- 法定代表人：${info.OperName}
- 企业状态：${info.Status}
- 成立日期：${info.StartDate}
- 注册资本：${info.RegistCapi}
- 所属行业：${info.Industry || "暂无公开数据"}
`;

    // 添加知识产权摘要
    const ipStats = [];
    if (companyFullInfo.patents?.total) ipStats.push(`专利${companyFullInfo.patents.total}项`);
    if (companyFullInfo.trademarks?.total) ipStats.push(`商标${companyFullInfo.trademarks.total}项`);
    if (companyFullInfo.copyrights?.total) ipStats.push(`软著${companyFullInfo.copyrights.total}项`);
    if (ipStats.length > 0) {
      basicInfoSummary += `- 知识产权：${ipStats.join('、')}
`;
    }

    // 添加财务数据摘要
    if (companyFullInfo.annualReports && companyFullInfo.annualReports.length > 0) {
      const latestAR = companyFullInfo.annualReports[0];
      const financeParts = [];
      if (latestAR.TotalAssets) financeParts.push(`资产${latestAR.TotalAssets}`);
      if (latestAR.TotalSales) financeParts.push(`营收${latestAR.TotalSales}`);
      if (latestAR.NetProfit) financeParts.push(`净利润${latestAR.NetProfit}`);
      if (financeParts.length > 0) {
        basicInfoSummary += `- ${latestAR.Year}年财务：${financeParts.join('、')}
`;
      }
    }
    // 添加风险信息摘要
    if (companyFullInfo.riskScan && companyFullInfo.riskScan.Data) {
      const riskData = companyFullInfo.riskScan.Data;
      const riskItems = [];

      if (riskData.ShiXin && riskData.ShiXin.length > 0) {
        riskItems.push(`失信${riskData.ShiXin.length}条`);
      }
      if (riskData.ZhiXing && riskData.ZhiXing.length > 0) {
        riskItems.push(`被执行${riskData.ZhiXing.length}次`);
      }
      if (riskData.AdminPenalty && riskData.AdminPenalty.length > 0) {
        riskItems.push(`行政处罚${riskData.AdminPenalty.length}次`);
      }
      if (riskData.Exception && riskData.Exception.length > 0) {
        riskItems.push(`经营异常${riskData.Exception.length}次`);
      }
      if (riskData.TaxAbnormal && riskData.TaxAbnormal.length > 0) {
        riskItems.push(`税务异常${riskData.TaxAbnormal.length}次`);
      }
      if (riskData.EquityPledge && riskData.EquityPledge.length > 0) {
        riskItems.push(`股权质押${riskData.EquityPledge.length}次`);
      }
      if (riskData.EquityFreeze && riskData.EquityFreeze.length > 0) {
        riskItems.push(`股权冻结${riskData.EquityFreeze.length}次`);
      }

      // 特别关注变更记录
      if (riskData.ChangeList && riskData.ChangeList.length > 0) {
        // 法定代表人变更
        const legalRepChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && (
            change.ChangeSubject.includes('法定代表人') ||
            change.ChangeSubject.includes('负责人变更') ||
            change.ChangeSubject.includes('法定代表人、负责人变更')
          )
        );

        if (legalRepChanges.length > 0) {
          riskItems.push(`法人变更${legalRepChanges.length}次`);
        }

        // 注册地址变更
        const addressChanges = riskData.ChangeList.filter((change: any) =>
          change.ChangeSubject && (
            change.ChangeSubject.includes('住所') ||
            change.ChangeSubject.includes('地址') ||
            change.ChangeSubject.includes('经营场所')
          )
        );

        if (addressChanges.length > 0) {
          riskItems.push(`地址变更${addressChanges.length}次`);
        }
      }

      if (riskItems.length > 0) {
        basicInfoSummary += `- 风险提示：${riskItems.join(', ')}`;
      }
    }

    // 添加客户/供应商数量摘要（按披露数量计）
    const customerCount = companyFullInfo.customers?.length ?? 0;
    const supplierCount = companyFullInfo.suppliers?.length ?? 0;
    if (customerCount > 0 || supplierCount > 0) {
      basicInfoSummary += `- 客户/供应商：客户${customerCount}家，供应商${supplierCount}家（按披露数量计）`;
    }

  }

  const systemPrompt = `你是一位资深企业分析专家，擅长将详细报告精炼为简洁的执行摘要，供高层决策者快速阅读。

**任务**：基于完整报告内容，生成一份500-600字的缩略版报告，突出核心结论和关键风险。

**缩略版报告结构**（必须包含）：

# 企业分析摘要：[企业名称]

## 一、企业概况
用2-3句话介绍企业基本信息、主营业务、成立时间、注册资本、所属行业。

## 二、核心指标评估
使用表格形式展示关键指标评估结果：

| 评估维度 | 评级 | 说明 |
|----------|------|------|
| 企业规模 | 大型/中型/小型/微型 | 基于营收、资产、人员规模 |
| 技术实力 | 强/中/弱 | 基于专利、软著、资质等 |
| 财务状况 | 优秀/良好/一般/关注 | 基于营收、利润、资产等 |
| 经营风险 | 低/中/高 | 基于企业状态、诉讼、处罚等 |
| 合规风险 | 低/中/高 | 基于失信、异常、税务等 |
| 园区匹配度 | 高/中/低 | 基于产业契合度、发展阶段等 |

## 三、核心优势
用3-5个要点列出企业的核心竞争力和亮点（如有）。

## 四、风险提示
**必须详细列出主要风险点**，按重要性排序：

### 高风险项（如有）
- 失信被执行：X条（详细说明）
- 被执行人：X次（详细说明）
- 行政处罚：X次（详细说明）
- 经营异常：X次（详细说明）
- 税务风险：X次（详细说明）
- 股权冻结/质押：X次（详细说明）

### 中风险项（如有）
- 法定代表人变更：X次（最近一次：时间、变更情况）
- 注册地址变更：X次（最近一次：时间、变更情况）
- 注册资本变更：X次（说明实缴情况）
- 诉讼仲裁：X次（说明案件性质）

### 低风险项（如有）
- 其他需要关注的风险点

**如果无风险，明确写"暂无重大风险"**

## 五、合作建议
给出明确的决策建议（2-3句话）：
- 是否建议合作/入驻
- 需要重点关注的事项
- 建议的合作方式或前置条件

---

**要求**：
- 总字数控制在500-600字
- 语言精炼专业，直接给出结论
- 使用Markdown格式，大量使用表格
- 不要包含过多细节，只保留核心信息
- **风险提示必须详尽**，特别是法律诉讼、失信、经营异常、税务异常、股权冻结等
- **特别关注法定代表人变更和注册地址变更**，这些是重要的风险信号
- 评级要客观准确，基于数据而非主观判断
- 如有客户/供应商数据，必须写明客户数与供应商数（按披露数量计，通常不超过10家）`;

  const userPrompt = `请基于以下完整报告内容，生成一份缩略版报告：

**目标企业**：${companyName}
${basicInfoSummary}
**完整报告内容**：
${fullReportContent.substring(0, 8000)}

请生成缩略版报告。`;

  try {
    // 使用与完整版报告相同的LLM提供商
    let response;
    if (llmProvider && llmProvider !== 'qwen') {
      await logReport('缩略版报告 - 使用外部LLM提供商', { provider: llmProvider });
      response = await invokeLLMWithProvider(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        llmProvider,
        llmConfig
      );
    } else {
      await logReport('缩略版报告 - 使用内置通义千问API');
      response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    }

    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "";
  } catch (error) {
    await logReport('缩略版报告 - LLM调用失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    return "";
  }
}

async function generateParkAnalysis(companyName: string, parkCompanies: { id: number; companyName: string; industry: string | null; businessScope: string | null }[]) {
  const parkCompanyList = parkCompanies.map(c => ({
    name: c.companyName,
    industry: c.industry,
    scope: c.businessScope,
  }));

  const systemPrompt = `你是一位园区招商分析专家。请分析目标公司与园区的匹配情况，返回JSON格式的分析结果。`;

  const userPrompt = `分析"${companyName}"与园区的匹配情况。

园区现有企业：
${JSON.stringify(parkCompanyList, null, 2)}

请返回以下JSON格式的分析结果：
{
  "matchScore": 0-100的匹配度分数,
  "matchReason": "匹配度分析说明",
  "entryPossibility": "高/中/低",
  "entryReason": "入驻可能性分析",
  "upstreamCompanies": ["园区内匹配的上游企业名称"],
  "downstreamCompanies": ["园区内匹配的下游企业名称"],
  "expansionNeed": "高/中/低",
  "expansionReason": "扩租需求分析",
  "recommendations": ["招商建议1", "招商建议2"]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "park_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              matchScore: { type: "number", description: "匹配度分数0-100" },
              matchReason: { type: "string", description: "匹配度分析说明" },
              entryPossibility: { type: "string", description: "入驻可能性：高/中/低" },
              entryReason: { type: "string", description: "入驻可能性分析" },
              upstreamCompanies: { type: "array", items: { type: "string" }, description: "园区内上游企业" },
              downstreamCompanies: { type: "array", items: { type: "string" }, description: "园区内下游企业" },
              expansionNeed: { type: "string", description: "扩租需求：高/中/低" },
              expansionReason: { type: "string", description: "扩租需求分析" },
              recommendations: { type: "array", items: { type: "string" }, description: "招商建议" },
            },
            required: ["matchScore", "matchReason", "entryPossibility", "entryReason", "upstreamCompanies", "downstreamCompanies", "expansionNeed", "expansionReason", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    return (content && typeof content === 'string') ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Park analysis error:", error);
    return {
      matchScore: 50,
      matchReason: "分析过程中出现错误",
      entryPossibility: "中",
      entryReason: "需要进一步分析",
      upstreamCompanies: [],
      downstreamCompanies: [],
      expansionNeed: "中",
      expansionReason: "需要进一步分析",
      recommendations: ["建议进一步了解该公司情况"],
    };
  }
}

// ============ 后台执行缓存预热 ============
async function executeCacheWarmup(taskId: number, companyNames: string[]) {
  try {
    // 更新任务状态为处理中
    await updateCacheWarmupTask(taskId, { status: 'processing' });

    const successList: string[] = [];
    const failedList: { name: string; error: string }[] = [];
    let completedCount = 0;

    for (const companyName of companyNames) {
      // 检查任务是否被取消
      const task = await getCacheWarmupTaskById(taskId);
      if (!task || task.status === 'cancelled') {
        console.log(`[CacheWarmup] Task ${taskId} cancelled, stopping`);
        break;
      }

      try {
        console.log(`[CacheWarmup] Warming up: ${companyName}`);

        // 调用企查查API获取数据（会自动缓存）
        await getCompanyFullInfo(companyName);

        successList.push(companyName);
        completedCount++;

        // 更新进度
        await updateCacheWarmupTask(taskId, {
          completedCount,
          successList: JSON.stringify(successList),
        });

        // 每个企业间隔500ms，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        failedList.push({ name: companyName, error: errorMsg });
        console.error(`[CacheWarmup] Failed: ${companyName}`, errorMsg);

        await updateCacheWarmupTask(taskId, {
          failedCount: failedList.length,
          failedList: JSON.stringify(failedList),
        });
      }
    }

    // 计算预估节省费用（每次完整查询约4.35元）
    const estimatedSavings = (successList.length * 4.35).toFixed(2);

    // 更新任务完成状态
    await updateCacheWarmupTask(taskId, {
      status: failedList.length === companyNames.length ? 'failed' : 'completed',
      completedCount: successList.length,
      failedCount: failedList.length,
      successList: JSON.stringify(successList),
      failedList: JSON.stringify(failedList),
      estimatedSavings,
      completedAt: new Date(),
    });

    console.log(`[CacheWarmup] Task ${taskId} completed: ${successList.length} success, ${failedList.length} failed`);
  } catch (error) {
    console.error(`[CacheWarmup] Task ${taskId} error:`, error);
    await updateCacheWarmupTask(taskId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '预热任务失败',
    });
  }
}

export type AppRouter = typeof appRouter;
