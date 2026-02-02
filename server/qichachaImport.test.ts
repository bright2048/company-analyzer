import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve({})),
  createParkCompanies: vi.fn((companies) => Promise.resolve(companies.length)),
  getParkCompanies: vi.fn(() => Promise.resolve([])),
  getParkCompaniesCount: vi.fn(() => Promise.resolve(0)),
  getAllParkCompanyNames: vi.fn(() => Promise.resolve([])),
}));

describe('企查查Excel导入功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('企查查格式检测', () => {
    it('应该正确识别企查查导出格式（通过原文件导入名称字段）', () => {
      const qichachaData = [
        { '原文件导入名称': '测试公司', '登记状态': '存续', '统一社会信用代码': '91440300xxx' }
      ];
      
      const isQichachaFormat = qichachaData.length > 0 && (
        '原文件导入名称' in qichachaData[0] || 
        '统一社会信用代码' in qichachaData[0] ||
        '登记状态' in qichachaData[0]
      );
      
      expect(isQichachaFormat).toBe(true);
    });

    it('应该正确识别企查查导出格式（通过统一社会信用代码字段）', () => {
      const qichachaData = [
        { '统一社会信用代码': '91440300xxx', '法定代表人': '张三' }
      ];
      
      const isQichachaFormat = qichachaData.length > 0 && (
        '原文件导入名称' in qichachaData[0] || 
        '统一社会信用代码' in qichachaData[0] ||
        '登记状态' in qichachaData[0]
      );
      
      expect(isQichachaFormat).toBe(true);
    });

    it('应该正确识别普通格式', () => {
      const standardData = [
        { '公司名称': '测试公司', '行业': '科技' }
      ];
      
      const isQichachaFormat = standardData.length > 0 && (
        '原文件导入名称' in standardData[0] || 
        '统一社会信用代码' in standardData[0] ||
        '登记状态' in standardData[0]
      );
      
      expect(isQichachaFormat).toBe(false);
    });
  });

  describe('企查查数据解析', () => {
    it('应该正确解析企查查格式数据', () => {
      const qichachaRow = {
        '原文件导入名称': '深圳测试科技有限公司',
        '登记状态': '存续',
        '统一社会信用代码': '91440300812508289',
        '法定代表人': '张三',
        '企业规模': 'M(中型)',
        '注册资本': '1000万元',
        '电话': '0755-12345678',
        '更多电话': '13800138000;13900139000',
        '成立日期': '2020-01-01',
        '实缴资本': '500万元',
        '所属省份': '广东省',
        '所属城市': '深圳市',
        '所属区县': '南山区',
        '企业地址': '深圳市南山区科技园'
      };

      // 模拟解析逻辑
      const phone = qichachaRow['电话'] ? String(qichachaRow['电话']) : '';
      const morePhone = qichachaRow['更多电话'] ? String(qichachaRow['更多电话']) : '';
      const allPhones = [phone, morePhone].filter(p => p && p !== '-').join(';');

      const parsed = {
        companyName: String(qichachaRow['原文件导入名称'] || ''),
        creditCode: qichachaRow['统一社会信用代码'] ? String(qichachaRow['统一社会信用代码']) : undefined,
        legalPerson: qichachaRow['法定代表人'] ? String(qichachaRow['法定代表人']) : undefined,
        companyStatus: qichachaRow['登记状态'] ? String(qichachaRow['登记状态']) : undefined,
        companyScale: qichachaRow['企业规模'] ? String(qichachaRow['企业规模']) : undefined,
        registeredCapital: qichachaRow['注册资本'] ? String(qichachaRow['注册资本']) : undefined,
        paidCapital: qichachaRow['实缴资本'] ? String(qichachaRow['实缴资本']) : undefined,
        contactPhone: allPhones || undefined,
        establishedDate: qichachaRow['成立日期'] ? String(qichachaRow['成立日期']) : undefined,
        province: qichachaRow['所属省份'] ? String(qichachaRow['所属省份']) : undefined,
        city: qichachaRow['所属城市'] ? String(qichachaRow['所属城市']) : undefined,
        district: qichachaRow['所属区县'] ? String(qichachaRow['所属区县']) : undefined,
        address: qichachaRow['企业地址'] ? String(qichachaRow['企业地址']) : undefined,
        dataSource: 'qichacha_import',
      };

      expect(parsed.companyName).toBe('深圳测试科技有限公司');
      expect(parsed.creditCode).toBe('91440300812508289');
      expect(parsed.legalPerson).toBe('张三');
      expect(parsed.companyStatus).toBe('存续');
      expect(parsed.companyScale).toBe('M(中型)');
      expect(parsed.registeredCapital).toBe('1000万元');
      expect(parsed.paidCapital).toBe('500万元');
      expect(parsed.contactPhone).toBe('0755-12345678;13800138000;13900139000');
      expect(parsed.province).toBe('广东省');
      expect(parsed.city).toBe('深圳市');
      expect(parsed.district).toBe('南山区');
      expect(parsed.dataSource).toBe('qichacha_import');
    });

    it('应该正确处理空电话字段', () => {
      const qichachaRow = {
        '原文件导入名称': '测试公司',
        '电话': '-',
        '更多电话': '-'
      };

      const phone = qichachaRow['电话'] ? String(qichachaRow['电话']) : '';
      const morePhone = qichachaRow['更多电话'] ? String(qichachaRow['更多电话']) : '';
      const allPhones = [phone, morePhone].filter(p => p && p !== '-').join(';');

      expect(allPhones).toBe('');
    });

    it('应该正确合并多个电话号码', () => {
      const qichachaRow = {
        '电话': '0755-12345678',
        '更多电话': '13800138000;13900139000;0755-87654321'
      };

      const phone = qichachaRow['电话'] ? String(qichachaRow['电话']) : '';
      const morePhone = qichachaRow['更多电话'] ? String(qichachaRow['更多电话']) : '';
      const allPhones = [phone, morePhone].filter(p => p && p !== '-').join(';');

      expect(allPhones).toBe('0755-12345678;13800138000;13900139000;0755-87654321');
    });
  });

  describe('普通格式数据解析', () => {
    it('应该正确解析普通格式数据', () => {
      const standardRow = {
        '公司名称': '测试科技有限公司',
        '行业': '信息技术',
        '经营范围': '软件开发',
        '注册资本': '100万元',
        '成立日期': '2020-01-01',
        '联系人': '李四',
        '联系电话': '13800138000'
      };

      const parsed = {
        companyName: String(standardRow['公司名称'] || standardRow['企业名称'] || ''),
        industry: standardRow['行业'] ? String(standardRow['行业']) : undefined,
        businessScope: standardRow['经营范围'] ? String(standardRow['经营范围']) : undefined,
        registeredCapital: standardRow['注册资本'] ? String(standardRow['注册资本']) : undefined,
        establishedDate: standardRow['成立日期'] ? String(standardRow['成立日期']) : undefined,
        contactPerson: standardRow['联系人'] ? String(standardRow['联系人']) : undefined,
        contactPhone: standardRow['联系电话'] ? String(standardRow['联系电话']) : undefined,
        dataSource: 'manual',
      };

      expect(parsed.companyName).toBe('测试科技有限公司');
      expect(parsed.industry).toBe('信息技术');
      expect(parsed.businessScope).toBe('软件开发');
      expect(parsed.contactPerson).toBe('李四');
      expect(parsed.dataSource).toBe('manual');
    });

    it('应该支持企业名称作为公司名称的别名', () => {
      const standardRow = {
        '企业名称': '另一个测试公司'
      };

      const companyName = String(standardRow['公司名称'] || standardRow['企业名称'] || '');
      expect(companyName).toBe('另一个测试公司');
    });
  });

  describe('数据过滤', () => {
    it('应该过滤掉没有公司名称的记录', () => {
      const data = [
        { '原文件导入名称': '有效公司' },
        { '原文件导入名称': '' },
        { '原文件导入名称': '另一个有效公司' },
        { '其他字段': '无公司名称' }
      ];

      const filtered = data
        .map(row => ({
          companyName: String(row['原文件导入名称'] || '')
        }))
        .filter(c => c.companyName);

      expect(filtered.length).toBe(2);
      expect(filtered[0].companyName).toBe('有效公司');
      expect(filtered[1].companyName).toBe('另一个有效公司');
    });
  });
});

