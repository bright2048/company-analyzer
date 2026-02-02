/**
 * 加密解密功能单元测试
 * 
 * 测试内容：
 * - AES-256-GCM加密解密
 * - API Key脱敏
 * - 边界情况处理
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskApiKey } from './encryption';

describe('加密解密模块', () => {
  describe('encrypt 和 decrypt', () => {
    it('应该正确加密和解密普通字符串', () => {
      const plaintext = 'test-api-key-12345';
      const { encrypted, iv } = encrypt(plaintext);
      
      expect(encrypted).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      
      const decrypted = decrypt(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('应该正确处理包含特殊字符的API Key', () => {
      const plaintext = 'sk-abc123!@#$%^&*()_+-=[]{}|;:,.<>?';
      const { encrypted, iv } = encrypt(plaintext);
      
      const decrypted = decrypt(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('应该正确处理中文字符', () => {
      const plaintext = '测试密钥-中文内容';
      const { encrypted, iv } = encrypt(plaintext);
      
      const decrypted = decrypt(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('应该正确处理长字符串', () => {
      const plaintext = 'a'.repeat(1000);
      const { encrypted, iv } = encrypt(plaintext);
      
      const decrypted = decrypt(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('应该为空字符串返回空结果', () => {
      const { encrypted, iv } = encrypt('');
      
      expect(encrypted).toBe('');
      expect(iv).toBe('');
    });

    it('每次加密应该产生不同的密文（随机IV）', () => {
      const plaintext = 'same-api-key';
      const result1 = encrypt(plaintext);
      const result2 = encrypt(plaintext);
      
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('使用错误的IV解密应该返回空字符串', () => {
      const plaintext = 'test-api-key';
      const { encrypted } = encrypt(plaintext);
      const wrongIv = Buffer.from('wrong-iv-12b').toString('base64');
      
      const decrypted = decrypt(encrypted, wrongIv);
      expect(decrypted).toBe('');
    });

    it('解密空字符串应该返回空字符串', () => {
      const decrypted = decrypt('', '');
      expect(decrypted).toBe('');
    });
  });

  describe('maskApiKey', () => {
    it('应该正确脱敏标准长度的API Key', () => {
      const apiKey = 'sk-1234567890abcdef';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toMatch(/^sk-1.*cdef$/);
      expect(masked).toContain('*');
      expect(masked.length).toBeLessThanOrEqual(apiKey.length);
    });

    it('应该正确脱敏短 API Key', () => {
      const apiKey = '12345678';
      const masked = maskApiKey(apiKey);
      
      // 长度刚好8位，前4+后4=8，中间没有星号
      expect(masked).toBe('12345678');
    });
    it('应该为过短的API Key返回星号', () => {
      const apiKey = '1234567';
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('****');
    });

    it('应该为空字符串返回星号', () => {
      const masked = maskApiKey('');
      expect(masked).toBe('****');
    });

    it('应该限制星号数量不超过16个', () => {
      const apiKey = 'a'.repeat(100);
      const masked = maskApiKey(apiKey);
      
      // 前4位 + 最多16个星号 + 后4位 = 最多24个字符
      expect(masked.length).toBeLessThanOrEqual(24);
    });
  });
});
