/**
 * 数据库操作模块
 * 
 * 功能说明：
 * - 提供所有数据库表的增删改查操作
 * - 使用Drizzle ORM进行数据库操作
 * - 支持MySQL/TiDB数据库
 * 
 * 包含的数据表：
 * - users: 用户表
 * - parkCompanies: 园区企业表
 * - companyReports: 企业报告表
 * - batchTasks: 批量任务表
 * - dataSourceConfig: 数据源配置表
 * - companyCache: 企业信息缓存表
 * - companySearchCache: 搜索结果缓存表
 * - apiCallStats: API调用统计表
 */

// 引入Drizzle ORM的查询操作符
// eq: 等于, desc: 降序, like: 模糊匹配, and: 与, gte: 大于等于, lte: 小于等于, inArray: 在数组中
import { eq, desc, like, and, gte, lte, inArray, count } from "drizzle-orm";

// 引入Drizzle的MySQL驱动
import { drizzle } from "drizzle-orm/mysql2";

// 引入数据库表结构定义和类型
import {
  InsertUser, users,                                    // 用户表
  parkCompanies, InsertParkCompany, ParkCompany,        // 园区企业表
  companyReports, InsertCompanyReport, CompanyReport,   // 企业报告表
  dataSourceConfig, InsertDataSourceConfig, DataSourceConfig, // 数据源配置表
  batchTasks, InsertBatchTask, BatchTask,               // 批量任务表
  companyCache, InsertCompanyCache, CompanyCache,       // 企业缓存表
  companySearchCache, InsertCompanySearchCache, CompanySearchCache, // 搜索缓存表
  apiCallStats, InsertApiCallStat, ApiCallStat,         // API调用统计表
  qichachaApiConfig, InsertQichachaApiConfig, QichachaApiConfig, // 企查查API配置表
  llmConfigs, InsertLlmConfig, LlmConfig,               // 系统级LLM配置表
  loginLogs, InsertLoginLog, LoginLog                   // 登录日志表
} from "../drizzle/schema";

// 引入环境变量配置
import { ENV } from './_core/env';

// 引入加密解密工具
import { encrypt, decrypt, maskApiKey } from './encryption';

// 数据库连接实例（单例模式，全局只创建一个连接）
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * 获取数据库连接
 * 使用单例模式，确保整个应用只有一个数据库连接
 * 
 * @returns 数据库连接实例，如果连接失败则返回null
 */
