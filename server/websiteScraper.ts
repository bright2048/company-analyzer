/**
 * 公司官网数据获取模块
 * 
 * 功能：
 * 1. 从企查查年报数据中提取官网URL
 * 2. 爬取官网关键页面（首页、关于我们、产品介绍等）
 * 3. 使用LLM提取结构化信息
 */

import { invokeLLM } from "./_core/llm";

// 官网提取的结构化信息
export interface WebsiteInfo {
  url: string;                    // 官网URL
  companyIntro: string;           // 公司简介
  mainProducts: string[];         // 主要产品/服务
  teamInfo: string;               // 团队介绍
  achievements: string[];         // 企业荣誉/成就
  contactInfo: string;            // 联系方式
  newsHighlights: string[];       // 新闻动态摘要
  rawContent: string;             // 原始爬取内容（用于调试）
  fetchedAt: string;              // 获取时间
  source: 'qichacha' | 'search';  // URL来源
}


// 网页爬取结果
interface PageContent {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * 从企查查年报数据中提取官网URL
 */
export function extractWebsiteFromAnnualReports(annualReports: any[]): string | null {
  if (!annualReports || annualReports.length === 0) {
    return null;
  }

  // 遍历年报，查找官网信息
  for (const report of annualReports) {
    // 优先使用WebSiteList（API实际返回字段）
    if (report.WebSiteList && Array.isArray(report.WebSiteList)) {
      for (const websiteInfo of report.WebSiteList) {
        if (websiteInfo.WebSite) {
          let url = websiteInfo.WebSite.trim();
          // 确保URL有协议前缀
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          // 过滤掉明显不是官网的URL（如电商平台店铺）
          if (!isThirdPartyPlatform(url)) {
            console.log(`[WebsiteScraper] Found website from WebSiteList: ${url}`);

            return url;
          }
        }
      }
    }

    // 兼容旧字段WebsiteInfos
    if (report.WebsiteInfos && Array.isArray(report.WebsiteInfos)) {
      for (const websiteInfo of report.WebsiteInfos) {
        if (websiteInfo.Website) {
          let url = websiteInfo.Website.trim();
          // 确保URL有协议前缀
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          // 过滤掉明显不是官网的URL（如电商平台店铺）
          if (!isThirdPartyPlatform(url)) {
            console.log(`[WebsiteScraper] Found website from WebsiteInfos: ${url}`);
            return url;
          }
        }
      }
    }
  }

  console.log(`[WebsiteScraper] No website URL found in annual reports`);
  return null;
}

/**
 * 检查URL是否为第三方平台（非官网）
 */
function isThirdPartyPlatform(url: string): boolean {
  const thirdPartyDomains = [
    'taobao.com', 'tmall.com', 'jd.com', '1688.com',
    'alibaba.com', 'amazon.com', 'pinduoduo.com',
    'weibo.com', 'weixin.qq.com', 'douyin.com',
    'zhihu.com', 'baidu.com', 'sogou.com',
  ];

  const lowerUrl = url.toLowerCase();
  return thirdPartyDomains.some(domain => lowerUrl.includes(domain));
}

/**
 * 爬取单个网页内容
 */
async function fetchPageContent(url: string, timeout: number = 10000): Promise<PageContent> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 提取正文内容（移除脚本、样式、HTML标签）
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 限制内容长度
    if (content.length > 15000) {
      content = content.substring(0, 15000) + '...';
    }

    return {
      url,
      title,
      content,
      success: true,
    };
  } catch (error) {
    return {
      url,
      title: '',
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 发现官网的关键页面URL
 */
function discoverKeyPages(baseUrl: string, htmlContent: string): string[] {
  const keyPages: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname;

  // 关键页面关键词
  const keyPatterns = [
    /about|关于|公司介绍|企业简介/i,
    /product|产品|服务|solution|解决方案/i,
    /team|团队|管理层|领导/i,
    /news|新闻|动态|资讯/i,
    /contact|联系|加入我们/i,
  ];

  // 提取所有链接
  const linkRegex = /href=["']([^"']+)["']/gi;
  let match;
  const foundUrls = new Set<string>();

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    let href = match[1];

    // 跳过锚点、javascript、邮件链接
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      continue;
    }

    // 转换为绝对URL
    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      const urlObj = new URL(absoluteUrl);

      // 只保留同域名的链接
      if (urlObj.hostname === baseDomain || urlObj.hostname.endsWith('.' + baseDomain)) {
        // 检查是否匹配关键页面模式
        for (const pattern of keyPatterns) {
          if (pattern.test(absoluteUrl) || pattern.test(href)) {
            foundUrls.add(absoluteUrl);
            break;
          }
        }
      }
    } catch {
      // 忽略无效URL
    }
  }

  return Array.from(foundUrls).slice(0, 5); // 最多5个关键页面
}

/**
 * 使用LLM从网页内容中提取结构化信息
 */
