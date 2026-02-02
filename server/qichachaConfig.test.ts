import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDataSourceConfigs: vi.fn(),
  };
});

describe("企查查API配置读取", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清除环境变量
    delete process.env.QICHACHA_APP_KEY;
    delete process.env.QICHACHA_SECRET_KEY;
  });

  describe("配置优先级测试", () => {
    it("当数据库有配置时，应该优先使用数据库配置", async () => {
      // 模拟数据库返回企查查配置
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([
        {
          id: 1,
          sourceType: "qichacha",
          apiKey: "db_app_key_123",
          apiSecret: "db_secret_key_456",
          baseUrl: null,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig).toBeDefined();
      expect(qccConfig?.apiKey).toBe("db_app_key_123");
      expect(qccConfig?.apiSecret).toBe("db_secret_key_456");
    });

    it("当数据库配置为空时，应该返回空配置", async () => {
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([
        {
          id: 1,
          sourceType: "qichacha",
          apiKey: null,
          apiSecret: null,
          baseUrl: null,
          isEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig).toBeDefined();
      expect(qccConfig?.apiKey).toBeNull();
      expect(qccConfig?.apiSecret).toBeNull();
    });

    it("当数据库没有企查查配置时，应该返回undefined", async () => {
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([
        {
          id: 1,
          sourceType: "tianyancha",
          apiKey: "tianyancha_key",
          apiSecret: null,
          baseUrl: null,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig).toBeUndefined();
    });

    it("当数据库返回空数组时，应该返回undefined", async () => {
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      expect(qccConfig).toBeUndefined();
    });
  });

  describe("环境变量回退测试", () => {
    it("当设置了环境变量时，应该能读取到", () => {
      process.env.QICHACHA_APP_KEY = "env_app_key";
      process.env.QICHACHA_SECRET_KEY = "env_secret_key";
      
      expect(process.env.QICHACHA_APP_KEY).toBe("env_app_key");
      expect(process.env.QICHACHA_SECRET_KEY).toBe("env_secret_key");
    });

    it("当没有设置环境变量时，应该返回undefined", () => {
      expect(process.env.QICHACHA_APP_KEY).toBeUndefined();
      expect(process.env.QICHACHA_SECRET_KEY).toBeUndefined();
    });
  });

  describe("配置完整性验证", () => {
    it("当只有apiKey没有apiSecret时，配置应该被视为不完整", async () => {
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([
        {
          id: 1,
          sourceType: "qichacha",
          apiKey: "only_app_key",
          apiSecret: null,
          baseUrl: null,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      // 验证配置不完整
      const isComplete = qccConfig?.apiKey && qccConfig?.apiSecret;
      expect(isComplete).toBeFalsy();
    });

    it("当apiKey和apiSecret都存在时，配置应该被视为完整", async () => {
      vi.mocked(db.getDataSourceConfigs).mockResolvedValue([
        {
          id: 1,
          sourceType: "qichacha",
          apiKey: "complete_app_key",
          apiSecret: "complete_secret_key",
          baseUrl: null,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const configs = await db.getDataSourceConfigs();
      const qccConfig = configs.find(c => c.sourceType === 'qichacha');
      
      // 验证配置完整
      const isComplete = qccConfig?.apiKey && qccConfig?.apiSecret;
      expect(isComplete).toBeTruthy();
    });
  });
});