export async function getDb() {
  // 如果还没有创建连接，且配置了数据库URL
  if (!_db && process.env.DATABASE_URL) {
    try {
      // 创建数据库连接
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      // 连接失败，打印警告信息
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================
// 用户相关函数
// ============================================================

/**
 * 创建或更新用户
 * 如果用户已存在则更新，不存在则创建
 * 
 * @param user 用户信息对象
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  // 检查必填字段
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // 准备插入的数据
    const values: InsertUser = {
      openId: user.openId,
    };
    // 准备更新的数据（用于已存在的用户）
    const updateSet: Record<string, unknown> = {};

    // 定义可选的文本字段
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    // 处理可选字段的赋值
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    // 遍历处理所有文本字段
    textFields.forEach(assignNullable);

    // 处理最后登录时间
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    // 处理用户角色
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // 如果是项目所有者，自动设置为管理员
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    // 如果没有设置登录时间，使用当前时间
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // 如果没有任何更新字段，至少更新登录时间
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // 执行插入或更新操作
    // onDuplicateKeyUpdate: 如果主键冲突（用户已存在），则执行更新
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

/**
 * 根据OpenID获取用户信息
 * 
 * @param openId 用户的OpenID（唯一标识）
 * @returns 用户信息，如果不存在则返回undefined
 */
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  // 查询用户，限制返回1条
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// 园区企业相关函数
// ============================================================

/**
 * 创建单个园区企业
 * 
 * @param data 企业信息
 * @returns 新创建的企业ID
 */
export async function createParkCompany(data: InsertParkCompany) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(parkCompanies).values(data);
  return result[0].insertId; // 返回自增ID
}

/**
 * 批量创建园区企业
 * 用于Excel导入功能
 * 
 * @param dataList 企业信息数组
 * @returns 成功创建的企业数量
 */
export async function createParkCompanies(dataList: InsertParkCompany[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 如果没有数据，直接返回0
  if (dataList.length === 0) return 0;

  // 批量插入
  const result = await db.insert(parkCompanies).values(dataList);
  return dataList.length;
}

/**
 * 获取园区企业列表（分页）
 * 
 * @param limit 每页数量，默认100
 * @param offset 偏移量，默认0
 * @returns 企业列表
 */
export async function getParkCompanies(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 按创建时间倒序排列
  return db.select().from(parkCompanies).orderBy(desc(parkCompanies.createdAt)).limit(limit).offset(offset);
}

/**
 * 根据ID获取单个园区企业
 * 
 * @param id 企业ID
 * @returns 企业信息，不存在则返回null
 */
export async function getParkCompanyById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(parkCompanies).where(eq(parkCompanies.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * 搜索园区企业
 * 根据企业名称进行模糊搜索
 * 
 * @param keyword 搜索关键词
 * @returns 匹配的企业列表（最多50条）
 */
export async function searchParkCompanies(keyword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 使用LIKE进行模糊匹配
  return db.select().from(parkCompanies)
    .where(like(parkCompanies.companyName, `%${keyword}%`))
    .orderBy(desc(parkCompanies.createdAt))
    .limit(50);
}

/**
 * 更新园区企业信息
 * 
 * @param id 企业ID
 * @param data 要更新的字段
 */
export async function updateParkCompany(id: number, data: Partial<InsertParkCompany>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(parkCompanies).set(data).where(eq(parkCompanies.id, id));
}

/**
 * 删除园区企业
 * 
 * @param id 企业ID
 */
export async function deleteParkCompany(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(parkCompanies).where(eq(parkCompanies.id, id));
}

/**
 * 获取园区企业总数
 * 
 * @returns 企业总数
 */
export async function getParkCompaniesCount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(parkCompanies);
  return result.length;
}

/**
 * 获取所有园区企业名称和关键信息
 * 用于报告生成时的上下游企业匹配
 * 
 * @returns 企业名称和关键信息列表
 */
export async function getAllParkCompanyNames() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 只查询需要的字段，提高查询效率
  const result = await db.select({
    id: parkCompanies.id,
    companyName: parkCompanies.companyName,
    industry: parkCompanies.industry,
    businessScope: parkCompanies.businessScope,
    // 以下字段用于上下游分析
    creditCode: parkCompanies.creditCode,      // 统一社会信用代码
    legalPerson: parkCompanies.legalPerson,    // 法定代表人
    companyStatus: parkCompanies.companyStatus, // 企业状态
    companyScale: parkCompanies.companyScale,   // 企业规模
    registeredCapital: parkCompanies.registeredCapital, // 注册资本
    address: parkCompanies.address,             // 地址
    tags: parkCompanies.tags,                   // 标签
  }).from(parkCompanies);
  return result;
}

// ============================================================
// 企业报告相关函数
// ============================================================

/**
 * 创建企业报告
 * 
 * @param data 报告信息
 * @returns 新创建的报告ID
 */
export async function createCompanyReport(data: InsertCompanyReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(companyReports).values(data);
  return result[0].insertId;
}

/**
 * 获取企业报告列表（分页）
 * 
 * @param limit 每页数量，默认50
 * @param offset 偏移量，默认0
 * @returns 报告列表
 */
export async function getCompanyReports(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(companyReports).orderBy(desc(companyReports.createdAt)).limit(limit).offset(offset);
}

/**
 * 根据ID获取单个报告
 * 
 * @param id 报告ID
 * @returns 报告信息，不存在则返回null
 */
export async function getCompanyReportById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(companyReports).where(eq(companyReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * 更新企业报告
 * 
 * @param id 报告ID
 * @param data 要更新的字段
 */
export async function updateCompanyReport(id: number, data: Partial<InsertCompanyReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(companyReports).set(data).where(eq(companyReports.id, id));
}

/**
 * 删除企业报告
 * 
 * @param id 报告ID
 */
export async function deleteCompanyReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(companyReports).where(eq(companyReports.id, id));
}

// ============================================================
// 批量任务相关函数
// ============================================================

/**
 * 创建批量任务
 * 
 * @param data 任务信息
 * @returns 新创建的任务ID
 */
export async function createBatchTask(data: InsertBatchTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(batchTasks).values(data);
  return result[0].insertId;
}

/**
 * 获取批量任务列表（分页）
 * 
 * @param limit 每页数量，默认20
 * @param offset 偏移量，默认0
 * @returns 任务列表
 */
export async function getBatchTasks(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(batchTasks).orderBy(desc(batchTasks.createdAt)).limit(limit).offset(offset);
}

/**
 * 根据ID获取单个批量任务
 * 
 * @param id 任务ID
 * @returns 任务信息，不存在则返回null
 */
export async function getBatchTaskById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(batchTasks).where(eq(batchTasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * 更新批量任务
 * 
 * @param id 任务ID
 * @param data 要更新的字段
 */
export async function updateBatchTask(id: number, data: Partial<InsertBatchTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(batchTasks).set(data).where(eq(batchTasks.id, id));
}

/**
 * 获取批量任务关联的所有报告
 * 
 * @param batchTaskId 批量任务ID
 * @returns 关联的报告列表
 */
export async function getBatchTaskReports(batchTaskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(companyReports)
    .where(eq(companyReports.batchTaskId, batchTaskId))
    .orderBy(desc(companyReports.createdAt));
}

/**
 * 删除批量任务
 * 会同时删除关联的所有报告
 * 
 * @param id 任务ID
 */
export async function deleteBatchTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 先删除关联的报告记录
  await db.delete(companyReports).where(eq(companyReports.batchTaskId, id));
  // 再删除批量任务
  await db.delete(batchTasks).where(eq(batchTasks.id, id));
}

// ============================================================
// 数据源配置相关函数
// ============================================================

/**
 * 获取所有数据源配置
 * 
 * @returns 数据源配置列表
 */
export async function getDataSourceConfigs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(dataSourceConfig);
}

/**
 * 获取当前启用的数据源
 * 
 * @returns 启用的数据源配置，不存在则返回null
 */
export async function getActiveDataSource() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(dataSourceConfig).where(eq(dataSourceConfig.isEnabled, true)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * 创建或更新数据源配置
 * 
 * @param data 数据源配置信息
 */
export async function upsertDataSourceConfig(data: InsertDataSourceConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(dataSourceConfig).values(data).onDuplicateKeyUpdate({
    set: {
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      baseUrl: data.baseUrl,
      isEnabled: data.isEnabled,
    },
  });
}

/**
 * 设置启用的数据源
 * 会禁用其他数据源，只启用指定的数据源
 * 
 * @param sourceType 数据源类型：web/tianyancha/qichacha
 */
export async function setActiveDataSource(sourceType: "web" | "tianyancha" | "qichacha") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 先禁用所有数据源
  await db.update(dataSourceConfig).set({ isEnabled: false });

  // 检查指定的数据源是否存在
  const existing = await db.select().from(dataSourceConfig).where(eq(dataSourceConfig.sourceType, sourceType)).limit(1);

  if (existing.length === 0) {
    // 如果不存在，则创建新记录
    await db.insert(dataSourceConfig).values({
      sourceType,
      isEnabled: true,
    });
  } else {
    // 如果存在，则启用它
    await db.update(dataSourceConfig).set({ isEnabled: true }).where(eq(dataSourceConfig.sourceType, sourceType));
  }
}

// ============================================================
// 企业缓存相关函数
// ============================================================

/**
 * 获取缓存有效期（天数）
 * 从环境变量读取，默认30天
 * 
 * @returns 缓存有效天数
 */
export function getCacheDays(): number {
  const days = parseInt(process.env.COMPANY_CACHE_DAYS || '30', 10);
  return isNaN(days) || days < 1 ? 30 : days;
}

/**
 * 根据关键词获取缓存的搜索结果
 * 用于避免重复调用企查查API
 * 
 * @param keyword 搜索关键词
 * @returns 缓存的企业列表，如果缓存不存在或过期则返回null
 */
export async function getCachedSearchResults(keyword: string): Promise<CompanyCache[] | null> {
  const db = await getDb();
  if (!db) return null;

  // 计算缓存过期时间
  const cacheDays = getCacheDays();
  const cacheExpiry = new Date();
  cacheExpiry.setDate(cacheExpiry.getDate() - cacheDays);

  // 查找关键词缓存
  const searchCacheResult = await db.select()
    .from(companySearchCache)
    .where(
      and(
        eq(companySearchCache.keyword, keyword),
        gte(companySearchCache.cachedAt, cacheExpiry) // 缓存时间必须在过期时间之后
      )
    )
    .limit(1);

  if (searchCacheResult.length === 0) {
    return null; // 缓存不存在或已过期
  }

  // 解析信用代码列表（JSON格式存储）
  const creditCodes: string[] = JSON.parse(searchCacheResult[0].creditCodes);
  if (creditCodes.length === 0) {
    return []; // 缓存了空结果
  }

  // 根据信用代码查询企业详情
  const companies = await db.select()
    .from(companyCache)
    .where(inArray(companyCache.creditCode, creditCodes));

  return companies;
}

/**
 * 保存搜索结果到缓存
 * 
 * @param keyword 搜索关键词
 * @param companies 企业列表
 */
export async function saveSearchResultsToCache(
  keyword: string,
  companies: InsertCompanyCache[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 保存每个企业的详细信息
  for (const company of companies) {
    if (!company.creditCode) continue; // 跳过没有信用代码的企业

    try {
      // 使用upsert：存在则更新，不存在则插入
      await db.insert(companyCache).values(company).onDuplicateKeyUpdate({
        set: {
          companyName: company.companyName,
          legalPerson: company.legalPerson,
          status: company.status,
          establishDate: company.establishDate,
          registeredCapital: company.registeredCapital,
          address: company.address,
          businessScope: company.businessScope,
          dataSource: company.dataSource,
          cachedAt: new Date(), // 更新缓存时间
        },
      });
    } catch (error) {
      console.error(`[Cache] Failed to save company ${company.companyName}:`, error);
    }
  }

  // 保存关键词与企业的关联关系
  const creditCodes = companies
    .map(c => c.creditCode)
    .filter((code): code is string => !!code); // 过滤掉空值

  try {
    // 先删除旧的关键词缓存
    await db.delete(companySearchCache).where(eq(companySearchCache.keyword, keyword));
    // 插入新的关键词缓存
    await db.insert(companySearchCache).values({
      keyword,
      creditCodes: JSON.stringify(creditCodes), // 将数组转为JSON字符串存储
    });
  } catch (error) {
    console.error(`[Cache] Failed to save search cache for keyword ${keyword}:`, error);
  }
}

/**
 * 根据企业名称模糊搜索缓存
 * 
 * @param keyword 搜索关键词
 * @returns 匹配的企业列表（最多10条）
 */
export async function searchCompanyCache(keyword: string): Promise<CompanyCache[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(companyCache)
    .where(like(companyCache.companyName, `%${keyword}%`))
    .limit(10);
}

/**
 * 根据信用代码获取缓存的企业信息
 * 
 * @param creditCode 统一社会信用代码
 * @returns 企业信息，不存在则返回null
 */
export async function getCachedCompanyByCreditCode(creditCode: string): Promise<CompanyCache | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(companyCache)
    .where(eq(companyCache.creditCode, creditCode))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 获取缓存统计信息
 * 
 * @returns 缓存的企业数量和关键词数量
 */
export async function getCacheStats() {
  const db = await getDb();
  if (!db) return { totalCompanies: 0, totalKeywords: 0 };

  const companies = await db.select().from(companyCache);
  const keywords = await db.select().from(companySearchCache);

  return {
    totalCompanies: companies.length,
    totalKeywords: keywords.length,
  };
}

// ============================================================
// API调用统计相关函数
// ============================================================

/**
 * 记录API调用
 * 用于统计企查查和LLM的调用次数和费用
 * 
 * @param data API调用信息
 */
export async function recordApiCall(data: {
  apiType: string;       // API类型：qichacha/llm
  apiName: string;       // API名称：企业搜索/报告生成等
  status: "success" | "failed"; // 调用状态
  cost?: string;         // 费用（元）
  companyName?: string;  // 关联的企业名称
  reportId?: number;     // 关联的报告ID
  requestParams?: string; // 请求参数（JSON）
  responseSummary?: string; // 响应摘要
  errorMessage?: string; // 错误信息
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(apiCallStats).values({
      apiType: data.apiType,
      apiName: data.apiName,
      status: data.status,
      cost: data.cost,
      companyName: data.companyName,
      reportId: data.reportId,
      requestParams: data.requestParams,
      responseSummary: data.responseSummary,
      errorMessage: data.errorMessage,
    });
    // 日志记录（延迟导入避免循环引用）
    const { logDb } = await import("./logger");
    await logDb(`记录API调用`, { apiType: data.apiType, apiName: data.apiName, status: data.status, cost: data.cost, companyName: data.companyName });
  } catch (error) {
    console.error("[ApiStats] Failed to record API call:", error);
  }
}

/**
 * 获取API调用统计
 * 支持按时间范围和API类型过滤
 * 
 * @param options 过滤选项
 * @returns 统计结果
 */
export async function getApiCallStats(options?: {
  startDate?: Date;  // 开始时间
  endDate?: Date;    // 结束时间
  apiType?: string;  // API类型
}) {
  const db = await getDb();
  if (!db) return { total: 0, success: 0, failed: 0, totalCost: 0, byType: [] };

  let query = db.select().from(apiCallStats);

  // 构建过滤条件
  const conditions = [];
  if (options?.startDate) {
    conditions.push(gte(apiCallStats.calledAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(apiCallStats.calledAt, options.endDate));
  }
  if (options?.apiType) {
    conditions.push(eq(apiCallStats.apiType, options.apiType));
  }

  // 应用过滤条件
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query;

  // 计算统计数据
  const total = results.length;                                    // 总调用次数
  const success = results.filter(r => r.status === "success").length; // 成功次数
  const failed = results.filter(r => r.status === "failed").length;   // 失败次数
  // 计算总费用
  const totalCost = results.reduce((sum, r) => sum + (parseFloat(r.cost || "0") || 0), 0);

  // 按API类型分组统计
  const typeMap = new Map<string, { count: number; success: number; failed: number; cost: number; name: string }>();
  for (const r of results) {
    const existing = typeMap.get(r.apiType) || { count: 0, success: 0, failed: 0, cost: 0, name: r.apiName };
    existing.count++;
    if (r.status === "success") existing.success++;
    else existing.failed++;
    existing.cost += parseFloat(r.cost || "0") || 0;
    typeMap.set(r.apiType, existing);
  }

  // 转换为数组格式
  const byType = Array.from(typeMap.entries()).map(([type, stats]) => ({
    apiType: type,
    apiName: stats.name,
    count: stats.count,
    success: stats.success,
    failed: stats.failed,
    cost: stats.cost.toFixed(2),
  }));

  return {
    total,
    success,
    failed,
    totalCost: totalCost.toFixed(2),
    byType,
  };
}

/**
 * 获取最近的API调用记录
 * 
 * @param limit 返回数量，默认50条
 * @returns API调用记录列表
 */
export async function getRecentApiCalls(limit: number = 50): Promise<ApiCallStat[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(apiCallStats)
    .orderBy(desc(apiCallStats.calledAt))
    .limit(limit);
}

/**
 * 获取今日API调用统计
 * 
 * @returns 今日统计结果
 */
export async function getTodayApiStats() {
  // 获取今天0点的时间
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return getApiCallStats({ startDate: today });
}

/**
 * 获取本月API调用统计
 * 
 * @param year 年份，默认当前年
 * @param month 月份，默认当前月
 * @returns 月度统计结果
 */
export async function getMonthlyApiStats(year?: number, month?: number) {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;

  // 计算月初时间
  const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  // 计算月末时间
  const lastDayOfMonth = new Date(targetYear, targetMonth, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  return getApiCallStats({ startDate: firstDayOfMonth, endDate: lastDayOfMonth });
}


// ============================================================
// 企查查完整数据缓存相关函数
// ============================================================

// 引入新增的表结构
import {
  qichachaFullDataCache,
  InsertQichachaFullDataCache,
  QichachaFullDataCache,
  systemConfig,
  InsertSystemConfig,
  SystemConfig
} from "../drizzle/schema";

/**
 * 获取企查查完整数据缓存
 * 根据统一社会信用代码查询缓存
 * 
 * @param creditCode 统一社会信用代码
 * @returns 缓存数据，不存在则返回null
 */
export async function getQichachaFullDataCache(creditCode: string): Promise<QichachaFullDataCache | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(qichachaFullDataCache)
    .where(eq(qichachaFullDataCache.creditCode, creditCode))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 保存企查查完整数据缓存
 * 如果已存在则更新，不存在则创建
 * 
 * @param data 缓存数据
 */
export async function saveQichachaFullDataCache(data: InsertQichachaFullDataCache): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 使用 upsert 模式：存在则更新，不存在则插入
  await db.insert(qichachaFullDataCache)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        companyName: data.companyName,
        basicInfo: data.basicInfo,
        shareholders: data.shareholders,
        executives: data.executives,
        executiveDetails: data.executiveDetails,
        patents: data.patents,
        trademarks: data.trademarks,
        copyrights: data.copyrights,
        customers: data.customers,
        suppliers: data.suppliers,
        annualReports: data.annualReports,
        certificates: data.certificates,
        equityThrough: data.equityThrough,
        investmentThrough: data.investmentThrough,
        financings: data.financings,
        cachedAt: new Date(), // 更新缓存时间
      },
    });
}

/**
 * 更新缓存命中次数
 * 每次从缓存读取数据时调用
 * 
 * @param creditCode 统一社会信用代码
 */
export async function updateCacheHitCount(creditCode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // 获取当前记录
  const current = await getQichachaFullDataCache(creditCode);
  if (!current) return;

  // 更新命中次数和最后命中时间
  await db.update(qichachaFullDataCache)
    .set({
      hitCount: (current.hitCount || 0) + 1,
      lastHitAt: new Date(),
    })
    .where(eq(qichachaFullDataCache.creditCode, creditCode));
}

/**
 * 检查缓存是否有效（未过期）
 * 
 * @param cache 缓存记录
 * @param cacheDays 缓存有效天数
 * @returns 是否有效
 */
export function isCacheValid(cache: QichachaFullDataCache, cacheDays: number): boolean {
  if (!cache.cachedAt) return false;

  const cachedTime = new Date(cache.cachedAt).getTime();
  const now = Date.now();
  const maxAge = cacheDays * 24 * 60 * 60 * 1000; // 转换为毫秒

  return (now - cachedTime) < maxAge;
}

/**
 * 获取缓存统计信息
 * 
 * @returns 缓存统计
 */
export async function getQichachaCacheStats(): Promise<{
  totalCount: number;
  totalHits: number;
  avgHitCount: number;
  oldestCache: Date | null;
  newestCache: Date | null;
  estimatedSavings: string;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCount: 0,
      totalHits: 0,
      avgHitCount: 0,
      oldestCache: null,
      newestCache: null,
      estimatedSavings: '0.00',
    };
  }

  const records = await db.select().from(qichachaFullDataCache);

  if (records.length === 0) {
    return {
      totalCount: 0,
      totalHits: 0,
      avgHitCount: 0,
      oldestCache: null,
      newestCache: null,
      estimatedSavings: '0.00',
    };
  }

  const totalHits = records.reduce((sum, r) => sum + (r.hitCount || 0), 0);
  const avgHitCount = totalHits / records.length;

  // 计算最早和最新的缓存时间
  const cachedTimes = records.map(r => new Date(r.cachedAt).getTime());
  const oldestCache = new Date(Math.min(...cachedTimes));
  const newestCache = new Date(Math.max(...cachedTimes));

  // 估算节省的费用（每次完整查询约4.35元）
  const costPerQuery = 4.35;
  const estimatedSavings = (totalHits * costPerQuery).toFixed(2);

  return {
    totalCount: records.length,
    totalHits,
    avgHitCount: Math.round(avgHitCount * 100) / 100,
    oldestCache,
    newestCache,
    estimatedSavings,
  };
}

/**
 * 删除过期的缓存记录
 * 
 * @param cacheDays 缓存有效天数
 * @returns 删除的记录数
 */
export async function cleanExpiredCache(cacheDays: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() - cacheDays);

  const result = await db.delete(qichachaFullDataCache)
    .where(lte(qichachaFullDataCache.cachedAt, expireDate));

  return result[0]?.affectedRows || 0;
}

