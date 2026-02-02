import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    recordApiCall: vi.fn(),
    getApiCallStats: vi.fn(),
    getRecentApiCalls: vi.fn(),
    getTodayApiStats: vi.fn(),
    getMonthlyApiStats: vi.fn(),
  };
});

describe("API调用统计功能", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordApiCall - 记录API调用", () => {
    it("应该成功记录企查查API调用", async () => {
      const mockRecord = {
        id: 1,
        apiType: "qichacha_search",
        apiName: "企业模糊搜索",
        status: "success" as const,
        cost: "0.10",
        companyName: "华为技术有限公司",
        calledAt: new Date(),
      };
      
      vi.mocked(db.recordApiCall).mockResolvedValue(mockRecord);
      
      const result = await db.recordApiCall({
        apiType: "qichacha_search",
        apiName: "企业模糊搜索",
        status: "success",
        cost: "0.10",
        companyName: "华为技术有限公司",
      });
      
      expect(result).toBeDefined();
      expect(result?.apiType).toBe("qichacha_search");
      expect(result?.cost).toBe("0.10");
    });

    it("应该成功记录LLM API调用", async () => {
      const mockRecord = {
        id: 2,
        apiType: "llm_report",
        apiName: "报告生成",
        status: "success" as const,
        cost: "0.05",
        companyName: "腾讯科技",
        calledAt: new Date(),
      };
      
      vi.mocked(db.recordApiCall).mockResolvedValue(mockRecord);
      
      const result = await db.recordApiCall({
        apiType: "llm_report",
        apiName: "报告生成",
        status: "success",
        cost: "0.05",
        companyName: "腾讯科技",
      });
      
      expect(result).toBeDefined();
      expect(result?.apiType).toBe("llm_report");
    });

    it("应该记录失败的API调用", async () => {
      const mockRecord = {
        id: 3,
        apiType: "qichacha_detail",
        apiName: "企业详情",
        status: "failed" as const,
        cost: null,
        companyName: "测试公司",
        errorMessage: "API调用超时",
        calledAt: new Date(),
      };
      
      vi.mocked(db.recordApiCall).mockResolvedValue(mockRecord);
      
      const result = await db.recordApiCall({
        apiType: "qichacha_detail",
        apiName: "企业详情",
        status: "failed",
        companyName: "测试公司",
        errorMessage: "API调用超时",
      });
      
      expect(result).toBeDefined();
      expect(result?.status).toBe("failed");
      expect(result?.errorMessage).toBe("API调用超时");
    });
  });

  describe("getTodayApiStats - 获取今日统计", () => {
    it("应该返回今日API调用统计", async () => {
      const mockStats = {
        total: 50,
        success: 48,
        failed: 2,
        totalCost: 5.50,
        byType: [
          { apiType: "qichacha_search", apiName: "企业模糊搜索", count: 30, success: 29, failed: 1, cost: 3.00 },
          { apiType: "llm_report", apiName: "报告生成", count: 20, success: 19, failed: 1, cost: 2.50 },
        ],
      };
      
      vi.mocked(db.getTodayApiStats).mockResolvedValue(mockStats);
      
      const result = await db.getTodayApiStats();
      
      expect(result.total).toBe(50);
      expect(result.success).toBe(48);
      expect(result.totalCost).toBe(5.50);
      expect(result.byType).toHaveLength(2);
    });

    it("应该在无数据时返回零值", async () => {
      const mockStats = {
        total: 0,
        success: 0,
        failed: 0,
        totalCost: 0,
        byType: [],
      };
      
      vi.mocked(db.getTodayApiStats).mockResolvedValue(mockStats);
      
      const result = await db.getTodayApiStats();
      
      expect(result.total).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe("getMonthlyApiStats - 获取月度统计", () => {
    it("应该返回指定月份的统计数据", async () => {
      const mockStats = {
        total: 1000,
        success: 980,
        failed: 20,
        totalCost: 120.50,
        byType: [
          { apiType: "qichacha_search", apiName: "企业模糊搜索", count: 600, success: 590, failed: 10, cost: 60.00 },
          { apiType: "qichacha_detail", apiName: "企业详情", count: 200, success: 195, failed: 5, cost: 40.00 },
          { apiType: "llm_report", apiName: "报告生成", count: 200, success: 195, failed: 5, cost: 20.50 },
        ],
      };
      
      vi.mocked(db.getMonthlyApiStats).mockResolvedValue(mockStats);
      
      const result = await db.getMonthlyApiStats(2024, 12);
      
      expect(result.total).toBe(1000);
      expect(result.totalCost).toBe(120.50);
      expect(result.byType).toHaveLength(3);
    });
  });

  describe("getRecentApiCalls - 获取最近调用记录", () => {
    it("应该返回最近的API调用记录", async () => {
      const mockCalls = [
        {
          id: 100,
          apiType: "qichacha_search",
          apiName: "企业模糊搜索",
          status: "success" as const,
          cost: "0.10",
          companyName: "华为技术有限公司",
          reportId: null,
          requestParams: null,
          responseSummary: null,
          errorMessage: null,
          calledAt: new Date(),
        },
        {
          id: 99,
          apiType: "llm_report",
          apiName: "报告生成",
          status: "success" as const,
          cost: "0.05",
          companyName: "腾讯科技",
          reportId: 1,
          requestParams: null,
          responseSummary: null,
          errorMessage: null,
          calledAt: new Date(),
        },
      ];
      
      vi.mocked(db.getRecentApiCalls).mockResolvedValue(mockCalls);
      
      const result = await db.getRecentApiCalls(50);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(100);
      expect(result[0].apiType).toBe("qichacha_search");
    });

    it("应该限制返回记录数量", async () => {
      const mockCalls = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        apiType: "qichacha_search",
        apiName: "企业模糊搜索",
        status: "success" as const,
        cost: "0.10",
        companyName: `公司${i + 1}`,
        reportId: null,
        requestParams: null,
        responseSummary: null,
        errorMessage: null,
        calledAt: new Date(),
      }));
      
      vi.mocked(db.getRecentApiCalls).mockResolvedValue(mockCalls);
      
      const result = await db.getRecentApiCalls(10);
      
      expect(result).toHaveLength(10);
    });
  });

  describe("getApiCallStats - 获取统计汇总", () => {
    it("应该返回总体统计汇总", async () => {
      const mockStats = {
        total: 5000,
        success: 4900,
        failed: 100,
        totalCost: 500.00,
        byType: [
          { apiType: "qichacha_search", count: 3000, success: 2950, failed: 50, cost: 300.00 },
          { apiType: "qichacha_detail", count: 1000, success: 980, failed: 20, cost: 150.00 },
          { apiType: "llm_report", count: 1000, success: 970, failed: 30, cost: 50.00 },
        ],
      };
      
      vi.mocked(db.getApiCallStats).mockResolvedValue(mockStats);
      
      const result = await db.getApiCallStats();
      
      expect(result.total).toBe(5000);
      expect(result.totalCost).toBe(500.00);
      expect(result.byType).toHaveLength(3);
    });
  });
});
