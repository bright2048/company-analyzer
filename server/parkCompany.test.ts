import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createParkCompany: vi.fn().mockResolvedValue(1),
  createParkCompanies: vi.fn().mockResolvedValue(2),
  getParkCompanies: vi.fn().mockResolvedValue([
    {
      id: 1,
      companyName: "测试公司A",
      industry: "科技",
      businessScope: "软件开发",
      registeredCapital: "1000万",
      establishedDate: "2020-01-01",
      contactPerson: "张三",
      contactPhone: "13800138000",
      contactEmail: "test@example.com",
      officeArea: "500平米",
      employeeCount: 50,
      tags: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getParkCompanyById: vi.fn().mockResolvedValue({
    id: 1,
    companyName: "测试公司A",
    industry: "科技",
  }),
  searchParkCompanies: vi.fn().mockResolvedValue([]),
  updateParkCompany: vi.fn().mockResolvedValue(undefined),
  deleteParkCompany: vi.fn().mockResolvedValue(undefined),
  getParkCompaniesCount: vi.fn().mockResolvedValue(1),
  getAllParkCompanyNames: vi.fn().mockResolvedValue([
    { id: 1, companyName: "测试公司A", industry: "科技", businessScope: "软件开发" },
  ]),
  createCompanyReport: vi.fn().mockResolvedValue(1),
  getCompanyReports: vi.fn().mockResolvedValue([]),
  getCompanyReportById: vi.fn().mockResolvedValue(null),
  updateCompanyReport: vi.fn().mockResolvedValue(undefined),
  deleteCompanyReport: vi.fn().mockResolvedValue(undefined),
  getDataSourceConfigs: vi.fn().mockResolvedValue([]),
  getActiveDataSource: vi.fn().mockResolvedValue(null),
  upsertDataSourceConfig: vi.fn().mockResolvedValue(undefined),
  setActiveDataSource: vi.fn().mockResolvedValue(undefined),
  // 系统级LLM配置函数
  getLlmConfig: vi.fn().mockResolvedValue(null),
  saveLlmConfig: vi.fn().mockResolvedValue(undefined),
  getAllLlmConfigs: vi.fn().mockResolvedValue([]),
  getEnabledLlmProviders: vi.fn().mockResolvedValue([]),
  getDefaultLlmConfig: vi.fn().mockResolvedValue(null),
  setDefaultLlmProvider: vi.fn().mockResolvedValue(true),
  // 用户认证相关函数
  verifyUserByPhone: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({ id: 1 }),
  batchCreateUsers: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getUsersCount: vi.fn().mockResolvedValue(0),
  updateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  incrementUserReportUsed: vi.fn().mockResolvedValue(true),
  checkUserQuota: vi.fn().mockResolvedValue({ hasQuota: true, remaining: 50, used: 0, total: 50 }),
  resetUserPassword: vi.fn().mockResolvedValue({ success: true, newPassword: '123456' }),
  getUserById: vi.fn().mockResolvedValue(null),
}));

function createTestContext(withUser: boolean = false): TrpcContext {
  return {
    user: withUser ? {
      id: 1,
      openId: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      phone: '13800138000',
      loginMethod: 'oauth',
      role: 'user' as const,
      reportQuota: 50,
      reportUsed: 0,
      preferredLlm: 'zhipu',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("parkCompany router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list park companies", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.list({ limit: 100, offset: 0 });

    expect(result).toHaveProperty("companies");
    expect(result).toHaveProperty("total");
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].companyName).toBe("测试公司A");
  });

  it("should get park company by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.getById({ id: 1 });

    expect(result).not.toBeNull();
    expect(result?.companyName).toBe("测试公司A");
  });

  it("should create a park company", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.create({
      companyName: "新公司",
      industry: "互联网",
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("should update a park company", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.update({
      id: 1,
      companyName: "更新后的公司名",
    });

    expect(result).toEqual({ success: true });
  });

  it("should delete a park company", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.delete({ id: 1 });

    expect(result).toEqual({ success: true });
  });

  it("should get all company names for matching", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.parkCompany.getAllNames();

    expect(result).toHaveLength(1);
    expect(result[0].companyName).toBe("测试公司A");
  });
});

describe("report router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a report", async () => {
    // report.create 现在需要用户认证
    const ctx = createTestContext(true);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.report.create({ companyName: "华为技术有限公司" });

    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("should list reports", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.report.list({ limit: 50, offset: 0 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should delete a report", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.report.delete({ id: 1 });

    expect(result).toEqual({ success: true });
  });
});

describe("dataSource router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list data source configs", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dataSource.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should update data source config", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dataSource.update({
      sourceType: "tianyancha",
      apiKey: "test-key",
      isEnabled: true,
    });

    expect(result).toEqual({ success: true });
  });

  it("should set active data source", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dataSource.setActive({ sourceType: "web" });

    expect(result).toEqual({ success: true });
  });
});