// ============================================================
// 系统配置相关函数
// ============================================================

/**
 * 获取系统配置值
 * 
 * @param key 配置键
 * @param defaultValue 默认值
 * @returns 配置值
 */
export async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  const db = await getDb();
  if (!db) return defaultValue;

  const result = await db.select()
    .from(systemConfig)
    .where(eq(systemConfig.configKey, key))
    .limit(1);

  return result.length > 0 ? result[0].configValue : defaultValue;
}

/**
 * 设置系统配置值
 * 
 * @param key 配置键
 * @param value 配置值
 * @param description 配置描述（可选）
 */
export async function setSystemConfig(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(systemConfig)
    .values({
      configKey: key,
      configValue: value,
      description: description,
    })
    .onDuplicateKeyUpdate({
      set: {
        configValue: value,
        description: description || undefined,
      },
    });
}

/**
 * 获取所有系统配置
 * 
 * @returns 配置列表
 */
export async function getAllSystemConfigs(): Promise<SystemConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(systemConfig);
}

/**
 * 获取缓存有效天数配置
 * 默认30天
 * 
 * @returns 缓存有效天数
 */
export async function getCacheDaysConfig(): Promise<number> {
  const value = await getSystemConfig('qichacha_cache_days', '30');
  const days = parseInt(value, 10);
  return isNaN(days) ? 30 : days;
}

