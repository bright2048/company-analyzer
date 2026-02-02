/**
 * 数据库表结构定义文件
 * 
 * 功能说明：
 * - 使用Drizzle ORM定义所有数据库表的结构
 * - 定义表字段、类型、约束和默认值
 * - 导出TypeScript类型供其他模块使用
 * 
 * 包含的数据表：
 * 1. users - 用户表
 * 2. parkCompanies - 园区企业表
 * 3. batchTasks - 批量任务表
 * 4. companyReports - 企业报告表
 * 5. dataSourceConfig - 数据源配置表
 * 6. companyCache - 企业信息缓存表
 * 7. companySearchCache - 搜索结果缓存表
 * 8. apiCallStats - API调用统计表
 * 
 * 使用方法：
 * 1. 修改此文件后运行 pnpm db:push 同步到数据库
 * 2. 在代码中导入类型使用，如：import { User, InsertUser } from "../drizzle/schema"
 */

// 引入Drizzle ORM的MySQL字段类型定义
import {
  int,        // 整数类型
  mysqlEnum,  // 枚举类型
  mysqlTable, // 定义MySQL表
  text,       // 长文本类型
  mediumtext,
  timestamp,  // 时间戳类型
  varchar,    // 可变长度字符串
  json,       // JSON类型
  boolean     // 布尔类型
} from "drizzle-orm/mysql-core";

// ============================================================
// 用户表 (users)
// ============================================================

/**
 * 用户表 - 存储系统用户信息
 * 
 * 用途：
 * - 存储系统用户信息（手机号+密码登录）
 * - 区分普通用户和管理员
 * - 管理用户报告生成额度
 * - 记录用户选择的大模型类型
 */
export const users = mysqlTable("users", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 用户唯一标识（兼容旧版OAuth，新用户使用手机号）
  openId: varchar("openId", { length: 64 }).notNull().unique(),

  // 用户名称（显示名）
  name: text("name"),

  // 用户邮箱
  email: varchar("email", { length: 320 }),

  // 手机号码（用于登录，唯一）
  phone: varchar("phone", { length: 20 }).unique(),

  // 登录密码（6位随机生成）
  password: varchar("password", { length: 64 }),

  // 登录方式（phone: 手机号登录，oauth: OAuth登录）
  loginMethod: varchar("loginMethod", { length: 64 }).default("phone"),

  // 用户角色：user（普通用户）或 admin（管理员）
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),

  // 报告生成额度（默认50份）
  reportQuota: int("reportQuota").default(50).notNull(),

  // 已使用的报告数量
  reportUsed: int("reportUsed").default(0).notNull(),

  // 用户选择的大模型类型（zhipu/wenxin/qwen）
  // 默认使用智谱AI
  preferredLlm: varchar("preferredLlm", { length: 32 }).default("zhipu"),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // 最后登录时间
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// 导出用户表的查询结果类型（用于读取数据）
export type User = typeof users.$inferSelect;
// 导出用户表的插入数据类型（用于写入数据）
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// 园区企业表 (park_companies)
// ============================================================

/**
 * 园区企业表 - 存储园区内的企业信息
 * 
 * 用途：
 * - 管理园区入驻企业的基本信息
 * - 支持从企查查Excel批量导入
 * - 用于报告生成时的上下游企业匹配
 * 
 * 数据来源：
 * - 手动添加（manual）
 * - 企查查Excel导入（qichacha_import）
 */
