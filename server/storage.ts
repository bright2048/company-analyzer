/**
 * S3/OSS存储助手模块
 * 
 * 功能说明：
 * - 支持阿里云OSS和AWS S3兼容的对象存储服务
 * - 用于上传和下载报告文件（Word、PDF等）
 * - 优先使用自定义S3配置，如果没有配置则回退到Manus平台存储
 * 
 * 使用方法：
 * 1. 在.env文件中配置S3相关环境变量
 * 2. 调用storagePut上传文件，调用storageGet获取文件URL
 */

// 引入AWS S3 SDK的相关类
// S3Client: S3客户端，用于连接S3服务
// PutObjectCommand: 上传文件的命令
// GetObjectCommand: 获取文件的命令
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// getSignedUrl: 生成预签名URL的函数，用于临时授权访问私有文件
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 引入环境变量配置
import { ENV } from './_core/env';

/**
 * S3配置接口
 * 定义连接S3/OSS所需的所有配置项
 */
interface S3Config {
  endpoint: string;      // S3服务端点URL，如：https://oss-cn-shenzhen.aliyuncs.com
  region: string;        // 区域，如：cn-shenzhen
  bucket: string;        // 存储桶名称，如：company-reports
  accessKeyId: string;   // 访问密钥ID（类似用户名）
  secretAccessKey: string; // 访问密钥（类似密码）
  forcePathStyle: boolean; // 是否强制使用路径风格URL（一般为false）
}

/**
 * 获取S3配置
 * 从环境变量中读取S3/OSS的配置信息
 * 
 * @returns S3Config对象，如果配置不完整则返回null
 */
function getS3Config(): S3Config | null {
  // 从环境变量读取各项配置
  const endpoint = process.env.S3_ENDPOINT;           // S3服务地址
  const region = process.env.S3_REGION;               // 区域
  const bucket = process.env.S3_BUCKET;               // 存储桶名称
  const accessKeyId = process.env.S3_ACCESS_KEY;      // 访问密钥ID
  const secretAccessKey = process.env.S3_SECRET_KEY;  // 访问密钥
  // 是否使用路径风格URL，默认为false
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  // 检查所有必需的配置是否都存在
  if (endpoint && region && bucket && accessKeyId && secretAccessKey) {
    // 配置完整，返回配置对象
    return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle };
  }
  // 配置不完整，返回null
  return null;
}

/**
 * 创建S3客户端
 * 使用配置信息创建一个可以操作S3的客户端对象
 * 
 * @param config S3配置对象
 * @returns S3Client实例
 */
function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,           // 设置服务端点
    region: config.region,               // 设置区域
    credentials: {                       // 设置认证凭证
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle, // 设置URL风格
  });
}

/**
 * Manus平台存储配置类型
 * 用于回退到Manus平台内置存储
 */
type ManusStorageConfig = { baseUrl: string; apiKey: string };

/**
 * 获取Manus平台存储配置
 * 如果没有配置自定义S3，则使用Manus平台的存储服务
 * 
 * @returns Manus存储配置，如果不可用则返回null
 */
function getManusStorageConfig(): ManusStorageConfig | null {
  const baseUrl = ENV.forgeApiUrl;  // Manus API地址
  const apiKey = ENV.forgeApiKey;   // Manus API密钥

  if (baseUrl && apiKey) {
    // 去掉URL末尾的斜杠，保持格式统一
    return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
  }
  return null;
}

/**
 * 规范化文件路径
 * 去掉路径开头的斜杠，确保路径格式正确
 * 
 * @param relKey 相对路径，如：/reports/test.pdf
 * @returns 规范化后的路径，如：reports/test.pdf
 */
function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * 使用S3上传文件
 * 将文件上传到S3/OSS存储，并返回可访问的URL
 * 
 * @param config S3配置对象
 * @param relKey 文件存储路径，如：reports/2024/report.pdf
 * @param data 文件内容，可以是Buffer、Uint8Array或字符串
 * @param contentType 文件MIME类型，如：application/pdf
 * @returns 包含文件路径和访问URL的对象
 */
async function s3Put(
  config: S3Config,
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  // 创建S3客户端
  const client = createS3Client(config);
  // 规范化文件路径
  const key = normalizeKey(relKey);
  
  // 将字符串转换为Buffer（S3需要二进制数据）
  const body = typeof data === 'string' ? Buffer.from(data) : data;
  
  // 创建上传命令
  const putCommand = new PutObjectCommand({
    Bucket: config.bucket,    // 目标存储桶
    Key: key,                 // 文件路径
    Body: body,               // 文件内容
    ContentType: contentType, // 文件类型
  });

  // 执行上传
  await client.send(putCommand);
  
  // 生成预签名URL（有效期1小时）
  // 预签名URL允许未授权用户临时访问私有文件
  const getCommand = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  const url = await getSignedUrl(client, getCommand, { expiresIn: 3600 }); // 3600秒 = 1小时
  
  // 打印日志（URL太长，只显示前100个字符）
  console.log('[S3 Storage] Upload success:', { key, url: url.substring(0, 100) + '...' });
  return { key, url };
}

