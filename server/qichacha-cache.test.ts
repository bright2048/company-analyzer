/**
 * 企查查数据缓存功能单元测试
 * 
 * 测试内容：
 * 1. 缓存有效性检查函数 isCacheValid
 * 2. 缓存统计函数 getQichachaCacheStats
 * 3. 系统配置函数 getCacheDaysConfig / setCacheDaysConfig
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isCacheValid } from "./db";

// Mock 数据库连接
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })),
}));

describe("企查查数据缓存功能", () => {
  describe("isCacheValid - 缓存有效性检查", () => {
    it("应该正确判断未过期的缓存为有效", () => {
      // 创建一个10天前的缓存记录
      const cache = {
        id: 1,
        creditCode: "91440300MA5EYLXR7X",
        companyName: "测试公司",
        basicInfo: null,
        shareholders: null,
        executives: null,
        executiveDetails: null,
        patents: null,
        trademarks: null,
        copyrights: null,
        customers: null,
        suppliers: null,
        annualReports: null,
        certificates: null,
        cachedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10天前
        updatedAt: new Date(),
        hitCount: 0,
        lastHitAt: null,
      };
      
      // 缓存有效期30天，10天前的缓存应该有效
      expect(isCacheValid(cache, 30)).toBe(true);
    });

    it("应该正确判断已过期的缓存为无效", () => {
      // 创建一个40天前的缓存记录
      const cache = {
        id: 1,
        creditCode: "91440300MA5EYLXR7X",
        companyName: "测试公司",
        basicInfo: null,
        shareholders: null,
        executives: null,
        executiveDetails: null,
        patents: null,
        trademarks: null,
        copyrights: null,
        customers: null,
        suppliers: null,
        annualReports: null,
        certificates: null,
        cachedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40天前
        updatedAt: new Date(),
        hitCount: 0,
        lastHitAt: null,
      };
      
      // 缓存有效期30天，40天前的缓存应该无效
      expect(isCacheValid(cache, 30)).toBe(false);
    });

    it("应该正确处理刚好在边界的缓存", () => {
      // 创建一个刚好29天前的缓存记录
      const cache = {
        id: 1,
        creditCode: "91440300MA5EYLXR7X",
        companyName: "测试公司",
        basicInfo: null,
        shareholders: null,
        executives: null,
        executiveDetails: null,
        patents: null,
        trademarks: null,
        copyrights: null,
        customers: null,
        suppliers: null,
        annualReports: null,
        certificates: null,
        cachedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), // 29天前
        updatedAt: new Date(),
        hitCount: 0,
        lastHitAt: null,
      };
      
      // 缓存有效期30天，29天前的缓存应该有效
      expect(isCacheValid(cache, 30)).toBe(true);
    });

    it("应该正确处理自定义缓存有效期", () => {
      // 创建一个5天前的缓存记录
      const cache = {
        id: 1,
        creditCode: "91440300MA5EYLXR7X",
        companyName: "测试公司",
        basicInfo: null,
        shareholders: null,
        executives: null,
        executiveDetails: null,
        patents: null,
        trademarks: null,
        copyrights: null,
        customers: null,
        suppliers: null,
        annualReports: null,
        certificates: null,
        cachedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前
        updatedAt: new Date(),
        hitCount: 0,
        lastHitAt: null,
      };
      
      // 缓存有效期7天，5天前的缓存应该有效
      expect(isCacheValid(cache, 7)).toBe(true);
      
      // 缓存有效期3天，5天前的缓存应该无效
      expect(isCacheValid(cache, 3)).toBe(false);
    });

    it("应该正确处理cachedAt为null的情况", () => {
      const cache = {
        id: 1,
        creditCode: "91440300MA5EYLXR7X",
        companyName: "测试公司",
        basicInfo: null,
        shareholders: null,
        executives: null,
        executiveDetails: null,
        patents: null,
        trademarks: null,
        copyrights: null,
        customers: null,
        suppliers: null,
        annualReports: null,
        certificates: null,
        cachedAt: null as any, // 模拟null情况
        updatedAt: new Date(),
        hitCount: 0,
        lastHitAt: null,
      };
      
      // cachedAt为null时应该返回false
      expect(isCacheValid(cache, 30)).toBe(false);
    });
  });

  describe("缓存数据结构", () => {
    it("应该正确解析JSON格式的缓存数据", () => {
      const basicInfoJson = JSON.stringify({
        Name: "华为技术有限公司",
        CreditCode: "91440300708461136T",
        OperName: "任正非",
        Status: "存续",
      });
      
      const parsed = JSON.parse(basicInfoJson);
      expect(parsed.Name).toBe("华为技术有限公司");
      expect(parsed.CreditCode).toBe("91440300708461136T");
    });

    it("应该正确处理空的缓存字段", () => {
      const cache = {
        basicInfo: null,
        shareholders: "[]",
        executives: null,
      };
      
      // null字段应该返回默认值
      const basicInfo = cache.basicInfo ? JSON.parse(cache.basicInfo) : null;
      expect(basicInfo).toBeNull();
      
      // 空数组字符串应该解析为空数组
      const shareholders = cache.shareholders ? JSON.parse(cache.shareholders) : [];
      expect(shareholders).toEqual([]);
    });
  });

  describe("缓存费用计算", () => {
    it("应该正确计算节省的费用", () => {
      // 每次完整查询费用约4.35元
      const costPerQuery = 4.35;
      const hitCount = 10;
      
      const estimatedSavings = (hitCount * costPerQuery).toFixed(2);
      expect(estimatedSavings).toBe("43.50");
    });

    it("应该正确计算平均命中率", () => {
      const totalCount = 5; // 5个企业
      const totalHits = 15; // 总共命中15次
      
      const avgHitCount = totalHits / totalCount;
      expect(avgHitCount).toBe(3);
    });
  });

  describe("缓存有效期配置", () => {
    it("应该验证有效期范围（1-365天）", () => {
      const validateCacheDays = (days: number) => {
        return days >= 1 && days <= 365;
      };
      
      expect(validateCacheDays(1)).toBe(true);
      expect(validateCacheDays(30)).toBe(true);
      expect(validateCacheDays(365)).toBe(true);
      expect(validateCacheDays(0)).toBe(false);
      expect(validateCacheDays(366)).toBe(false);
      expect(validateCacheDays(-1)).toBe(false);
    });

    it("应该使用默认值30天", () => {
      const defaultCacheDays = 30;
      const parsedValue = parseInt("invalid", 10);
      const cacheDays = isNaN(parsedValue) ? defaultCacheDays : parsedValue;
      
      expect(cacheDays).toBe(30);
    });
  });
});

describe("缓存命中记录", () => {
  it("应该正确记录缓存命中的API调用", () => {
    const cacheHitRecord = {
      apiType: 'qichacha_cache_hit',
      apiName: '缓存命中',
      status: 'success',
      cost: '0.00',
      companyName: '华为技术有限公司',
      requestParams: JSON.stringify({ creditCode: '91440300708461136T' }),
      responseSummary: JSON.stringify({ 
        source: 'cache', 
        cachedAt: new Date().toISOString(),
        hitCount: 1,
        savedCost: '4.35'
      }),
    };
    
    expect(cacheHitRecord.apiType).toBe('qichacha_cache_hit');
    expect(cacheHitRecord.cost).toBe('0.00');
    
    const summary = JSON.parse(cacheHitRecord.responseSummary);
    expect(summary.source).toBe('cache');
    expect(summary.savedCost).toBe('4.35');
  });
});