/**
 * 设置缓存有效天数配置
 * 
 * @param days 天数
 */
export async function setCacheDaysConfig(days: number): Promise<void> {
  await setSystemConfig(
    'qichacha_cache_days',
    days.toString(),
    '企查查API数据缓存有效期（天）'
  );
}


// ============================================================
// 缓存预热相关函数
// ============================================================

/**
 * 获取所有缓存记录列表（用于导出）
 * 
 * @returns 缓存记录列表
 */
export async function getAllQichachaCacheRecords(): Promise<QichachaFullDataCache[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(qichachaFullDataCache)
    .orderBy(desc(qichachaFullDataCache.cachedAt));
}

/**
 * 根据企业名称获取缓存记录
 * 
 * @param companyName 企业名称
 * @returns 缓存记录，不存在则返回null
 */
export async function getQichachaCacheByCompanyName(companyName: string): Promise<QichachaFullDataCache | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(qichachaFullDataCache)
    .where(eq(qichachaFullDataCache.companyName, companyName))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 删除指定企业的缓存记录（用于强制刷新）
 * 
 * @param creditCode 统一社会信用代码
 * @returns 是否删除成功
 */
export async function deleteQichachaCache(creditCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(qichachaFullDataCache)
    .where(eq(qichachaFullDataCache.creditCode, creditCode));

  return (result[0]?.affectedRows || 0) > 0;
}

/**
 * 批量检查企业是否已缓存
 * 
 * @param companyNames 企业名称列表
 * @returns 已缓存的企业名称列表
 */
export async function checkCachedCompanies(companyNames: string[]): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const records = await db.select({ companyName: qichachaFullDataCache.companyName })
    .from(qichachaFullDataCache)
    .where(inArray(qichachaFullDataCache.companyName, companyNames));

  return records.map(r => r.companyName);
}


// ============================================================
// 缓存预热任务相关函数
// ============================================================

// 引入缓存预热任务表
import {
  cacheWarmupTasks,
  InsertCacheWarmupTask,
  CacheWarmupTask
} from "../drizzle/schema";

/**
 * 创建缓存预热任务
 * 
 * @param data 任务数据
 * @returns 新创建的任务ID
 */
export async function createCacheWarmupTask(data: InsertCacheWarmupTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(cacheWarmupTasks).values(data);
  return result[0].insertId;
}

/**
 * 获取缓存预热任务列表
 * 
 * @param limit 返回数量，默认50
 * @returns 任务列表
 */
export async function getCacheWarmupTasks(limit: number = 50): Promise<CacheWarmupTask[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(cacheWarmupTasks)
    .orderBy(desc(cacheWarmupTasks.createdAt))
    .limit(limit);
}

/**
 * 根据ID获取缓存预热任务
 * 
 * @param id 任务ID
 * @returns 任务信息，不存在则返回null
 */
export async function getCacheWarmupTaskById(id: number): Promise<CacheWarmupTask | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(cacheWarmupTasks)
    .where(eq(cacheWarmupTasks.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 更新缓存预热任务
 * 
 * @param id 任务ID
 * @param data 要更新的字段
 */
export async function updateCacheWarmupTask(id: number, data: Partial<InsertCacheWarmupTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(cacheWarmupTasks)
    .set(data)
    .where(eq(cacheWarmupTasks.id, id));
}

/**
 * 删除缓存预热任务
 * 
 * @param id 任务ID
 */
export async function deleteCacheWarmupTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(cacheWarmupTasks)
    .where(eq(cacheWarmupTasks.id, id));
}


// ============================================================
// 企查查API配置相关操作
// ============================================================

/**
 * 企查查API默认配置
 * 根据企查查官方文档定义的API端点
 * 
 * 注意：这些是官方文档中的正确端点，如有变更请更新此配置
 */
export const DEFAULT_QICHACHA_API_CONFIG: InsertQichachaApiConfig[] = [
  {
    apiCode: "417",
    apiName: "企业模糊搜索",
    endpoint: "FuzzySearch/GetList",
    cost: "0.10",
    description: "根据关键词模糊搜索企业，返回匹配的企业列表",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 1,
  },
  {
    apiCode: "410",
    apiName: "企业工商信息",
    endpoint: "ECIV4/GetBasicDetailsByName",
    cost: "0.20",
    description: "实时查询企业工商信息（含工商照面信息）",
    method: "GET",
    primaryParam: "keyword",
    isEnabled: true,
    sortOrder: 2,
  },
  {
    apiCode: "731",
    apiName: "股东信息",
    endpoint: "ECIPartner/GetList",
    cost: "0.10",
    description: "获取企业股东列表信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 3,
  },
  {
    apiCode: "732",
    apiName: "高管信息",
    endpoint: "ECIEmployee/GetList",
    cost: "0.10",
    description: "获取企业高管列表信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 4,
  },
  {
    apiCode: "669",
    apiName: "董监高信息",
    endpoint: "ECISeniorPerson/GetList",
    cost: "0.30",
    description: "获取企业董事、监事、高管详细信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 5,
  },
  {
    apiCode: "514",
    apiName: "专利查询",
    endpoint: "PatentV4/SearchMultiPatents",
    cost: "0.30",
    description: "查询企业专利信息（按企业名称或信用代码）",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 6,
  },
  {
    apiCode: "231",
    apiName: "商标查询",
    endpoint: "tm/SearchByApplicant",
    cost: "0.30",
    description: "查询企业商标信息",
    method: "GET",
    primaryParam: "keyword",
    isEnabled: true,
    sortOrder: 7,
  },
  {
    apiCode: "233",
    apiName: "软著查询",
    endpoint: "CopyRight/SearchCopyRight",
    cost: "0.30",
    description: "查询企业软件著作权信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 8,
  },
  {
    apiCode: "723",
    apiName: "客户查询",
    endpoint: "Customer/GetList",
    cost: "0.50",
    description: "查询企业客户信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 9,
  },
  {
    apiCode: "724",
    apiName: "供应商查询",
    endpoint: "Supplier/GetList",
    cost: "0.50",
    description: "查询企业供应商信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 10,
  },
  {
    apiCode: "213",
    apiName: "企业年报",
    endpoint: "AR/GetAnnualReport",
    cost: "1.00",
    description: "获取企业年报信息（需要keyNo参数）",
    method: "GET",
    primaryParam: "keyNo",
    isEnabled: true,
    sortOrder: 11,
  },
  {
    apiCode: "255",
    apiName: "资质证书",
    endpoint: "ECICertification/SearchCertification",
    cost: "0.30",
    description: "查询企业资质证书信息",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 12,
  },
  {
    apiCode: "642",
    apiName: "股权穿透（四层）",
    endpoint: "EquityThrough/GetEquityThrough",
    cost: "1.00",
    description: "获取企业股权穿透信息（向上四层）",
    method: "GET",
    primaryParam: "keyWord",
    isEnabled: true,
    sortOrder: 13,
  },
  {
    apiCode: "663",
    apiName: "对外投资穿透（十层）",
    endpoint: "ECIInvestmentThrough/GetInfo",
    cost: "1.00",
    description: "获取企业对外投资穿透信息（向下十层）",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 14,
  },
  {
    apiCode: "950",
    apiName: "融资信息核查",
    endpoint: "CompanyFinancingSearch/GetList",
    cost: "0.50",
    description: "查询企业融资历程信息，包含融资轮次、融资金额、产品名称、投资方等",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 15,
  },
  {
    apiCode: "2006",
    apiName: "综合风险排查",
    endpoint: "RiskControl/Scan",
    cost: "6.0",
    description: "全面整合多维度风险数据与官方公示名单信息，通过实时综合风险排查，高效识别商业合作中的潜在风险。返回信息包括工商照面信息、上市信息、注销吊销信息、联系信息、经纬度、开票信息、小微企业标识、企业规模、英文名来源、企查查行业、工商登记股东、工商登记主要人员、分支机构、变更信息、企业标签、总公司、受益所有人、实际控制人、所属集团、对外投资、产品列表、行政许可、备案网站、抽查检查、纳税信用等级、失信被执行人、被执行人、行政处罚、经营异常、动产抵押、清算信息、股权出质、严重违法、股权冻结、司法拍卖、破产重整、限制高消费、环保处罚、欠税公告、税收违法、税务非正常户、公安通告、财务数据等。",
    method: "GET",
    primaryParam: "searchKey",
    isEnabled: true,
    sortOrder: 16,
  },
];

/**
 * 初始化企查查API配置
 * 如果数据库中没有配置，则插入默认配置
 * 
 * @returns 是否成功初始化
 */
export async function initQichachaApiConfig(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // 检查是否已有配置
    const existing = await db.select().from(qichachaApiConfig).limit(1);

    if (existing.length === 0) {
      // 没有配置，插入默认配置
      console.log("[QCC Config] Initializing default API configurations...");

      for (const config of DEFAULT_QICHACHA_API_CONFIG) {
        await db.insert(qichachaApiConfig).values(config);
      }

      console.log(`[QCC Config] Initialized ${DEFAULT_QICHACHA_API_CONFIG.length} API configurations`);
    } else {
      console.log("[QCC Config] API configurations already exist, skipping initialization");
    }

    return true;
  } catch (error) {
    console.error("[QCC Config] Failed to initialize API configurations:", error);
    return false;
  }
}