/**
 * 使用S3获取文件URL
 * 为已存在的文件生成预签名访问URL
 * 
 * @param config S3配置对象
 * @param relKey 文件路径
 * @param expiresIn URL有效期（秒），默认1小时
 * @returns 包含文件路径和访问URL的对象
 */
async function s3Get(
  config: S3Config,
  relKey: string,
  expiresIn: number = 3600
): Promise<{ key: string; url: string }> {
  const client = createS3Client(config);
  const key = normalizeKey(relKey);
  
  // 创建获取文件的命令
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  // 生成预签名URL
  const url = await getSignedUrl(client, command, { expiresIn });
  return { key, url };
}

/**
 * Manus平台存储上传
 * 使用Manus平台内置的存储服务上传文件
 * 
 * @param config Manus存储配置
 * @param relKey 文件路径
 * @param data 文件内容
 * @param contentType 文件类型
 * @returns 包含文件路径和访问URL的对象
 */
async function manusPut(
  config: ManusStorageConfig,
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  
  // 构建上传API的URL
  const uploadUrl = new URL("v1/storage/upload", config.baseUrl + "/");
  uploadUrl.searchParams.set("path", key);
  
  // 将数据转换为Blob对象（浏览器兼容的二进制格式）
  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });
  
  // 创建FormData表单数据
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);
  
  // 发送上传请求
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` }, // 使用Bearer Token认证
    body: form,
  });

  // 检查上传是否成功
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }
  
  // 从响应中获取文件URL
  const url = (await response.json()).url;
  return { key, url };
}

/**
 * Manus平台存储获取URL
 * 获取Manus平台存储中文件的下载URL
 * 
 * @param config Manus存储配置
 * @param relKey 文件路径
 * @returns 包含文件路径和访问URL的对象
 */
async function manusGet(
  config: ManusStorageConfig,
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  
  // 构建获取下载URL的API地址
  const downloadApiUrl = new URL("v1/storage/downloadUrl", config.baseUrl + "/");
  downloadApiUrl.searchParams.set("path", key);
  
  // 发送请求获取下载URL
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  
  const url = (await response.json()).url;
  return { key, url };
}

/**
 * 上传文件到存储（对外暴露的主函数）
 * 
 * 使用说明：
 * - 优先使用S3配置（如果在.env中配置了S3_*环境变量）
 * - 如果没有S3配置，则使用Manus平台存储
 * 
 * @param relKey 文件存储路径，如：reports/company-report.pdf
 * @param data 文件内容
 * @param contentType 文件MIME类型，默认为二进制流
 * @returns 包含文件路径和访问URL的对象
 * 
 * @example
 * // 上传PDF文件
 * const result = await storagePut('reports/test.pdf', pdfBuffer, 'application/pdf');
 * console.log(result.url); // 输出可访问的URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // 优先使用S3配置
  const s3Config = getS3Config();
  if (s3Config) {
    console.log('[Storage] Using S3/OSS storage');
    return s3Put(s3Config, relKey, data, contentType);
  }
  
  // 回退到Manus平台存储
  const manusConfig = getManusStorageConfig();
  if (manusConfig) {
    console.log('[Storage] Using Manus platform storage');
    return manusPut(manusConfig, relKey, data, contentType);
  }
  
  // 两种存储都没有配置，抛出错误
  throw new Error("Storage not configured: set S3_* or BUILT_IN_FORGE_API_* environment variables");
}

/**
 * 获取文件访问URL（对外暴露的主函数）
 * 
 * 使用说明：
 * - 为已上传的文件生成访问URL
 * - 对于私有存储，会生成带签名的临时URL
 * 
 * @param relKey 文件路径
 * @param expiresIn URL有效期（秒），默认1小时
 * @returns 包含文件路径和访问URL的对象
 * 
 * @example
 * // 获取文件URL
 * const result = await storageGet('reports/test.pdf');
 * console.log(result.url); // 输出可访问的URL
 */
export async function storageGet(
  relKey: string,
  expiresIn: number = 3600
): Promise<{ key: string; url: string }> {
  // 优先使用S3配置
  const s3Config = getS3Config();
  if (s3Config) {
    return s3Get(s3Config, relKey, expiresIn);
  }
  
  // 回退到Manus平台存储
  const manusConfig = getManusStorageConfig();
  if (manusConfig) {
    return manusGet(manusConfig, relKey);
  }
  
  // 两种存储都没有配置，抛出错误
  throw new Error("Storage not configured: set S3_* or BUILT_IN_FORGE_API_* environment variables");
}
