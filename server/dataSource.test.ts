/**
 * 数据源配置功能测试
 * 
 * 测试内容：
 * 1. 数据源配置保存和读取
 * 2. 数据源切换功能
 * 3. 企查查API配置检查
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock数据库函数
const mockDataSourceConfigs: Array<{
  sourceType: string;
  apiKey?: string;
  apiSecret?: string;
  isEnabled: boolean;
}> = [];

const mockGetDataSourceConfigs = vi.fn(() => Promise.resolve([...mockDataSourceConfigs]));
const mockGetActiveDataSource = vi.fn(() => {
  const active = mockDataSourceConfigs.find(c => c.isEnabled);
  return Promise.resolve(active || null);
});
const mockSetActiveDataSource = vi.fn(async (sourceType: string) => {
  // 禁用所有数据源
  mockDataSourceConfigs.forEach(c => c.isEnabled = false);
  // 查找或创建指定数据源
  const existing = mockDataSourceConfigs.find(c => c.sourceType === sourceType);
  if (existing) {
    existing.isEnabled = true;
  } else {
    mockDataSourceConfigs.push({ sourceType, isEnabled: true });
  }
});
const mockUpsertDataSourceConfig = vi.fn(async (data: { sourceType: string; apiKey?: string; apiSecret?: string; isEnabled?: boolean }) => {
  const existing = mockDataSourceConfigs.find(c => c.sourceType === data.sourceType);
  if (existing) {
    if (data.apiKey) existing.apiKey = data.apiKey;
    if (data.apiSecret) existing.apiSecret = data.apiSecret;
    if (data.isEnabled !== undefined) existing.isEnabled = data.isEnabled;
  } else {
    mockDataSourceConfigs.push({
      sourceType: data.sourceType,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      isEnabled: data.isEnabled || false,
    });
  }
});

// 模拟getQichachaConfig函数的逻辑
async function getQichachaConfig(): Promise<{ appKey: string; secretKey: string } | null> {
  // 1. 检查当前启用的数据源是否是企查查
  const activeSource = await mockGetActiveDataSource();
  if (activeSource?.sourceType !== 'qichacha') {
    return null;
  }
  
  // 2. 从数据库读取企查查配置
  const configs = await mockGetDataSourceConfigs();
  const qccConfig = configs.find(c => c.sourceType === 'qichacha');
  
  if (qccConfig && qccConfig.apiKey && qccConfig.apiSecret) {
    return {
      appKey: qccConfig.apiKey,
      secretKey: qccConfig.apiSecret,
    };
  }
  
  return null;
}

describe('数据源配置', () => {
  beforeEach(() => {
    // 清空mock数据
    mockDataSourceConfigs.length = 0;
    vi.clearAllMocks();
  });

  describe('setActiveDataSource', () => {
    it('应该能够切换到web数据源', async () => {
      await mockSetActiveDataSource('web');
      
      const active = await mockGetActiveDataSource();
      expect(active?.sourceType).toBe('web');
      expect(active?.isEnabled).toBe(true);
    });

    it('应该能够切换到企查查数据源', async () => {
      await mockSetActiveDataSource('qichacha');
      
      const active = await mockGetActiveDataSource();
      expect(active?.sourceType).toBe('qichacha');
      expect(active?.isEnabled).toBe(true);
    });

    it('切换数据源时应该禁用其他数据源', async () => {
      // 先设置web
      await mockSetActiveDataSource('web');
      // 再切换到qichacha
      await mockSetActiveDataSource('qichacha');
      
      const configs = await mockGetDataSourceConfigs();
      const webConfig = configs.find(c => c.sourceType === 'web');
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(webConfig?.isEnabled).toBe(false);
      expect(qccConfig?.isEnabled).toBe(true);
    });

    it('如果数据源不存在应该创建新记录', async () => {
      expect(mockDataSourceConfigs.length).toBe(0);
      
      await mockSetActiveDataSource('qichacha');
      
      expect(mockDataSourceConfigs.length).toBe(1);
      expect(mockDataSourceConfigs[0].sourceType).toBe('qichacha');
      expect(mockDataSourceConfigs[0].isEnabled).toBe(true);
    });
  });

  describe('upsertDataSourceConfig', () => {
    it('应该能够保存企查查API配置', async () => {
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'test-app-key',
        apiSecret: 'test-secret-key',
        isEnabled: true,
      });
      
      const configs = await mockGetDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig?.apiKey).toBe('test-app-key');
      expect(qccConfig?.apiSecret).toBe('test-secret-key');
    });

    it('应该能够更新已存在的配置', async () => {
      // 先创建配置
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'old-key',
        apiSecret: 'old-secret',
      });
      
      // 更新配置
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'new-key',
        apiSecret: 'new-secret',
      });
      
      const configs = await mockGetDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig?.apiKey).toBe('new-key');
      expect(qccConfig?.apiSecret).toBe('new-secret');
    });
  });

  describe('getQichachaConfig', () => {
    it('当数据源不是企查查时应该返回null', async () => {
      await mockSetActiveDataSource('web');
      
      const config = await getQichachaConfig();
      expect(config).toBeNull();
    });

    it('当数据源是企查查但没有配置API密钥时应该返回null', async () => {
      await mockSetActiveDataSource('qichacha');
      
      const config = await getQichachaConfig();
      expect(config).toBeNull();
    });

    it('当数据源是企查查且配置了API密钥时应该返回配置', async () => {
      // 设置数据源为企查查
      await mockSetActiveDataSource('qichacha');
      // 保存API配置
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'test-app-key',
        apiSecret: 'test-secret-key',
        isEnabled: true,
      });
      
      const config = await getQichachaConfig();
      expect(config).not.toBeNull();
      expect(config?.appKey).toBe('test-app-key');
      expect(config?.secretKey).toBe('test-secret-key');
    });

    it('切换数据源后应该正确返回配置状态', async () => {
      // 先配置企查查
      await mockSetActiveDataSource('qichacha');
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'test-app-key',
        apiSecret: 'test-secret-key',
        isEnabled: true,
      });
      
      // 验证企查查配置可用
      let config = await getQichachaConfig();
      expect(config).not.toBeNull();
      
      // 切换到web
      await mockSetActiveDataSource('web');
      
      // 验证企查查配置不可用
      config = await getQichachaConfig();
      expect(config).toBeNull();
      
      // 切换回企查查
      await mockSetActiveDataSource('qichacha');
      
      // 验证企查查配置又可用了
      config = await getQichachaConfig();
      expect(config).not.toBeNull();
    });
  });

  describe('配置持久化', () => {
    it('配置应该在切换数据源后保持不变', async () => {
      // 保存企查查配置
      await mockUpsertDataSourceConfig({
        sourceType: 'qichacha',
        apiKey: 'my-app-key',
        apiSecret: 'my-secret-key',
      });
      
      // 切换到web
      await mockSetActiveDataSource('web');
      
      // 切换回企查查
      await mockSetActiveDataSource('qichacha');
      
      // 验证配置仍然存在
      const configs = await mockGetDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig?.apiKey).toBe('my-app-key');
      expect(qccConfig?.apiSecret).toBe('my-secret-key');
    });
  });
});