/**
 * 获取所有企查查API配置
 * 
 * @returns API配置列表，按sortOrder排序
 */
export async function getAllQichachaApiConfigs(): Promise<QichachaApiConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(qichachaApiConfig)
    .orderBy(qichachaApiConfig.sortOrder);
}

/**
 * 根据API代码获取配置
 * 
 * @param apiCode API代码（如：730、731等）
 * @returns API配置，不存在则返回null
 */
export async function getQichachaApiConfigByCode(apiCode: string): Promise<QichachaApiConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(qichachaApiConfig)
    .where(eq(qichachaApiConfig.apiCode, apiCode))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 根据API名称获取配置
 * 
 * @param apiName API名称（如：企业模糊搜索、股东信息等）
 * @returns API配置，不存在则返回null
 */
export async function getQichachaApiConfigByName(apiName: string): Promise<QichachaApiConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(qichachaApiConfig)
    .where(eq(qichachaApiConfig.apiName, apiName))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 更新企查查API配置
 * 
 * @param apiCode API代码
 * @param data 要更新的字段
 * @returns 是否更新成功
 */
export async function updateQichachaApiConfig(
  apiCode: string,
  data: Partial<InsertQichachaApiConfig>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(qichachaApiConfig)
      .set(data)
      .where(eq(qichachaApiConfig.apiCode, apiCode));

    console.log(`[QCC Config] Updated API config for ${apiCode}`);
    return true;
  } catch (error) {
    console.error(`[QCC Config] Failed to update API config for ${apiCode}:`, error);
    return false;
  }
}

/**
 * 批量更新企查查API配置
 * 
 * @param configs 要更新的配置列表
 * @returns 是否全部更新成功
 */
export async function batchUpdateQichachaApiConfigs(
  configs: Array<{ apiCode: string; data: Partial<InsertQichachaApiConfig> }>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    for (const { apiCode, data } of configs) {
      await db.update(qichachaApiConfig)
        .set(data)
        .where(eq(qichachaApiConfig.apiCode, apiCode));
    }

    console.log(`[QCC Config] Batch updated ${configs.length} API configs`);
    return true;
  } catch (error) {
    console.error("[QCC Config] Failed to batch update API configs:", error);
    return false;
  }
}

/**
 * 重置企查查API配置为默认值
 * 删除所有现有配置并重新插入默认配置
 * 
 * @returns 是否重置成功
 */
export async function resetQichachaApiConfig(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // 删除所有现有配置
    await db.delete(qichachaApiConfig);

    // 插入默认配置
    for (const config of DEFAULT_QICHACHA_API_CONFIG) {
      await db.insert(qichachaApiConfig).values(config);
    }

    console.log(`[QCC Config] Reset to default configurations (${DEFAULT_QICHACHA_API_CONFIG.length} APIs)`);
    return true;
  } catch (error) {
    console.error("[QCC Config] Failed to reset API configurations:", error);
    return false;
  }
}

/**
 * 获取企查查API端点URL
 * 这是API调用时使用的主要函数
 * 
 * @param apiCode API代码
 * @param baseUrl 基础URL（从数据源配置获取）
 * @returns 完整的API端点URL，如果配置不存在或被禁用则返回null
 */
export async function getQichachaApiEndpoint(apiCode: string, baseUrl: string): Promise<string | null> {
  const config = await getQichachaApiConfigByCode(apiCode);

  if (!config) {
    console.warn(`[QCC Config] API config not found for code: ${apiCode}`);
    return null;
  }

  if (!config.isEnabled) {
    console.warn(`[QCC Config] API ${apiCode} (${config.apiName}) is disabled`);
    return null;
  }

  // 拼接完整URL
  const url = `${baseUrl.replace(/\/$/, '')}/${config.endpoint}`;
  console.log(`[QCC Config] API ${apiCode} (${config.apiName}) endpoint: ${url}`);

  return url;
}

/**
 * 获取企查查API配置信息（用于日志和调试）
 * 
 * @param apiCode API代码
 * @returns API配置摘要信息
 */
export async function getQichachaApiInfo(apiCode: string): Promise<{
  apiCode: string;
  apiName: string;
  endpoint: string;
  cost: string;
  isEnabled: boolean;
} | null> {
  const config = await getQichachaApiConfigByCode(apiCode);

  if (!config) return null;

  return {
    apiCode: config.apiCode,
    apiName: config.apiName,
    endpoint: config.endpoint,
    cost: config.cost || "0",
    isEnabled: config.isEnabled,
  };
}


// ============================================================
// 系统级LLM配置相关函数
// ============================================================

/**
 * 保存系统级LLM配置
 * API Key会被加密后存储
 * 
 * @param provider LLM提供商（zhipu/wenxin/qwen）
 * @param providerName 提供商显示名称
 * @param defaultModel 默认模型ID
 * @param apiKey API Key（明文）
 * @param apiSecret API Secret（明文，百度文心一言需要）
 * @param isEnabled 是否启用
 * @param isDefault 是否为默认提供商
 * @returns 是否保存成功
 */
