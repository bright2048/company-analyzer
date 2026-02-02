// 测试企查查Excel导入逻辑
import XLSX from 'xlsx';
import fs from 'fs';

const filePath = './test-import.xlsx';

console.log('=== 测试企查查Excel导入 ===\n');

// 读取文件
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('工作表列表:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('\n总行数:', data.length);
console.log('\n第一行数据的字段:');
if (data.length > 0) {
  console.log(Object.keys(data[0]));
  console.log('\n第一行数据内容:');
  console.log(JSON.stringify(data[0], null, 2));
}

// 检测是否为企查查导出格式
const isQichachaFormat = data.length > 0 && (
  '原文件导入名称' in data[0] || 
  '统一社会信用代码' in data[0] ||
  '登记状态' in data[0]
);

console.log('\n是否为企查查格式:', isQichachaFormat);

if (isQichachaFormat) {
  // 解析前3条数据
  const companies = data.slice(0, 3).map((row) => {
    const phone = row['电话'] ? String(row['电话']) : '';
    const morePhone = row['更多电话'] ? String(row['更多电话']) : '';
    const allPhones = [phone, morePhone].filter(p => p && p !== '-').join(';');
    
    return {
      companyName: String(row['原文件导入名称'] || ''),
      creditCode: row['统一社会信用代码'] ? String(row['统一社会信用代码']) : undefined,
      legalPerson: row['法定代表人'] ? String(row['法定代表人']) : undefined,
      companyStatus: row['登记状态'] ? String(row['登记状态']) : undefined,
      companyScale: row['企业规模'] ? String(row['企业规模']) : undefined,
      registeredCapital: row['注册资本'] ? String(row['注册资本']) : undefined,
      paidCapital: row['实缴资本'] ? String(row['实缴资本']) : undefined,
      contactPhone: allPhones || undefined,
      establishedDate: row['成立日期'] ? String(row['成立日期']) : undefined,
      province: row['所属省份'] ? String(row['所属省份']) : undefined,
      city: row['所属城市'] ? String(row['所属城市']) : undefined,
      district: row['所属区县'] ? String(row['所属区县']) : undefined,
      address: row['企业地址'] ? String(row['企业地址']) : undefined,
      dataSource: 'qichacha_import',
    };
  }).filter(c => c.companyName);

  console.log('\n解析后的前3条数据:');
  companies.forEach((c, i) => {
    console.log(`\n--- 企业 ${i + 1} ---`);
    console.log(JSON.stringify(c, null, 2));
  });

  console.log('\n总共可导入企业数:', data.filter(row => row['原文件导入名称']).length);
}
