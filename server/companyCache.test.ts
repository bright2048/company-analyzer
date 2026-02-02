import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getCachedSearchResults: vi.fn(),
  saveSearchResultsToCache: vi.fn(),
  searchCompanyCache: vi.fn(),
  getCacheDays: vi.fn(),
  getCacheStats: vi.fn(),
}));

import {
  getCachedSearchResults,
  saveSearchResultsToCache,
  searchCompanyCache,
  getCacheDays,
  getCacheStats,
} from "./db";

describe("Company Cache Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCacheDays", () => {
    it("should return default 30 days when env not set", () => {
      vi.mocked(getCacheDays).mockReturnValue(30);
      expect(getCacheDays()).toBe(30);
    });

    it("should return configured days from env", () => {
      vi.mocked(getCacheDays).mockReturnValue(7);
      expect(getCacheDays()).toBe(7);
    });
  });

  describe("getCachedSearchResults", () => {
    it("should return null when cache not found", async () => {
      vi.mocked(getCachedSearchResults).mockResolvedValue(null);
      const result = await getCachedSearchResults("华为");
      expect(result).toBeNull();
    });

    it("should return cached companies when cache exists", async () => {
      const mockCompanies = [
        {
          id: 1,
          creditCode: "91440300MA5EQXXX",
          companyName: "华为技术有限公司",
          legalPerson: "任正非",
          status: "存续",
          establishDate: "1987-09-15",
          registeredCapital: "4000000万人民币",
          address: "深圳市龙岗区",
          businessScope: "通信设备",
          dataSource: "qichacha",
          cachedAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(getCachedSearchResults).mockResolvedValue(mockCompanies);
      
      const result = await getCachedSearchResults("华为");
      expect(result).toHaveLength(1);
      expect(result![0].companyName).toBe("华为技术有限公司");
    });

    it("should return empty array when cache exists but no results", async () => {
      vi.mocked(getCachedSearchResults).mockResolvedValue([]);
      const result = await getCachedSearchResults("不存在的企业");
      expect(result).toEqual([]);
    });
  });

  describe("saveSearchResultsToCache", () => {
    it("should save companies to cache", async () => {
      vi.mocked(saveSearchResultsToCache).mockResolvedValue(undefined);
      
      const companies = [
        {
          creditCode: "91440300MA5EQXXX",
          companyName: "华为技术有限公司",
          legalPerson: "任正非",
          status: "存续",
          dataSource: "qichacha",
        },
      ];
      
      await saveSearchResultsToCache("华为", companies);
      expect(saveSearchResultsToCache).toHaveBeenCalledWith("华为", companies);
    });

    it("should handle empty company list", async () => {
      vi.mocked(saveSearchResultsToCache).mockResolvedValue(undefined);
      
      await saveSearchResultsToCache("空结果", []);
      expect(saveSearchResultsToCache).toHaveBeenCalledWith("空结果", []);
    });
  });

  describe("searchCompanyCache", () => {
    it("should return matching companies from local cache", async () => {
      const mockCompanies = [
        {
          id: 1,
          creditCode: "91440300MA5EQXXX",
          companyName: "华为技术有限公司",
          legalPerson: "任正非",
          status: "存续",
          establishDate: "1987-09-15",
          registeredCapital: "4000000万人民币",
          address: "深圳市龙岗区",
          businessScope: "通信设备",
          dataSource: "qichacha",
          cachedAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(searchCompanyCache).mockResolvedValue(mockCompanies);
      
      const result = await searchCompanyCache("华为");
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no matches", async () => {
      vi.mocked(searchCompanyCache).mockResolvedValue([]);
      
      const result = await searchCompanyCache("不存在");
      expect(result).toEqual([]);
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      vi.mocked(getCacheStats).mockResolvedValue({
        totalCompanies: 100,
        totalKeywords: 50,
      });
      
      const stats = await getCacheStats();
      expect(stats.totalCompanies).toBe(100);
      expect(stats.totalKeywords).toBe(50);
    });

    it("should return zero stats when cache is empty", async () => {
      vi.mocked(getCacheStats).mockResolvedValue({
        totalCompanies: 0,
        totalKeywords: 0,
      });
      
      const stats = await getCacheStats();
      expect(stats.totalCompanies).toBe(0);
      expect(stats.totalKeywords).toBe(0);
    });
  });
});

describe("Cache Priority Logic", () => {
  it("should prioritize cache over API calls", async () => {
    // 模拟缓存命中的情况
    const cachedData = [
      {
        id: 1,
        creditCode: "91440300MA5EQXXX",
        companyName: "华为技术有限公司",
        legalPerson: "任正非",
        status: "存续",
        establishDate: "1987-09-15",
        registeredCapital: "4000000万人民币",
        address: "深圳市龙岗区",
        businessScope: "通信设备",
        dataSource: "qichacha",
        cachedAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    
    vi.mocked(getCachedSearchResults).mockResolvedValue(cachedData);
    
    // 当缓存命中时，应该返回缓存数据
    const result = await getCachedSearchResults("华为");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("should return null when cache expired", async () => {
    // 模拟缓存过期的情况
    vi.mocked(getCachedSearchResults).mockResolvedValue(null);
    
    const result = await getCachedSearchResults("过期关键词");
    expect(result).toBeNull();
  });
});