export async function saveLlmConfig(
  provider: string,
  providerName: string,
  defaultModel: string,
  apiKey?: string,
  apiSecret?: string,
  isEnabled: boolean = true,
  isDefault: boolean = false
): Promise<boolean> {
  console.log('[saveLlmConfig] ========== 保存配置开始 ==========');
  console.log('[saveLlmConfig] 参数:', {
    provider,
    providerName,
    defaultModel,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    hasApiSecret: !!apiSecret,
    isEnabled,
    isDefault
  });

  const db = await getDb();
  if (!db) {
    console.log('[saveLlmConfig] 数据库连接不可用');
    return false;
  }

  try {
    // 加密API Key
    let encryptedApiKey = '';
    let encryptedApiSecret = '';
    let encryptionIv = '';

    if (apiKey) {
      console.log('[saveLlmConfig] 正在加密API Key...');
      const { encrypted, iv } = encrypt(apiKey);
      encryptedApiKey = encrypted;
      encryptionIv = iv;
      console.log('[saveLlmConfig] API Key加密成功, 加密后长度:', encrypted.length);
    }

    if (apiSecret) {
      console.log('[saveLlmConfig] 正在加密API Secret...');
      const { encrypted } = encrypt(apiSecret);
      encryptedApiSecret = encrypted;
      console.log('[saveLlmConfig] API Secret加密成功');
    }

    // 检查是否已有该提供商的配置
    console.log('[saveLlmConfig] 检查现有配置...');
    const existing = await db.select()
      .from(llmConfigs)
      .where(eq(llmConfigs.provider, provider))
      .limit(1);
    console.log('[saveLlmConfig] 现有配置数量:', existing.length);

    // 如果设置为默认，先取消其他提供商的默认状态
    if (isDefault) {
      await db.update(llmConfigs)
        .set({ isDefault: false })
        .where(eq(llmConfigs.isDefault, true));
    }

    if (existing.length > 0) {
      // 更新现有配置
      console.log('[saveLlmConfig] 更新现有配置, ID:', existing[0].id);
      await db.update(llmConfigs)
        .set({
          providerName,
          defaultModel,
          encryptedApiKey: encryptedApiKey || existing[0].encryptedApiKey,
          encryptedApiSecret: encryptedApiSecret || existing[0].encryptedApiSecret,
          encryptionIv: encryptionIv || existing[0].encryptionIv,
          isEnabled,
          isDefault,
        })
        .where(eq(llmConfigs.id, existing[0].id));
      console.log('[saveLlmConfig] 更新成功');
    } else {
      // 创建新配置
      console.log('[saveLlmConfig] 创建新配置...');
      await db.insert(llmConfigs).values({
        provider,
        providerName,
        defaultModel,
        encryptedApiKey,
        encryptedApiSecret,
        encryptionIv,
        isEnabled,
        isDefault,
      });
      console.log('[saveLlmConfig] 插入成功');
    }

    console.log(`[saveLlmConfig] ========== 保存配置完成 ==========`);
    return true;
  } catch (error) {
    console.error("[LLM Config] Failed to save config:", error);
    return false;
  }
}

/**
 * 获取系统级LLM配置（解密后）
 * 
 * @param provider LLM提供商
 * @returns 配置信息（包含解密后的API Key）
 */
export async function getLlmConfig(
  provider: string
): Promise<{
  provider: string;
  providerName: string;
  defaultModel: string;
  apiKey: string;
  apiSecret: string;
  isEnabled: boolean;
  isDefault: boolean;
} | null> {
  console.log('[getLlmConfig] 开始获取配置, provider:', provider);

  const db = await getDb();
  if (!db) {
    console.log('[getLlmConfig] 数据库连接不可用');
    return null;
  }

  try {
    console.log('[getLlmConfig] 正在查询数据库...');
    const result = await db.select()
      .from(llmConfigs)
      .where(eq(llmConfigs.provider, provider))
      .limit(1);

    console.log('[getLlmConfig] 查询结果数量:', result.length);

    if (result.length === 0) {
      console.log('[getLlmConfig] 未找到配置记录');
      return null;
    }

    const config = result[0];
    console.log('[getLlmConfig] 原始配置:', {
      id: config.id,
      provider: config.provider,
      providerName: config.providerName,
      defaultModel: config.defaultModel,
      hasEncryptedApiKey: !!config.encryptedApiKey,
      encryptedApiKeyLength: config.encryptedApiKey?.length || 0,
      hasEncryptionIv: !!config.encryptionIv,
      isEnabled: config.isEnabled,
      isDefault: config.isDefault
    });

    // 解密API Key
    let apiKey = '';
    let apiSecret = '';

    if (config.encryptedApiKey && config.encryptionIv) {
      console.log('[getLlmConfig] 正在解密API Key...');
      try {
        apiKey = decrypt(config.encryptedApiKey, config.encryptionIv);
        console.log('[getLlmConfig] API Key解密成功, 长度:', apiKey.length);
      } catch (decryptError) {
        console.error('[getLlmConfig] API Key解密失败:', decryptError);
      }
    } else {
      console.log('[getLlmConfig] 没有加密的API Key或IV');
    }

    if (config.encryptedApiSecret && config.encryptionIv) {
      console.log('[getLlmConfig] 正在解密API Secret...');
      try {
        apiSecret = decrypt(config.encryptedApiSecret, config.encryptionIv);
        console.log('[getLlmConfig] API Secret解密成功, 长度:', apiSecret.length);
      } catch (decryptError) {
        console.error('[getLlmConfig] API Secret解密失败:', decryptError);
      }
    }

    const finalConfig = {
      provider: config.provider,
      providerName: config.providerName,
      defaultModel: config.defaultModel,
      apiKey,
      apiSecret,
      isEnabled: config.isEnabled,
      isDefault: config.isDefault,
    };

    console.log('[getLlmConfig] 返回配置:', {
      ...finalConfig,
      apiKey: apiKey ? `***${apiKey.slice(-4)}` : '(空)',
      apiSecret: apiSecret ? `***${apiSecret.slice(-4)}` : '(空)'
    });

    return finalConfig;
  } catch (error) {
    console.error("[getLlmConfig] 获取配置失败:", error);
    return null;
  }
}

/**
 * 获取默认LLM配置（解密后）
 * 
 * @returns 默认配置信息
 */
export async function getDefaultLlmConfig(): Promise<{
  provider: string;
  providerName: string;
  defaultModel: string;
  apiKey: string;
  apiSecret: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // 先查找默认提供商
    let result = await db.select()
      .from(llmConfigs)
      .where(and(
        eq(llmConfigs.isDefault, true),
        eq(llmConfigs.isEnabled, true)
      ))
      .limit(1);

    // 如果没有默认，取第一个启用的
    if (result.length === 0) {
      result = await db.select()
        .from(llmConfigs)
        .where(eq(llmConfigs.isEnabled, true))
        .limit(1);
    }

    if (result.length === 0) return null;

    const config = result[0];

    // 解密API Key
    let apiKey = '';
    let apiSecret = '';

    if (config.encryptedApiKey && config.encryptionIv) {
      apiKey = decrypt(config.encryptedApiKey, config.encryptionIv);
    }

    if (config.encryptedApiSecret && config.encryptionIv) {
      apiSecret = decrypt(config.encryptedApiSecret, config.encryptionIv);
    }

    return {
      provider: config.provider,
      providerName: config.providerName,
      defaultModel: config.defaultModel,
      apiKey,
      apiSecret,
    };
  } catch (error) {
    console.error("[LLM Config] Failed to get default config:", error);
    return null;
  }
}

/**
 * 获取所有LLM配置（脱敏）
 * 返回脱敏后的API Key，用于前端显示
 * 
 * @returns 配置列表（API Key已脱敏）
 */
export async function getAllLlmConfigs(): Promise<Array<{
  provider: string;
  providerName: string;
  defaultModel: string;
  maskedApiKey: string;
  maskedApiSecret: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  updatedAt: Date | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db.select()
      .from(llmConfigs);

    return results.map(config => {
      // 解密并脱敏API Key
      let maskedApiKey = '';
      let maskedApiSecret = '';

      if (config.encryptedApiKey && config.encryptionIv) {
        const apiKey = decrypt(config.encryptedApiKey, config.encryptionIv);
        maskedApiKey = maskApiKey(apiKey);
      }

      if (config.encryptedApiSecret && config.encryptionIv) {
        const apiSecret = decrypt(config.encryptedApiSecret, config.encryptionIv);
        maskedApiSecret = maskApiKey(apiSecret);
      }

      return {
        provider: config.provider,
        providerName: config.providerName,
        defaultModel: config.defaultModel,
        maskedApiKey,
        maskedApiSecret,
        hasApiKey: !!config.encryptedApiKey,
        hasApiSecret: !!config.encryptedApiSecret,
        isEnabled: config.isEnabled,
        isDefault: config.isDefault,
        updatedAt: config.updatedAt,
      };
    });
  } catch (error) {
    console.error("[LLM Config] Failed to get configs:", error);
    return [];
  }
}

/**
 * 获取启用的LLM提供商列表（用于前端选择）
 * 
 * @returns 启用的提供商列表
 */
