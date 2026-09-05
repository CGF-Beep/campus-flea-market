// 直接调用 dashboard 控制器，验证接口真实返回的趋势值（绕过登录）
const ctrl = require('../src/controllers/adminController');

ctrl.dashboard({}, {
  json: (data) => {
    console.log('接口实际返回 trends:', JSON.stringify(data.data.trends));
    console.log('userCount:', data.data.userCount, ' productCount:', data.data.productCount, ' orderCount:', data.data.orderCount, ' totalSales:', data.data.totalSales);
    process.exit(0);
  }
}).catch(e => { console.error('ERR:', e.message); process.exit(1); });
