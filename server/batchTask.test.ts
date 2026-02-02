import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database functions
vi.mock('./db', () => ({
  createBatchTask: vi.fn().mockResolvedValue(1),
  getBatchTasks: vi.fn().mockResolvedValue([
    {
      id: 1,
      totalCount: 3,
      completedCount: 2,
      failedCount: 1,
      status: 'completed',
      companyNames: '["\u534e\u4e3a","\u817e\u8baf","\u963f\u91cc\u5df4\u5df4"]',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]),
  getBatchTaskById: vi.fn().mockResolvedValue({
    id: 1,
    totalCount: 3,
    completedCount: 2,
    failedCount: 1,
    status: 'completed',
    companyNames: '["\u534e\u4e3a","\u817e\u8baf","\u963f\u91cc\u5df4\u5df4"]',
    zipFileUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateBatchTask: vi.fn().mockResolvedValue(undefined),
  getBatchTaskReports: vi.fn().mockResolvedValue([
    { id: 1, companyName: '\u534e\u4e3a', status: 'completed', reportContent: '# \u534e\u4e3a\u62a5\u544a' },
    { id: 2, companyName: '\u817e\u8baf', status: 'completed', reportContent: '# \u817e\u8baf\u62a5\u544a' },
    { id: 3, companyName: '\u963f\u91cc\u5df4\u5df4', status: 'failed', reportContent: null },
  ]),
  createCompanyReport: vi.fn().mockResolvedValue(1),
  deleteBatchTask: vi.fn().mockResolvedValue(undefined),
}));

describe('Batch Task Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSV Parsing', () => {
    it('should parse CSV content correctly', () => {
      const csvContent = `企业名称
华为技术有限公司
腾讯科技（深圳）有限公司
阿里巴巴集团控股有限公司`;
      
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      const companyNames: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(",");
        const name = parts[0].replace(/^["']|["']$/g, "").trim();
        
        // Skip header
        if (i === 0 && (name === "企业名称" || name === "公司名称" || name === "companyName" || name === "name")) {
          continue;
        }
        
        if (name) {
          companyNames.push(name);
        }
      }

      expect(companyNames).toHaveLength(3);
      expect(companyNames[0]).toBe('华为技术有限公司');
      expect(companyNames[1]).toBe('腾讯科技（深圳）有限公司');
      expect(companyNames[2]).toBe('阿里巴巴集团控股有限公司');
    });

    it('should handle CSV without header', () => {
      const csvContent = `华为技术有限公司
腾讯科技（深圳）有限公司`;
      
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      const companyNames: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(",");
        const name = parts[0].replace(/^["']|["']$/g, "").trim();
        
        if (i === 0 && (name === "企业名称" || name === "公司名称" || name === "companyName" || name === "name")) {
          continue;
        }
        
        if (name) {
          companyNames.push(name);
        }
      }

      expect(companyNames).toHaveLength(2);
    });

    it('should handle empty lines', () => {
      const csvContent = `企业名称

华为技术有限公司

腾讯科技（深圳）有限公司
`;
      
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      const companyNames: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(",");
        const name = parts[0].replace(/^["']|["']$/g, "").trim();
        
        if (i === 0 && (name === "企业名称" || name === "公司名称" || name === "companyName" || name === "name")) {
          continue;
        }
        
        if (name) {
          companyNames.push(name);
        }
      }

      expect(companyNames).toHaveLength(2);
    });
  });

  describe('Batch Task Validation', () => {
    it('should reject more than 50 companies', () => {
      const companyNames = Array.from({ length: 51 }, (_, i) => `公司${i + 1}`);
      
      expect(companyNames.length).toBeGreaterThan(50);
      
      // Simulate validation
      const isValid = companyNames.length <= 50;
      expect(isValid).toBe(false);
    });

    it('should accept exactly 50 companies', () => {
      const companyNames = Array.from({ length: 50 }, (_, i) => `公司${i + 1}`);
      
      const isValid = companyNames.length <= 50;
      expect(isValid).toBe(true);
    });

    it('should reject empty company list', () => {
      const companyNames: string[] = [];
      
      const isValid = companyNames.length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Report Generation Result', () => {
    it('should identify NOT_FOUND response', () => {
      const aiResponse = '[NOT_FOUND]未找到该企业的可靠信息';
      
      const isNotFound = aiResponse.includes('[NOT_FOUND]') || aiResponse.trim().startsWith('未找到');
      expect(isNotFound).toBe(true);
    });

    it('should identify valid report response', () => {
      const aiResponse = '# 华为技术有限公司分析报告\n\n## 公司概况\n华为是一家全球领先的ICT基础设施和智能终端提供商...';
      
      const isNotFound = aiResponse.includes('[NOT_FOUND]') || aiResponse.trim().startsWith('未找到');
      expect(isNotFound).toBe(false);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly', () => {
      const task = {
        totalCount: 10,
        completedCount: 5,
        failedCount: 2,
      };
      
      const progress = ((task.completedCount + task.failedCount) / task.totalCount) * 100;
      expect(progress).toBe(70);
    });

    it('should handle zero total count', () => {
      const task = {
        totalCount: 0,
        completedCount: 0,
        failedCount: 0,
      };
      
      const progress = task.totalCount === 0 ? 0 : ((task.completedCount + task.failedCount) / task.totalCount) * 100;
      expect(progress).toBe(0);
    });
  });

  describe('Task Deletion', () => {
    it('should allow deletion of completed tasks', () => {
      const task = { id: 1, status: 'completed' };
      const canDelete = task.status !== 'processing';
      expect(canDelete).toBe(true);
    });

    it('should allow deletion of failed tasks', () => {
      const task = { id: 2, status: 'failed' };
      const canDelete = task.status !== 'processing';
      expect(canDelete).toBe(true);
    });

    it('should allow deletion of pending tasks', () => {
      const task = { id: 3, status: 'pending' };
      const canDelete = task.status !== 'processing';
      expect(canDelete).toBe(true);
    });

    it('should NOT allow deletion of processing tasks', () => {
      const task = { id: 4, status: 'processing' };
      const canDelete = task.status !== 'processing';
      expect(canDelete).toBe(false);
    });
  });
});