export async function getEnabledLlmProviders(): Promise<Array<{
  provider: string;
  providerName: string;
  defaultModel: string;
  isDefault: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db.select({
      provider: llmConfigs.provider,
      providerName: llmConfigs.providerName,
      defaultModel: llmConfigs.defaultModel,
      isDefault: llmConfigs.isDefault,
    })
      .from(llmConfigs)
      .where(eq(llmConfigs.isEnabled, true));

    return results;
  } catch (error) {
    console.error("[LLM Config] Failed to get enabled providers:", error);
    return [];
  }
}

/**
 * 删除LLM配置
 * 
 * @param provider LLM提供商
 * @returns 是否删除成功
 */
export async function deleteLlmConfig(provider: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(llmConfigs)
      .where(eq(llmConfigs.provider, provider));

    console.log(`[LLM Config] Deleted config for provider ${provider}`);
    return true;
  } catch (error) {
    console.error("[LLM Config] Failed to delete config:", error);
    return false;
  }
}

/**
 * 设置默认LLM提供商
 * 
 * @param provider 要设为默认的提供商
 * @returns 是否设置成功
 */
export async function setDefaultLlmProvider(provider: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // 先将所有配置设为非默认
    await db.update(llmConfigs)
      .set({ isDefault: false });

    // 将指定配置设为默认
    await db.update(llmConfigs)
      .set({ isDefault: true })
      .where(eq(llmConfigs.provider, provider));

    console.log(`[LLM Config] Set default provider: ${provider}`);
    return true;
  } catch (error) {
    console.error("[LLM Config] Failed to set default provider:", error);
    return false;
  }
}


// ============================================================
// 日志配置相关函数
// ============================================================

// 日志配置键名常量
export const LOG_CONFIG_KEYS = {
  DEBUG_LOG_ENABLED: 'debug_log_enabled',        // 调试日志总开关
  LOG_DB_OPERATIONS: 'log_db_operations',        // 数据库操作日志
  LOG_QICHACHA_API: 'log_qichacha_api',          // 企查查API调用日志
  LOG_LLM_API: 'log_llm_api',                    // 大模型API调用日志
  LOG_REPORT_GENERATION: 'log_report_generation', // 报告生成日志
} as const;

/**
 * 获取日志配置
 * 
 * @param key 日志配置键
 * @returns 是否启用该日志
 */
export async function getLogConfig(key: string): Promise<boolean> {
  const value = await getSystemConfig(key, 'false');
  return value === 'true' || value === '1';
}

/**
 * 设置日志配置
 * 
 * @param key 日志配置键
 * @param enabled 是否启用
 */
export async function setLogConfig(key: string, enabled: boolean): Promise<void> {
  const descriptions: Record<string, string> = {
    [LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED]: '调试日志总开关',
    [LOG_CONFIG_KEYS.LOG_DB_OPERATIONS]: '数据库操作日志',
    [LOG_CONFIG_KEYS.LOG_QICHACHA_API]: '企查查API调用日志',
    [LOG_CONFIG_KEYS.LOG_LLM_API]: '大模型API调用日志',
    [LOG_CONFIG_KEYS.LOG_REPORT_GENERATION]: '报告生成流程日志',
  };

  await setSystemConfig(key, enabled ? 'true' : 'false', descriptions[key] || '日志配置');
}

/**
 * 获取所有日志配置
 * 
 * @returns 日志配置对象
 */
export async function getAllLogConfigs(): Promise<{
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

/**
 * 条件日志输出函数
 * 只有在对应日志开关启用时才输出日志
 * 
 * @param category 日志类别
 * @param message 日志消息
 * @param data 附加数据
 */
export async function debugLog(
  category: 'db' | 'qichacha' | 'llm' | 'report',
  message: string,
  data?: any
): Promise<void> {
  // 先检查总开关
  const debugEnabled = await getLogConfig(LOG_CONFIG_KEYS.DEBUG_LOG_ENABLED);
  if (!debugEnabled) return;

  // 检查分类开关
  const categoryKeyMap: Record<string, string> = {
    db: LOG_CONFIG_KEYS.LOG_DB_OPERATIONS,
    qichacha: LOG_CONFIG_KEYS.LOG_QICHACHA_API,
    llm: LOG_CONFIG_KEYS.LOG_LLM_API,
    report: LOG_CONFIG_KEYS.LOG_REPORT_GENERATION,
  };

  const categoryEnabled = await getLogConfig(categoryKeyMap[category]);
  if (!categoryEnabled) return;

  // 输出日志
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category.toUpperCase()}]`;

  if (data !== undefined) {
    console.log(prefix, message, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, message);
  }
}

// 同步版本的日志函数（用于不方便使用async的场景）
// 使用内存缓存来避免频繁查询数据库
let logConfigCache: {
  debugLogEnabled: boolean;
  logDbOperations: boolean;
  logQichachaApi: boolean;
  logLlmApi: boolean;
  logReportGeneration: boolean;
} | null = null;
let logConfigCacheTime = 0;
const LOG_CONFIG_CACHE_TTL = 60000; // 1分钟缓存

/**
 * 刷新日志配置缓存
 */
export async function refreshLogConfigCache(): Promise<void> {
  logConfigCache = await getAllLogConfigs();
  logConfigCacheTime = Date.now();
}

/**
 * 同步版本的条件日志输出
 * 使用缓存的配置，避免频繁查询数据库
 * 
 * @param category 日志类别
 * @param message 日志消息
 * @param data 附加数据
 */
export function debugLogSync(
  category: 'db' | 'qichacha' | 'llm' | 'report',
  message: string,
  data?: any
): void {
  // 如果缓存过期或不存在，异步刷新（但不等待）
  if (!logConfigCache || Date.now() - logConfigCacheTime > LOG_CONFIG_CACHE_TTL) {
    refreshLogConfigCache().catch(console.error);
    // 如果没有缓存，默认不输出日志
    if (!logConfigCache) return;
  }

  // 检查总开关
  if (!logConfigCache.debugLogEnabled) return;

  // 检查分类开关
  const categoryEnabledMap: Record<string, boolean> = {
    db: logConfigCache.logDbOperations,
    qichacha: logConfigCache.logQichachaApi,
    llm: logConfigCache.logLlmApi,
    report: logConfigCache.logReportGeneration,
  };

  if (!categoryEnabledMap[category]) return;

  // 输出日志
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category.toUpperCase()}]`;

  if (data !== undefined) {
    console.log(prefix, message, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(prefix, message);
  }
}


// ============================================================
// 用户认证相关函数
// ============================================================

/**
 * 生成6位随机密码
 * 包含数字和大小写字母，易于阅读
 * 
 * @returns 6位随机密码
 */
export function generateRandomPassword(): string {
  // 使用易于区分的字符（排除0O1lI等容易混淆的字符）
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  let password = '';
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * 根据手机号获取用户
 * 
 * @param phone 手机号
 * @returns 用户信息
 */
export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Auth] Failed to get user by phone:", error);
    return null;
  }
}

/**
 * 验证用户登录
 * 
 * @param phone 手机号
 * @param password 密码
 * @returns 用户信息（验证成功）或null（验证失败）
 */
export async function verifyUserLogin(phone: string, password: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select()
      .from(users)
      .where(and(
        eq(users.phone, phone),
        eq(users.password, password)
      ))
      .limit(1);

    if (result.length === 0) return null;

    // 更新最后登录时间
    await db.update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, result[0].id));

    return result[0];
  } catch (error) {
    console.error("[Auth] Failed to verify login:", error);
    return null;
  }
}

/**
 * 创建新用户（管理员批量导入用）
 * 
 * @param phone 手机号
 * @param name 用户名（可选）
 * @param role 角色（默认user）
 * @param reportQuota 报告额度（默认50）
 * @returns 创建的用户信息（包含生成的密码）
 */
export async function createUser(
  phone: string,
  name?: string,
  role: 'user' | 'admin' = 'user',
  reportQuota: number = 50
): Promise<{ user: any; password: string } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // 检查手机号是否已存在
    const existing = await getUserByPhone(phone);
    if (existing) {
      console.log(`[Auth] Phone ${phone} already exists`);
      return null;
    }

    // 生成随机密码
    const password = generateRandomPassword();

    // 创建用户
    const openId = `phone_${phone}_${Date.now()}`; // 生成唯一openId

    await db.insert(users).values({
      openId,
      phone,
      password,
      name: name || `用户${phone.slice(-4)}`,
      role,
      reportQuota,
      reportUsed: 0,
      preferredLlm: 'zhipu', // 默认使用智谱
      loginMethod: 'phone',
    });

    // 获取创建的用户
    const user = await getUserByPhone(phone);

    return { user, password };
  } catch (error) {
    console.error("[Auth] Failed to create user:", error);
    return null;
  }
}

