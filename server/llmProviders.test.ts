/**
 * LLM提供商模块单元测试
 * 
 * 测试多大模型提供商适配器的功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLLMProviders, getLLMProviderById, LLM_PROVIDERS } from './llmProviders';

describe('LLM Providers Module', () => {
  describe('getLLMProviders', () => {
    it('应该返回所有支持的LLM提供商列表', () => {
      const providers = getLLMProviders();
      
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBe(3);
    });

    it('应该包含智谱AI提供商', () => {
      const providers = getLLMProviders();
      const zhipu = providers.find(p => p.id === 'zhipu');
      
      expect(zhipu).toBeDefined();
      expect(zhipu?.name).toBe('智谱AI');
      expect(zhipu?.requiresApiKey).toBe(true);
      expect(zhipu?.requiresApiSecret).toBe(false);
    });

    it('应该包含百度文心一言提供商', () => {
      const providers = getLLMProviders();
      const wenxin = providers.find(p => p.id === 'wenxin');
      
      expect(wenxin).toBeDefined();
      expect(wenxin?.name).toBe('百度文心一言');
      expect(wenxin?.requiresApiKey).toBe(true);
      expect(wenxin?.requiresApiSecret).toBe(false);
    });

    it('应该包含通义千问提供商', () => {
      const providers = getLLMProviders();
      const qwen = providers.find(p => p.id === 'qwen');
      
      expect(qwen).toBeDefined();
      expect(qwen?.name).toBe('通义千问');
      expect(qwen?.requiresApiKey).toBe(false);
      expect(qwen?.requiresApiSecret).toBe(false);
    });
  });

  describe('getLLMProviderById', () => {
    it('应该返回指定ID的提供商信息', () => {
      const zhipu = getLLMProviderById('zhipu');
      
      expect(zhipu).toBeDefined();
      expect(zhipu?.id).toBe('zhipu');
      expect(zhipu?.name).toBe('智谱AI');
    });

    it('应该返回undefined对于不存在的ID', () => {
      const unknown = getLLMProviderById('unknown' as any);
      
      expect(unknown).toBeUndefined();
    });
  });

  describe('LLM_PROVIDERS 数据结构', () => {
    it('每个提供商应该有必需的字段', () => {
      for (const provider of LLM_PROVIDERS) {
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.description).toBeDefined();
        expect(provider.models).toBeDefined();
        expect(Array.isArray(provider.models)).toBe(true);
        expect(provider.models.length).toBeGreaterThan(0);
        expect(typeof provider.requiresApiKey).toBe('boolean');
        expect(typeof provider.requiresApiSecret).toBe('boolean');
      }
    });

    it('每个模型应该有必需的字段', () => {
      for (const provider of LLM_PROVIDERS) {
        for (const model of provider.models) {
          expect(model.id).toBeDefined();
          expect(model.name).toBeDefined();
          expect(model.description).toBeDefined();
          expect(typeof model.contextLength).toBe('number');
          expect(model.inputPrice).toBeDefined();
          expect(model.outputPrice).toBeDefined();
        }
      }
    });

    it('智谱AI应该有多个模型选项', () => {
      const zhipu = LLM_PROVIDERS.find(p => p.id === 'zhipu');
      
      expect(zhipu?.models.length).toBeGreaterThan(1);
      
      // 检查是否包含主要模型
      const modelIds = zhipu?.models.map(m => m.id);
      expect(modelIds).toContain('glm-4-plus');
      expect(modelIds).toContain('glm-4-air');
    });

    it('百度文心一言应该有多个模型选项', () => {
      const wenxin = LLM_PROVIDERS.find(p => p.id === 'wenxin');
      
      expect(wenxin?.models.length).toBeGreaterThan(1);
      
      // 检查是否包含主要模型
      const modelIds = wenxin?.models.map(m => m.id);
      expect(modelIds).toContain('ernie-4.5-8k-preview');
    });
  });
});