export const parkCompanies = mysqlTable("park_companies", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 企业名称（必填）
  companyName: varchar("companyName", { length: 255 }).notNull(),

  // ========== 企查查导入字段 ==========

  // 统一社会信用代码（18位，企业唯一标识）
  creditCode: varchar("creditCode", { length: 64 }),

  // 法定代表人姓名
  legalPerson: varchar("legalPerson", { length: 64 }),

  // 登记状态（如：存续、在业、注销、吊销等）
  companyStatus: varchar("companyStatus", { length: 32 }),

  // 企业规模
  // L: 大型企业, M: 中型企业, S: 小型企业, XS: 微型企业
  companyScale: varchar("companyScale", { length: 32 }),

  // 实缴资本（如：1000万人民币）
  paidCapital: varchar("paidCapital", { length: 64 }),

  // 所属省份（如：广东省）
  province: varchar("province", { length: 32 }),

  // 所属城市（如：深圳市）
  city: varchar("city", { length: 32 }),

  // 所属区县（如：南山区）
  district: varchar("district", { length: 32 }),

  // 企业详细地址
  address: text("address"),

  // ========== 原有字段 ==========

  // 所属行业（如：软件和信息技术服务业）
  industry: varchar("industry", { length: 128 }),

  // 经营范围（详细描述企业的业务范围）
  businessScope: text("businessScope"),

  // 注册资本（如：5000万人民币）
  registeredCapital: varchar("registeredCapital", { length: 64 }),

  // 成立日期（如：2020-01-01）
  establishedDate: varchar("establishedDate", { length: 32 }),

  // 联系人姓名
  contactPerson: varchar("contactPerson", { length: 64 }),

  // 联系电话
  // 长度1024，因为企查查导出可能包含多个电话号码
  contactPhone: varchar("contactPhone", { length: 1024 }),

  // 联系邮箱
  contactEmail: varchar("contactEmail", { length: 128 }),

  // 办公面积（如：500平方米）
  officeArea: varchar("officeArea", { length: 64 }),

  // 员工人数
  employeeCount: int("employeeCount"),

  // 企业标签（JSON数组格式）
  // 示例：["上游供应商", "下游客户", "潜在客户", "重点企业"]
  tags: text("tags"),

  // 备注信息
  notes: text("notes"),

  // 数据来源
  // manual: 手动添加
  // qichacha_import: 企查查Excel导入
  dataSource: varchar("dataSource", { length: 32 }),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出园区企业表的类型
export type ParkCompany = typeof parkCompanies.$inferSelect;
export type InsertParkCompany = typeof parkCompanies.$inferInsert;

// ============================================================
// 批量任务表 (batch_tasks)
// ============================================================

/**
 * 批量任务表 - 存储批量生成报告的任务信息
 * 
 * 用途：
 * - 记录批量生成任务的状态和进度
 * - 存储待处理的企业名称列表
 * - 保存打包下载链接
 */
export const batchTasks = mysqlTable("batch_tasks", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 总任务数（需要生成的报告数量）
  totalCount: int("totalCount").notNull().default(0),

  // 已完成数量
  completedCount: int("completedCount").notNull().default(0),

  // 失败数量
  failedCount: int("failedCount").notNull().default(0),

  // 任务状态
  // pending: 等待中
  // processing: 处理中
  // completed: 已完成
  // failed: 失败
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),

  // 企业名称列表（JSON数组格式）
  // 示例：["华为技术有限公司", "腾讯科技有限公司"]
  companyNames: text("companyNames"),

  // 错误信息（如果任务失败）
  errorMessage: text("errorMessage"),

  // 打包下载链接（所有报告打包成ZIP后的下载URL）
  zipFileUrl: text("zipFileUrl"),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出批量任务表的类型
export type BatchTask = typeof batchTasks.$inferSelect;
export type InsertBatchTask = typeof batchTasks.$inferInsert;

// ============================================================
// 企业报告表 (company_reports)
// ============================================================

/**
 * 企业报告表 - 存储生成的企业分析报告
 * 
 * 用途：
 * - 存储企业的工商信息（从企查查获取）
 * - 存储AI生成的分析报告内容
 * - 保存导出的Word和PDF文件链接
 */
export const companyReports = mysqlTable("company_reports", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 企业名称（必填）
  companyName: varchar("companyName", { length: 255 }).notNull(),

  // 关联的批量任务ID（如果是批量生成的报告）
  batchTaskId: int("batchTaskId"),

  // ========== 企业信息 ==========

  // 企业基本信息（JSON格式）
  // 包含：工商信息、融资情况、专利数量、股东信息、高管信息等
  companyInfo: text("companyInfo"),

  // ========== 报告内容 ==========

  // AI生成的完整报告内容（Markdown格式）
  // 包含：企业概况、高管分析、营收分析、风险提示、上下游分析等
  reportContent: text("reportContent"),

  // AI生成的缩略版报告内容（Markdown格式，约500字）
  // 包含：企业基本信息、核心结论、风险提示、合作建议
  // 用途：供领导快速查阅
  summaryContent: text("summaryContent"),

  // 园区匹配分析结果（JSON格式）
  // 包含：匹配度评分、上下游关系、合作建议等
  parkAnalysis: text("parkAnalysis"),

  // ========== 状态信息 ==========

  // 报告生成状态
  // pending: 等待中
  // searching: 正在搜索企业信息
  // generating: 正在生成报告
  // completed: 已完成
  // failed: 失败
  status: mysqlEnum("status", ["pending", "searching", "generating", "completed", "failed"]).default("pending").notNull(),

  // 错误信息（如果生成失败）
  errorMessage: text("errorMessage"),

  // 数据来源
  // web: 网络搜索
  // tianyancha: 天眼查
  // qichacha: 企查查
  dataSource: mysqlEnum("dataSource", ["web", "tianyancha", "qichacha"]).default("web").notNull(),

  // 大模型提供商
  // qwen: 通义千问（阿里云）
  // zhipu: 智谱AI (GLM)
  // wenxin: 文心一言（百度）
  llmProvider: mysqlEnum("llmProvider", ["qwen", "zhipu", "wenxin"]).default("zhipu"),

  // ========== 股权穿透数据 ==========

  // 股权穿透数据（JSON格式，上游股东）
  equityThrough: text("equityThrough"),

  // 对外投资穿透数据（JSON格式，下游子公司）
  investmentThrough: text("investmentThrough"),

  // ========== 导出文件 ==========

  // Word文件下载链接
  wordFileUrl: text("wordFileUrl"),

  // PDF文件下载链接
  pdfFileUrl: text("pdfFileUrl"),

  // ========== 时间戳 ==========

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出企业报告表的类型
export type CompanyReport = typeof companyReports.$inferSelect;
export type InsertCompanyReport = typeof companyReports.$inferInsert;

// ============================================================
// 数据源配置表 (data_source_config)
// ============================================================

/**
 * 数据源配置表 - 存储第三方API的配置信息
 * 
 * 用途：
 * - 存储企查查、天眼查等API的密钥
 * - 管理启用/禁用状态
 * - 支持在系统设置页面配置
 */
export const dataSourceConfig = mysqlTable("data_source_config", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 数据源类型（唯一）
  // web: 网络搜索
  // tianyancha: 天眼查
  // qichacha: 企查查
  sourceType: mysqlEnum("sourceType", ["web", "tianyancha", "qichacha"]).notNull().unique(),

  // API密钥（AppKey）
  apiKey: varchar("apiKey", { length: 255 }),

  // API密钥（SecretKey）
  apiSecret: varchar("apiSecret", { length: 255 }),

  // API基础URL（可选，用于自定义接口地址）
  baseUrl: varchar("baseUrl", { length: 255 }),

  // 是否启用
  // true: 启用此数据源
  // false: 禁用此数据源
  isEnabled: boolean("isEnabled").default(false).notNull(),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出数据源配置表的类型
export type DataSourceConfig = typeof dataSourceConfig.$inferSelect;
export type InsertDataSourceConfig = typeof dataSourceConfig.$inferInsert;

// ============================================================
// 企业信息缓存表 (company_cache)
// ============================================================

/**
 * 企业信息缓存表 - 缓存从企查查等API获取的企业信息
 * 
 * 用途：
 * - 减少重复API调用，节省费用
 * - 提高搜索响应速度
 * - 支持离线查询已缓存的企业
 * 
 * 缓存策略：
 * - 默认缓存30天（可通过COMPANY_CACHE_DAYS环境变量配置）
 * - 以统一社会信用代码为唯一标识
 */
export const companyCache = mysqlTable("company_cache", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 统一社会信用代码（18位，唯一标识）
  // 作为缓存的主键，用于去重
  creditCode: varchar("creditCode", { length: 64 }).notNull().unique(),

  // 企业名称
  companyName: varchar("companyName", { length: 255 }).notNull(),

  // 法定代表人
  legalPerson: varchar("legalPerson", { length: 64 }),

  // 企业状态（如：存续、注销等）
  status: varchar("status", { length: 32 }),

  // 成立日期
  establishDate: varchar("establishDate", { length: 32 }),

  // 注册资本
  registeredCapital: varchar("registeredCapital", { length: 64 }),

  // 注册地址
  address: text("address"),

  // 经营范围
  businessScope: text("businessScope"),

  // 数据来源（默认为企查查）
  dataSource: varchar("dataSource", { length: 32 }).default("qichacha"),

  // 缓存时间（用于判断缓存是否过期）
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出企业缓存表的类型
export type CompanyCache = typeof companyCache.$inferSelect;
export type InsertCompanyCache = typeof companyCache.$inferInsert;

// ============================================================
// 搜索结果缓存表 (company_search_cache)
// ============================================================

/**
 * 搜索结果缓存表 - 缓存搜索关键词与企业的对应关系
 * 
 * 用途：
 * - 缓存关键词搜索结果
 * - 避免相同关键词重复调用API
 * - 与company_cache表配合使用
 * 
 * 工作原理：
 * 1. 用户搜索"华为"
 * 2. 检查此表是否有"华为"的缓存
 * 3. 如果有，从company_cache表获取对应企业信息
 * 4. 如果没有，调用API搜索，然后保存到两个表
 */
export const companySearchCache = mysqlTable("company_search_cache", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 搜索关键词
  keyword: varchar("keyword", { length: 128 }).notNull(),

  // 关联的企业信用代码列表
  // JSON数组格式，如：["91440300...", "91440300..."]
  // 通过这些信用代码可以从company_cache表获取详细信息
  creditCodes: text("creditCodes").notNull(),

  // 缓存时间（用于判断缓存是否过期）
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

// 导出搜索缓存表的类型
export type CompanySearchCache = typeof companySearchCache.$inferSelect;
export type InsertCompanySearchCache = typeof companySearchCache.$inferInsert;

// ============================================================
// API调用统计表 (api_call_stats)
// ============================================================

/**
 * API调用统计表 - 记录各类API的调用情况
 * 
 * 用途：
 * - 统计企查查API的调用次数和费用
 * - 统计LLM（大语言模型）的调用次数和费用
 * - 用于成本分析和预算控制
 * - 排查API调用问题
 * 
 * 记录的API类型：
 * - qichacha_search: 企查查企业搜索
 * - qichacha_detail: 企查查工商详情
 * - qichacha_shareholder: 企查查股东信息
 * - qichacha_executive: 企查查高管信息
 * - llm_report: LLM报告生成
 * - llm_analysis: LLM分析
 */
export const apiCallStats = mysqlTable("api_call_stats", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // API类型（用于分类统计）
  // 如：qichacha_search, qichacha_detail, llm_report
  apiType: varchar("apiType", { length: 64 }).notNull(),

  // API名称（更详细的描述）
  // 如：企业搜索、工商详情查询、报告生成
  apiName: varchar("apiName", { length: 128 }).notNull(),

  // 调用状态
  // success: 成功
  // failed: 失败
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),

  // 单次调用费用（元）
  // 如：0.01（企查查搜索）、0.05（LLM调用）
  cost: varchar("cost", { length: 32 }),

  // 关联的企业名称（可选）
  // 记录这次API调用是为哪个企业
  companyName: varchar("companyName", { length: 255 }),

  // 关联的报告ID（可选）
  // 记录这次API调用属于哪个报告
  reportId: int("reportId"),

  // 请求参数（JSON格式，用于调试）
  requestParams: text("requestParams"),

  // 响应摘要（JSON格式，记录关键返回信息）
  responseSummary: text("responseSummary"),

  // 错误信息（如果调用失败）
  errorMessage: text("errorMessage"),

  // 调用时间
  calledAt: timestamp("calledAt").defaultNow().notNull(),
});

// 导出API调用统计表的类型
export type ApiCallStat = typeof apiCallStats.$inferSelect;
export type InsertApiCallStat = typeof apiCallStats.$inferInsert;


// ============================================================
// 企查查完整数据缓存表 (qichacha_full_data_cache)
// ============================================================

/**
 * 企查查完整数据缓存表 - 缓存企查查API返回的所有原始数据
 * 
 * 用途：
 * - 缓存企查查11个API的完整返回数据
 * - 30天内重复查询同一企业时直接读取缓存，节省API费用
 * - 缓存有效期可通过系统设置配置
 * 
 * 缓存策略：
 * - 以统一社会信用代码为唯一标识
 * - 默认缓存30天（可在设置页面修改）
 * - 缓存过期后自动重新调用API获取最新数据
 * 
 * 节省费用计算：
 * - 单次完整查询费用：约4.35元（11个API）
 * - 缓存命中时费用：0元
 */
export const qichachaFullDataCache = mysqlTable("qichacha_full_data_cache", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 统一社会信用代码（18位，唯一标识）
  // 作为缓存的主键，确保同一企业只有一条缓存记录
  creditCode: varchar("creditCode", { length: 64 }).notNull().unique(),

  // 企业名称（用于显示和搜索）
  companyName: varchar("companyName", { length: 255 }).notNull(),

  // ========== 缓存的API数据（JSON格式） ==========

  // 工商信息详情（ECIV4接口，0.15元/次）
  basicInfo: text("basicInfo"),

  // 股东信息（ECIPartner接口，0.10元/次）
  shareholders: text("shareholders"),

  // 高管列表（ECIEmployee接口，0.10元/次）
  executives: text("executives"),

  // 高管详细信息（669接口，0.30元/次）
  executiveDetails: text("executiveDetails"),

  // 专利信息（514接口，0.30元/次）
  patents: text("patents"),

  // 商标信息（231接口，0.30元/次）
  trademarks: text("trademarks"),

  // 软著信息（233接口，0.30元/次）
  copyrights: text("copyrights"),

  // 客户信息（723接口，0.50元/次）
  customers: text("customers"),

  // 供应商信息（724接口，0.50元/次）
  suppliers: text("suppliers"),

  // 年报财务数据（213接口，1.00元/次）
  annualReports: text("annualReports"),

  // 资质证书（255接口，0.30元/次）
  certificates: text("certificates"),

  // 股权穿透信息（642接口，0.50元/次）
  equityThrough: text("equityThrough"),

  // 对外投资穿透信息（663接口，0.50元/次）
  investmentThrough: text("investmentThrough"),

  financings: text("financings"),
  // ========== 缓存元数据 ==========
  riskScan: mediumtext("riskScan"),

  // 缓存创建时间（用于判断缓存是否过期）
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),

  // 缓存更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // 缓存命中次数（统计缓存使用情况）
  hitCount: int("hitCount").default(0).notNull(),

  // 最后命中时间
  lastHitAt: timestamp("lastHitAt"),
});

// 导出企查查完整数据缓存表的类型
export type QichachaFullDataCache = typeof qichachaFullDataCache.$inferSelect;
export type InsertQichachaFullDataCache = typeof qichachaFullDataCache.$inferInsert;

// ============================================================
// 系统配置表 (system_config)
// ============================================================

/**
 * 系统配置表 - 存储系统级别的配置项
 * 
 * 用途：
 * - 存储缓存有效期等可配置参数
 * - 支持在设置页面动态修改
 * - 无需重启服务即可生效
 */
export const systemConfig = mysqlTable("system_config", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 配置键（唯一）
  // 如：cache_days, api_budget_limit
  configKey: varchar("configKey", { length: 64 }).notNull().unique(),

  // 配置值
  configValue: varchar("configValue", { length: 255 }).notNull(),

  // 配置描述
  description: varchar("description", { length: 255 }),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出系统配置表的类型
export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;


// ============================================================
// 缓存预热任务表 (cache_warmup_tasks)
// ============================================================

/**
 * 缓存预热任务表 - 存储批量缓存预热任务
 * 
 * 用途：
 * - 记录批量预热任务的状态和进度
 * - 存储待预热的企业名称列表
 * - 跟踪预热成功和失败的企业
 * 
 * 工作流程：
 * 1. 用户上传企业名单或从园区企业选择
 * 2. 系统创建预热任务，状态为pending
 * 3. 后台逐个查询企业信息并缓存
 * 4. 更新进度，完成后状态变为completed
 */
export const cacheWarmupTasks = mysqlTable("cache_warmup_tasks", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 总任务数（需要预热的企业数量）
  totalCount: int("totalCount").notNull().default(0),

  // 已完成数量（成功缓存的企业数）
  completedCount: int("completedCount").notNull().default(0),

  // 跳过数量（已有缓存的企业数）
  skippedCount: int("skippedCount").notNull().default(0),

  // 失败数量
  failedCount: int("failedCount").notNull().default(0),

  // 任务状态
  // pending: 等待中
  // processing: 处理中
  // completed: 已完成
  // failed: 失败
  // cancelled: 已取消
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending").notNull(),

  // 企业名称列表（JSON数组格式）
  companyNames: text("companyNames"),

  // 成功预热的企业列表（JSON数组格式）
  successList: text("successList"),

  // 失败的企业列表（JSON数组格式，包含企业名和错误原因）
  failedList: text("failedList"),

  // 错误信息（如果任务失败）
  errorMessage: text("errorMessage"),

  // 预估节省费用（元）
  estimatedSavings: varchar("estimatedSavings", { length: 32 }),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // 完成时间
  completedAt: timestamp("completedAt"),
});

// 导出缓存预热任务表的类型
export type CacheWarmupTask = typeof cacheWarmupTasks.$inferSelect;
export type InsertCacheWarmupTask = typeof cacheWarmupTasks.$inferInsert;


// ============================================================
// 企查查API配置表 (qichacha_api_config)
// ============================================================

/**
 * 企查查API配置表 - 存储企查查各API接口的配置信息
 * 
 * 用途：
 * - 统一管理所有企查查API的端点URL
 * - 方便维护和问题定位（无需修改代码即可调整API端点）
 * - 记录每个API的费用信息
 * 
 * 使用方法：
 * 1. 系统启动时自动初始化默认配置
 * 2. 可在设置页面查看和修改API端点
 * 3. API调用时从此表读取端点URL
 */
export const qichachaApiConfig = mysqlTable("qichacha_api_config", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // API代码（企查查官方定义，如：730、731、732等）
  // 作为唯一标识
  apiCode: varchar("apiCode", { length: 32 }).notNull().unique(),

  // API名称（中文描述）
  // 如：企业模糊搜索、企业工商详情、股东信息等
  apiName: varchar("apiName", { length: 128 }).notNull(),

  // API端点路径（不含基础URL）
  // 如：FuzzySearch/GetList、ECIV4/GetDetailsByName
  endpoint: varchar("endpoint", { length: 255 }).notNull(),

  // 单次调用费用（元）
  // 如：0.10、0.15、1.00
  cost: varchar("cost", { length: 32 }),

  // API描述（详细说明）
  description: text("description"),

  // 请求方法（GET/POST）
  // 默认GET
  method: varchar("method", { length: 16 }).default("GET"),

  // 主要参数名称（用于构建请求）
  // 如：searchKey、keyNo、keyword
  primaryParam: varchar("primaryParam", { length: 64 }),

  // 是否启用
  // true: 启用此API
  // false: 禁用此API（调用时跳过）
  isEnabled: boolean("isEnabled").default(true).notNull(),

  // 排序顺序（用于设置页面显示）
  sortOrder: int("sortOrder").default(0),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出企查查API配置表的类型
export type QichachaApiConfig = typeof qichachaApiConfig.$inferSelect;
export type InsertQichachaApiConfig = typeof qichachaApiConfig.$inferInsert;


// ============================================================
// 系统级LLM配置表 (llm_configs)
// ============================================================

/**
 * 系统级LLM配置表 - 存储各大模型提供商的API配置
 * 
 * 用途：
 * - 存储系统级的LLM提供商配置
 * - 加密存储API Key和Secret Key
 * - 管理员在设置页面配置，所有用户共用
 * 
 * 安全说明：
 * - API Key使用AES-256-GCM加密存储
 * - 加密密钥从环境变量JWT_SECRET派生
 * - 解密只在服务端进行
 */
export const llmConfigs = mysqlTable("llm_configs", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // LLM提供商（zhipu/wenxin/qwen）（唯一）
  provider: varchar("provider", { length: 32 }).notNull().unique(),

  // 提供商显示名称
  providerName: varchar("providerName", { length: 64 }).notNull(),

  // 默认模型ID
  // 如：glm-4.7、ernie-4.5-8k-preview
  defaultModel: varchar("defaultModel", { length: 64 }).notNull(),

  // 加密后的API Key
  // 使用AES-256-GCM加密
  encryptedApiKey: text("encryptedApiKey"),

  // 加密后的Secret Key（百度文心一言需要）
  encryptedApiSecret: text("encryptedApiSecret"),

  // 加密使用的IV（初始化向量）
  encryptionIv: varchar("encryptionIv", { length: 64 }),

  // 是否启用
  isEnabled: boolean("isEnabled").default(false).notNull(),

  // 是否为默认提供商
  isDefault: boolean("isDefault").default(false).notNull(),

  // 创建时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  // 更新时间
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 导出系统级LLM配置表的类型
export type LlmConfig = typeof llmConfigs.$inferSelect;
export type InsertLlmConfig = typeof llmConfigs.$inferInsert;

// 保留旧表名别名以兼容现有代码
export const userLlmConfigs = llmConfigs;
export type UserLlmConfig = LlmConfig;
export type InsertUserLlmConfig = InsertLlmConfig;


// ============================================================
// 登录日志表 (login_logs)
// ============================================================

/**
 * 登录日志表 - 记录用户登录历史
 * 
 * 用途：
 * - 记录用户登录时间、IP地址等信息
 * - 便于安全审计和异常登录检测
 * - 支持查看用户登录历史
 */
export const loginLogs = mysqlTable("login_logs", {
  // 自增主键ID
  id: int("id").autoincrement().primaryKey(),

  // 用户ID（关联users表）
  userId: int("userId").notNull(),

  // 用户手机号（冗余存储，便于查询）
  phone: varchar("phone", { length: 20 }),

  // 用户名称（冗余存储，便于查询）
  userName: varchar("userName", { length: 255 }),

  // 登录IP地址
  ipAddress: varchar("ipAddress", { length: 64 }),

  // 用户代理（浏览器信息）
  userAgent: text("userAgent"),

  // 登录状态：success（成功）、failed（失败）
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),

  // 失败原因（登录失败时记录）
  failReason: varchar("failReason", { length: 255 }),

  // 登录时间
  loginTime: timestamp("loginTime").defaultNow().notNull(),
});

// 导出登录日志表的类型
export type LoginLog = typeof loginLogs.$inferSelect;
export type InsertLoginLog = typeof loginLogs.$inferInsert;