/**
 * 批量创建用户
 * 
 * @param phones 手机号列表
 * @param reportQuota 报告额度（默认50）
 * @returns 创建结果列表
 */
export async function batchCreateUsers(
  phones: string[],
  reportQuota: number = 50
): Promise<Array<{ phone: string; password: string; success: boolean; error?: string }>> {
  const results: Array<{ phone: string; password: string; success: boolean; error?: string }> = [];

  for (const phone of phones) {
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      results.push({ phone, password: '', success: false, error: '手机号格式不正确' });
      continue;
    }

    const result = await createUser(phone, undefined, 'user', reportQuota);
    if (result) {
      results.push({ phone, password: result.password, success: true });
    } else {
      results.push({ phone, password: '', success: false, error: '用户已存在或创建失败' });
    }
  }

  return results;
}

/**
 * 获取所有用户列表（管理员用）
 * 
 * @param limit 限制数量
 * @param offset 偏移量
 * @returns 用户列表
 */
export async function getAllUsers(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select({
      id: users.id,
      phone: users.phone,
      name: users.name,
      role: users.role,
      reportQuota: users.reportQuota,
      reportUsed: users.reportUsed,
      preferredLlm: users.preferredLlm,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  } catch (error) {
    console.error("[Auth] Failed to get all users:", error);
    return [];
  }
}

/**
 * 获取用户总数
 * 
 * @returns 用户总数
 */
export async function getUsersCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: users.id })
      .from(users);
    return result.length;
  } catch (error) {
    console.error("[Auth] Failed to get users count:", error);
    return 0;
  }
}

/**
 * 更新用户信息
 * 
 * @param id 用户ID
 * @param data 要更新的数据
 * @returns 是否更新成功
 */
export async function updateUser(
  id: number,
  data: {
    name?: string;
    role?: 'user' | 'admin';
    reportQuota?: number;
    preferredLlm?: string;
    password?: string;
  }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(users)
      .set(data)
      .where(eq(users.id, id));

    return true;
  } catch (error) {
    console.error("[Auth] Failed to update user:", error);
    return false;
  }
}

/**
 * 删除用户
 * 
 * @param id 用户ID
 * @returns 是否删除成功
 */
export async function deleteUser(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(users)
      .where(eq(users.id, id));

    return true;
  } catch (error) {
    console.error("[Auth] Failed to delete user:", error);
    return false;
  }
}

/**
 * 增加用户已使用报告数
 * 
 * @param userId 用户ID
 * @returns 是否更新成功
 */
export async function incrementUserReportUsed(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // 获取当前用户
    const result = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return false;

    // 增加已使用数量
    await db.update(users)
      .set({ reportUsed: result[0].reportUsed + 1 })
      .where(eq(users.id, userId));

    return true;
  } catch (error) {
    console.error("[Auth] Failed to increment report used:", error);
    return false;
  }
}

/**
 * 检查用户是否有剩余额度
 * 
 * @param userId 用户ID
 * @returns 是否有剩余额度
 */
export async function checkUserQuota(userId: number): Promise<{ hasQuota: boolean; remaining: number; used: number; total: number }> {
  const db = await getDb();
  if (!db) return { hasQuota: false, remaining: 0, used: 0, total: 0 };

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return { hasQuota: false, remaining: 0, used: 0, total: 0 };

    const user = result[0];
    const remaining = user.reportQuota - user.reportUsed;

    return {
      hasQuota: remaining > 0,
      remaining,
      used: user.reportUsed,
      total: user.reportQuota,
    };
  } catch (error) {
    console.error("[Auth] Failed to check user quota:", error);
    return { hasQuota: false, remaining: 0, used: 0, total: 0 };
  }
}

/**
 * 重置用户密码
 * 
 * @param id 用户ID
 * @returns 新密码（如果成功）
 */
export async function resetUserPassword(id: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const newPassword = generateRandomPassword();

    await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, id));

    return newPassword;
  } catch (error) {
    console.error("[Auth] Failed to reset password:", error);
    return null;
  }
}

/**
 * 获取用户信息（通过ID）
 * 
 * @param id 用户ID
 * @returns 用户信息
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Auth] Failed to get user by id:", error);
    return null;
  }
}
/**
 * 修改用户密码
 * 
 * @param userId 用户ID
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns 是否修改成功
 */
export async function changeUserPassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库连接失败' };

  try {
    // 查询用户当前密码
    const result = await db.select({ password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return { success: false, message: '用户不存在' };
    }

    // 验证旧密码
    if (result[0].password !== oldPassword) {
      return { success: false, message: '旧密码不正确' };
    }

    // 更新密码
    await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId));

    return { success: true, message: '密码修改成功' };
  } catch (error) {
    console.error("[Auth] Failed to change password:", error);
    return { success: false, message: '密码修改失败' };
  }
}

/**
 * 为用户充值额度
 * 
 * @param userId 用户ID
 * @param amount 充值数量
 * @returns 是否充值成功
 */
export async function rechargeUserQuota(
  userId: number,
  amount: number
): Promise<{ success: boolean; message: string; newQuota?: number }> {
  const db = await getDb();
  if (!db) return { success: false, message: '数据库连接失败' };

  try {
    if (amount <= 0) {
      return { success: false, message: '充值数量必须大于0' };
    }

    // 查询用户当前额度
    const result = await db.select({ reportQuota: users.reportQuota })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return { success: false, message: '用户不存在' };
    }

    const newQuota = result[0].reportQuota + amount;

    // 更新额度
    await db.update(users)
      .set({ reportQuota: newQuota })
      .where(eq(users.id, userId));

    return { success: true, message: `充值成功，当前额度: ${newQuota}`, newQuota };
  } catch (error) {
    console.error("[Auth] Failed to recharge quota:", error);
    return { success: false, message: '额度充值失败' };
  }
}

/**
 * 记录登录日志
 * 
 * @param params 登录日志参数
 * @returns 是否记录成功
 */
export async function recordLoginLog(params: {
  userId: number;
  phone?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  failReason?: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.insert(loginLogs).values({
      userId: params.userId,
      phone: params.phone || null,
      userName: params.userName || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      status: params.status,
      failReason: params.failReason || null,
    });

    return true;
  } catch (error) {
    console.error("[Auth] Failed to record login log:", error);
    return false;
  }
}

/**
 * 获取登录日志列表
 * 
 * @param params 查询参数
 * @returns 登录日志列表
 */
export async function getLoginLogs(params?: {
  userId?: number;
  phone?: string;
  status?: 'success' | 'failed';
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  try {
    const conditions = [];

    if (params?.userId) {
      conditions.push(eq(loginLogs.userId, params.userId));
    }
    if (params?.phone) {
      conditions.push(like(loginLogs.phone, `%${params.phone}%`));
    }
    if (params?.status) {
      conditions.push(eq(loginLogs.status, params.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数
    const countResult = await db.select({ count: count() })
      .from(loginLogs)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // 查询列表
    let query = db.select()
      .from(loginLogs)
      .where(whereClause)
      .orderBy(desc(loginLogs.loginTime));

    if (params?.limit) {
      query = query.limit(params.limit) as typeof query;
    }
    if (params?.offset) {
      query = query.offset(params.offset) as typeof query;
    }

    const logs = await query;

    return { logs, total };
  } catch (error) {
    console.error("[Auth] Failed to get login logs:", error);
    return { logs: [], total: 0 };
  }
}

/**
 * 获取用户的登录日志
 * 
 * @param userId 用户ID
 * @param limit 限制数量
 * @returns 登录日志列表
 */
export async function getUserLoginLogs(userId: number, limit: number = 10): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const logs = await db.select()
      .from(loginLogs)
      .where(eq(loginLogs.userId, userId))
      .orderBy(desc(loginLogs.loginTime))
      .limit(limit);

    return logs;
  } catch (error) {
    console.error("[Auth] Failed to get user login logs:", error);
    return [];
  }
}
