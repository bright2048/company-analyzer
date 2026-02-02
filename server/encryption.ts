/**
 * 加密解密工具模块
 * 
 * 功能说明：
 * - 使用AES-256-GCM算法加密敏感数据（如API Key）
 * - 从JWT_SECRET环境变量派生加密密钥
 * - 每次加密使用随机IV，提高安全性
 * 
 * 安全特性：
 * - AES-256-GCM提供加密和认证
 * - 使用PBKDF2从密码派生密钥
 * - 随机IV防止相同明文产生相同密文
 */

import crypto from 'crypto';
import { ENV } from './_core/env';

// 加密算法配置
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM推荐的IV长度
const AUTH_TAG_LENGTH = 16; // 认证标签长度
const KEY_LENGTH = 32; // AES-256需要32字节密钥
const SALT = 'company-analyzer-llm-config'; // 固定盐值

/**
 * 从环境变量派生加密密钥
 * 使用PBKDF2算法，确保密钥强度
 */
function deriveKey(): Buffer {
  const secret = ENV.cookieSecret || 'default-secret-key-for-development';
  return crypto.pbkdf2Sync(secret, SALT, 100000, KEY_LENGTH, 'sha256');
}

/**
 * 加密数据
 * 
 * @param plaintext - 要加密的明文
 * @returns 加密结果，包含IV和密文（Base64编码）
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  if (!plaintext) {
    return { encrypted: '', iv: '' };
  }

  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // 将认证标签附加到密文
  const authTag = cipher.getAuthTag();
  const encryptedWithTag = Buffer.concat([
    Buffer.from(encrypted, 'base64'),
    authTag,
  ]).toString('base64');
  
  return {
    encrypted: encryptedWithTag,
    iv: iv.toString('base64'),
  };
}

/**
 * 解密数据
 * 
 * @param encrypted - 加密的密文（Base64编码）
 * @param iv - 初始化向量（Base64编码）
 * @returns 解密后的明文
 */
export function decrypt(encrypted: string, iv: string): string {
  if (!encrypted || !iv) {
    return '';
  }

  try {
    const key = deriveKey();
    const ivBuffer = Buffer.from(iv, 'base64');
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    
    // 分离密文和认证标签
    const authTag = encryptedBuffer.slice(-AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.slice(0, -AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    return '';
  }
}

/**
 * 脱敏API Key
 * 只显示前4位和后4位，中间用星号替代
 * 
 * @param apiKey - 原始API Key
 * @returns 脱敏后的字符串
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-4);
  const masked = '*'.repeat(Math.min(apiKey.length - 8, 16));
  
  return `${prefix}${masked}${suffix}`;
}