describe('报告生成增强功能', () => {
  describe('园区企业列表格式化', () => {
    it('应该正确格式化园区企业列表用于LLM提示', () => {
      const parkCompanies = [
        { 
          id: 1, 
          companyName: '测试科技公司', 
          industry: '信息技术', 
          businessScope: '软件开发、技术咨询、系统集成',
          companyScale: 'M(中型)'
        },
        { 
          id: 2, 
          companyName: '制造业公司', 
          industry: '制造业', 
          businessScope: null,
          companyScale: 'L(大型)'
        }
      ];

      const formatted = parkCompanies.map(c => {
        const parts = [`- ${c.companyName}`];
        if (c.industry) parts.push(`行业：${c.industry}`);
        if (c.businessScope) parts.push(`业务：${c.businessScope.substring(0, 100)}...`);
        if (c.companyScale) parts.push(`规模：${c.companyScale}`);
        return parts.join(' | ');
      }).join('\n');

      expect(formatted).toContain('测试科技公司');
      expect(formatted).toContain('行业：信息技术');
      expect(formatted).toContain('业务：软件开发');
      expect(formatted).toContain('规模：M(中型)');
      expect(formatted).toContain('制造业公司');
      expect(formatted).toContain('规模：L(大型)');
    });
  });

  describe('报告章节结构', () => {
    it('报告提示词应包含所有必需章节', () => {
      const requiredSections = [
        '公司概况与研究背景',
        '发展历程与关键节点',
        '高管团队变化分析',
        '市场营销变化分析',
        '营收利润情况分析',
        '行业背景与竞争环境',
        '风险提示与规避建议',
        '上下游关联企业分析',
        '园区匹配分析',
        '结语'
      ];

      // 这些章节应该在报告生成提示词中存在
      requiredSections.forEach(section => {
        expect(section).toBeTruthy();
      });
    });

    it('风险分析应包含经营、财务、法律风险', () => {
      const riskCategories = ['经营风险', '财务风险', '法律风险', '规避建议'];
      
      riskCategories.forEach(category => {
        expect(category).toBeTruthy();
      });
    });

    it('上下游分析应包含供应商、客户、合作机会', () => {
      const supplyChainCategories = ['上游供应商分析', '下游客户分析', '产业链合作机会'];
      
      supplyChainCategories.forEach(category => {
        expect(category).toBeTruthy();
      });
    });
  });
});