async function extractInfoWithLLM(companyName: string, pageContents: PageContent[]): Promise<Partial<WebsiteInfo>> {
  // 合并所有页面内容
  let combinedContent = '';
  for (const page of pageContents) {
    if (page.success && page.content) {
      combinedContent += `\n\n=== ${page.title || page.url} ===\n${page.content}`;
    }
  }

  // 限制总长度
  if (combinedContent.length > 20000) {
    combinedContent = combinedContent.substring(0, 20000) + '...';
  }

  if (!combinedContent.trim()) {
    return {};
  }

  const systemPrompt = `你是一位专业的企业信息分析师，擅长从公司官网内容中提取关键信息。

请从以下网页内容中提取${companyName}的相关信息，并以JSON格式返回。

**提取要求**：
1. 只提取明确出现在内容中的信息，不要推测或编造
2. 如果某项信息未找到，对应字段返回空字符串或空数组
3. 信息要简洁准确，去除广告和无关内容

**返回格式**（必须是有效的JSON）：
{
  "companyIntro": "公司简介（100-300字）",
  "mainProducts": ["产品1", "产品2", "产品3"],
  "teamInfo": "团队/管理层介绍",
  "achievements": ["荣誉1", "荣誉2"],
  "contactInfo": "联系方式（电话、地址等）",
  "newsHighlights": ["新闻摘要1", "新闻摘要2"]
}`;

  const userPrompt = `请从以下${companyName}官网内容中提取企业信息：

${combinedContent}

请直接返回JSON格式的结果，不要添加任何其他说明。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content || '';
    // 确保 content 是字符串类型
    const content = typeof rawContent === 'string' ? rawContent : '';

    // 尝试解析JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        companyIntro: parsed.companyIntro || '',
        mainProducts: Array.isArray(parsed.mainProducts) ? parsed.mainProducts : [],
        teamInfo: parsed.teamInfo || '',
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        contactInfo: parsed.contactInfo || '',
        newsHighlights: Array.isArray(parsed.newsHighlights) ? parsed.newsHighlights : [],
      };
    }
  } catch (error) {
    console.error('[WebsiteScraper] LLM extraction failed:', error);
  }

  return {};
}

/**
 * 获取公司官网信息
 * 
 * @param companyName 公司名称
 * @param annualReports 企查查年报数据（包含官网URL）
 * @returns 官网提取的结构化信息
 */
export async function fetchCompanyWebsiteInfo(
  companyName: string,
  annualReports: any[]
): Promise<WebsiteInfo | null> {
  console.log(`[WebsiteScraper] Starting website info fetch for: ${companyName}`);

  // 1. 从年报中提取官网URL
  const websiteUrl = extractWebsiteFromAnnualReports(annualReports);

  if (!websiteUrl) {
    console.log(`[WebsiteScraper] No website URL found in annual reports for: ${companyName}`);
    return null;
  }

  console.log(`[WebsiteScraper] Found website URL: ${websiteUrl}`);

  // 2. 爬取首页
  const homePage = await fetchPageContent(websiteUrl);

  if (!homePage.success) {
    console.log(`[WebsiteScraper] Failed to fetch homepage: ${homePage.error}`);
    return null;
  }

  console.log(`[WebsiteScraper] Homepage fetched, title: ${homePage.title}`);

  // 3. 发现并爬取关键页面
  const keyPageUrls = discoverKeyPages(websiteUrl, homePage.content);
  console.log(`[WebsiteScraper] Found ${keyPageUrls.length} key pages`);

  const pageContents: PageContent[] = [homePage];

  // 并行爬取关键页面
  if (keyPageUrls.length > 0) {
    const keyPageResults = await Promise.all(
      keyPageUrls.map(url => fetchPageContent(url))
    );
    pageContents.push(...keyPageResults.filter(p => p.success));
  }

  console.log(`[WebsiteScraper] Total pages fetched: ${pageContents.length}`);

  // 4. 使用LLM提取结构化信息
  const extractedInfo = await extractInfoWithLLM(companyName, pageContents);

  // 5. 组装返回结果
  const result: WebsiteInfo = {
    url: websiteUrl,
    companyIntro: extractedInfo.companyIntro || '',
    mainProducts: extractedInfo.mainProducts || [],
    teamInfo: extractedInfo.teamInfo || '',
    achievements: extractedInfo.achievements || [],
    contactInfo: extractedInfo.contactInfo || '',
    newsHighlights: extractedInfo.newsHighlights || [],
    rawContent: pageContents.map(p => p.content).join('\n\n').substring(0, 5000),
    fetchedAt: new Date().toISOString(),
    source: 'qichacha',
  };

  console.log(`[WebsiteScraper] Website info extraction completed for: ${companyName}`);
  console.log(`[WebsiteScraper] Extracted: companyIntro=${result.companyIntro.length}chars, products=${result.mainProducts.length}, achievements=${result.achievements.length}`);

  return result;
}

/**
 * 格式化官网信息为报告数据段落
 */
export function formatWebsiteInfoForReport(websiteInfo: WebsiteInfo | null): string {
  if (!websiteInfo) {
    return '';
  }

  let section = '\n**公司官网信息**（数据来源：公司官网）：\n';

  if (websiteInfo.companyIntro) {
    section += `- 公司简介：${websiteInfo.companyIntro}\n`;
  }

  if (websiteInfo.mainProducts && websiteInfo.mainProducts.length > 0) {
    section += `- 主要产品/服务：${websiteInfo.mainProducts.join('、')}\n`;
  }

  if (websiteInfo.teamInfo) {
    section += `- 团队介绍：${websiteInfo.teamInfo}\n`;
  }

  if (websiteInfo.achievements && websiteInfo.achievements.length > 0) {
    section += `- 企业荣誉：${websiteInfo.achievements.join('、')}\n`;
  }

  if (websiteInfo.contactInfo) {
    section += `- 联系方式：${websiteInfo.contactInfo}\n`;
  }

  if (websiteInfo.newsHighlights && websiteInfo.newsHighlights.length > 0) {
    section += `- 近期动态：${websiteInfo.newsHighlights.slice(0, 3).join('；')}\n`;
  }

  section += `- 官网地址：${websiteInfo.url}\n`;
  section += `- 数据获取时间：${new Date(websiteInfo.fetchedAt).toLocaleDateString('zh-CN')}\n`;

  return section;
}
