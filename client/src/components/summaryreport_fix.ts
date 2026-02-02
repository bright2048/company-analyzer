interface CompanyInfo {
  // 企查查原始字段名
  Name?: string;
  RegistCapi?: string;
  RealCapi?: string;
  StartDate?: string;
  Status?: string;
  Industry?: string;
  Employees?: string;
  // 后端存储的字段名（小写驼峰）
  name?: string;
  registeredCapital?: string;
  realCapital?: string;
  establishDate?: string;
  status?: string;
  industry?: string;
  employees?: string;
  // 基本信息
  creditCode?: string;
  legalPerson?: string;
  address?: string;
  scope?: string;
  // 关联数据 - 企查查API返回的详细数据
  patents?: { total: number; list: any[] } | any[];
  trademarks?: { total: number; list: any[] } | any[];
  copyrights?: { total: number; list: any[] } | any[];
  certificates?: { total: number; list: any[] } | any[];  // 企查查API返回的资质证书数据
  shareholders?: Array<{ StockName: string; StockPercent: string }>;
  executives?: Array<{ Name: string; Job: string }>;
  customers?: Array<{ Name: string }> | any[];
  suppliers?: Array<{ Name: string }> | any[];
  annualReports?: Array<{ Year: string }> | any[];
  certifications?: Array<{ CertName: string }>;  // 保留原字段，以防其他地方使用
}
// 计算各项指标
  const metrics = useMemo(() => {
    // 同时支持企查查原始字段名和后端存储的字段名
    const capital = parseCapital(info.RegistCapi || info.registeredCapital);
    const years = calculateYears(info.StartDate || info.establishDate);
    
    // 处理专利数据 - 可能是对象格式{total, list}或数组格式
    let patentCount = 0;
    if (info.patents) {
      if (typeof info.patents === 'object' && 'total' in info.patents) {
        // 如果是{total, list}格式
        patentCount = (info.patents as { total: number; list: any[] }).total || 0;
      } else if (Array.isArray(info.patents)) {
        // 如果是数组格式
        patentCount = info.patents.length;
      }
    }
    
    // 处理商标数据
    let trademarkCount = 0;
    if (info.trademarks) {
      if (typeof info.trademarks === 'object' && 'total' in info.trademarks) {
        // 如果是{total, list}格式
        trademarkCount = (info.trademarks as { total: number; list: any[] }).total || 0;
      } else if (Array.isArray(info.trademarks)) {
        // 如果是数组格式
        trademarkCount = info.trademarks.length;
      }
    }
    
    // 处理软著数据
    let copyrightCount = 0;
    if (info.copyrights) {
      if (typeof info.copyrights === 'object' && 'total' in info.copyrights) {
        // 如果是{total, list}格式
        copyrightCount = (info.copyrights as { total: number; list: any[] }).total || 0;
      } else if (Array.isArray(info.copyrights)) {
        // 如果是数组格式
        copyrightCount = info.copyrights.length;
      }
    }
    
    // 处理资质证书数据 - 优先使用certificates，其次使用certifications
    let certCount = 0;
    if (info.certificates) {
      if (typeof info.certificates === 'object' && 'total' in info.certificates) {
        // 如果是{total, list}格式
        certCount = (info.certificates as { total: number; list: any[] }).total || 0;
      } else if (Array.isArray(info.certificates)) {
        // 如果是数组格式
        certCount = info.certificates.length;
      }
    } else if (info.certifications) {
      // 如果使用旧的certifications字段
      certCount = info.certifications.length || 0;
    }
    
    // 处理客户和供应商数据
    const customerCount = Array.isArray(info.customers) ? info.customers.length : (info.customers?.length || 0);
    const supplierCount = Array.isArray(info.suppliers) ? info.suppliers.length : (info.suppliers?.length || 0);
    
    return {
      capital,
      years,
      patentCount,
      trademarkCount,
      copyrightCount,
      certCount,
      customerCount,
      supplierCount,
      totalIP: patentCount + trademarkCount + copyrightCount,
    };
  }, [info]);


  // 解析企业信息 - 添加更多调试日志和数据结构处理
  const info: CompanyInfo = useMemo(() => {
    if (!companyInfo) return {};
    try {
      const parsed = JSON.parse(companyInfo);
      
      // 确保数据结构正确 - 处理可能的不同格式
      if (parsed.patents) {
        // 如果patents是数组，将其转换为正确的对象格式
        if (Array.isArray(parsed.patents)) {
          parsed.patents = { 
            total: parsed.patents.length, 
            list: parsed.patents 
          };
        } else if (typeof parsed.patents === 'object' && parsed.patents && !('total' in parsed.patents)) {
          // 如果是对象但没有total属性
          const list = Object.values(parsed.patents);
          parsed.patents = { 
            total: Array.isArray(list) ? list.length : 0, 
            list: Array.isArray(list) ? list : [] 
          };
        }
      }
      
      if (parsed.trademarks) {
        // 如果trademarks是数组，将其转换为正确的对象格式
        if (Array.isArray(parsed.trademarks)) {
          parsed.trademarks = { 
            total: parsed.trademarks.length, 
            list: parsed.trademarks 
          };
        } else if (typeof parsed.trademarks === 'object' && parsed.trademarks && !('total' in parsed.trademarks)) {
          // 如果是对象但没有total属性
          const list = Object.values(parsed.trademarks);
          parsed.trademarks = { 
            total: Array.isArray(list) ? list.length : 0, 
            list: Array.isArray(list) ? list : [] 
          };
        }
      }
      
      if (parsed.copyrights) {
        // 如果copyrights是数组，将其转换为正确的对象格式
        if (Array.isArray(parsed.copyrights)) {
          parsed.copyrights = { 
            total: parsed.copyrights.length, 
            list: parsed.copyrights 
          };
        } else if (typeof parsed.copyrights === 'object' && parsed.copyrights && !('total' in parsed.copyrights)) {
          // 如果是对象但没有total属性
          const list = Object.values(parsed.copyrights);
          parsed.copyrights = { 
            total: Array.isArray(list) ? list.length : 0, 
            list: Array.isArray(list) ? list : [] 
          };
        }
      }
      
      if (parsed.certificates) {
        // 如果certificates是数组，将其转换为正确的对象格式
        if (Array.isArray(parsed.certificates)) {
          parsed.certificates = { 
            total: parsed.certificates.length, 
            list: parsed.certificates 
          };
        } else if (typeof parsed.certificates === 'object' && parsed.certificates && !('total' in parsed.certificates)) {
          // 如果是对象但没有total属性
          const list = Object.values(parsed.certificates);
          parsed.certificates = { 
            total: Array.isArray(list) ? list.length : 0, 
            list: Array.isArray(list) ? list : [] 
          };
        }
      }
      
      return parsed;
    } catch (error) {
      console.error('Error parsing companyInfo:', error);
      return {};
    }
  }, [companyInfo]);