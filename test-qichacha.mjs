/**
 * 企查查API测试脚本
 * 用于验证企查查API配置是否正确
 * 
 * 使用方法：
 * 1. 确保已配置环境变量 QICHACHA_APP_KEY 和 QICHACHA_SECRET_KEY
 * 2. 运行: node test-qichacha.mjs
 */

import crypto from 'crypto';

// 从环境变量读取配置
let appKey = process.env.QICHACHA_APP_KEY;
let secretKey = process.env.QICHACHA_SECRET_KEY;

// 如果环境变量没配置，尝试从命令行参数读取
if (!appKey && process.argv[2]) {
  appKey = process.argv[2];
}
if (!secretKey && process.argv[3]) {
  secretKey = process.argv[3];
}

console.log('='.repeat(60));
console.log('企查查API配置检测');
console.log('='.repeat(60));

// 检查环境变量
console.log('\n1. 检查环境变量配置:');
console.log(`   QICHACHA_APP_KEY: ${appKey ? '已配置 (' + appKey.substring(0, 8) + '...)' : '❌ 未配置'}`);
console.log(`   QICHACHA_SECRET_KEY: ${secretKey ? '已配置 (' + secretKey.substring(0, 8) + '...)' : '❌ 未配置'}`);

if (!appKey || !secretKey) {
  console.log('\n❌ 错误: 请先配置 QICHACHA_APP_KEY 和 QICHACHA_SECRET_KEY 环境变量');
  console.log('\n配置方法:');
  console.log('   方法1: 在 .env 文件中添加:');
  console.log('   QICHACHA_APP_KEY=你的AppKey');
  console.log('   QICHACHA_SECRET_KEY=你的SecretKey');
  console.log('\n   方法2: 直接设置环境变量:');
  console.log('   export QICHACHA_APP_KEY=你的AppKey');
  console.log('   export QICHACHA_SECRET_KEY=你的SecretKey');
  process.exit(1);
}

// 生成签名
function generateSign(appKey, secretKey, timestamp) {
  const signStr = appKey + timestamp + secretKey;
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

// 测试企业模糊搜索API
async function testFuzzySearch(keyword) {
  console.log(`\n2. 测试企业模糊搜索API (关键词: "${keyword}"):`);
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = generateSign(appKey, secretKey, timestamp);
  
  const url = `https://api.qichacha.com/FuzzySearch/GetList?key=${appKey}&searchKey=${encodeURIComponent(keyword)}`;
  
  console.log(`   请求URL: ${url.substring(0, 80)}...`);
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Token: ${sign}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Token': sign,
        'Timespan': timestamp,
      },
    });
    
    const data = await response.json();
    
    console.log(`\n   响应状态码: ${response.status}`);
    console.log(`   API返回Status: ${data.Status}`);
    console.log(`   API返回Message: ${data.Message || '无'}`);
    
    if (data.Status === '200') {
      console.log(`\n   ✅ API调用成功!`);
      console.log(`   返回企业数量: ${data.Result?.length || 0}`);
      
      if (data.Result && data.Result.length > 0) {
        console.log('\n   前3条结果:');
        data.Result.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.Name}`);
          console.log(`      统一社会信用代码: ${item.CreditCode}`);
          console.log(`      法定代表人: ${item.OperName || '未知'}`);
          console.log(`      状态: ${item.Status || '未知'}`);
        });
      }
      return true;
    } else {
      console.log(`\n   ❌ API调用失败!`);
      console.log(`   错误信息: ${data.Message || '未知错误'}`);
      
      // 常见错误码说明
      const errorCodes = {
        '101': 'AppKey不存在或已被禁用',
        '102': '签名验证失败，请检查SecretKey是否正确',
        '103': '请求参数错误',
        '104': '账户余额不足',
        '105': 'IP未授权',
        '106': '请求频率超限',
      };
      
      if (errorCodes[data.Status]) {
        console.log(`   可能原因: ${errorCodes[data.Status]}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`\n   ❌ 请求异常: ${error.message}`);
    return false;
  }
}

// 运行测试
async function runTests() {
  // 测试搜索
  const testKeyword = '华为';
  const searchSuccess = await testFuzzySearch(testKeyword);
  
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  
  if (searchSuccess) {
    console.log('\n✅ 企查查API配置正确，可以正常使用!');
    console.log('\n提示: 每次调用企业模糊搜索API费用为 ¥0.10');
  } else {
    console.log('\n❌ 企查查API配置有问题，请检查:');
    console.log('   1. AppKey 和 SecretKey 是否正确');
    console.log('   2. 账户是否有余额');
    console.log('   3. IP是否已授权（如果开启了IP白名单）');
    console.log('   4. API是否已开通（需要在企查查开放平台开通）');
  }
}

runTests();
