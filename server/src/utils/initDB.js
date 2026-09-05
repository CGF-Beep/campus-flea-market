const { Sequelize } = require('sequelize');
const crypto = require('crypto');
require('dotenv').config();

// 生成随机强密码（12位，含大小写字母与数字）
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12)).map(b => chars[b % chars.length]).join('');
}

async function initDB() {
  console.log('开始初始化数据库...');
  
  try {
    // 第一步：先连接MySQL（不指定数据库）创建数据库
    const tempSequelize = new Sequelize(
      '',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '123456',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
      }
    );
    await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log('数据库创建/确认成功');
    await tempSequelize.close();

    // 第二步：引入模型并同步
    const { sequelize, User, Category, Product } = require('../models');
    await sequelize.sync({ force: false });
    console.log('数据表同步成功');

    // ========== 初始化分类数据 ==========
    const categoryCount = await Category.count();
    if (categoryCount === 0) {
      await Category.bulkCreate([
        { name: '教材资料', icon: '📚' },
        { name: '数码产品', icon: '💻' },
        { name: '生活用品', icon: '🏠' },
        { name: '体育器材', icon: '⚽' },
        { name: '服装配饰', icon: '👕' },
        { name: '美妆个护', icon: '💄' },
        { name: '其他', icon: '📦' }
      ]);
      console.log('分类数据初始化成功');
    }

    // ========== 初始化管理员账号（随机强密码，仅初始化时打印一次） ==========
    const adminCount = await User.count({ where: { role: 'admin' } });
    let adminPassword = null;
    if (adminCount === 0) {
      adminPassword = generatePassword();
      await User.create({
        username: 'admin',
        password: adminPassword,
        nickname: '系统管理员',
        avatar: '/uploads/default-avatar-admin.svg',
        role: 'admin',
        status: 1
      });
      console.log('管理员账号创建成功: 用户名 admin');
    }

    // ========== 初始化测试用户（随机强密码） ==========
    let studentPassword = null;
    const testUser = await User.findOne({ where: { username: 'student' } });
    if (!testUser) {
      studentPassword = generatePassword();
      await User.create({
        username: 'student',
        password: studentPassword,
        nickname: '测试用户',
        avatar: '/uploads/default-avatar.svg',
        role: 'user',
        status: 1
      });
      console.log('测试用户创建成功: 用户名 student');
    }

    // ========== 初始化测试商品 ==========
    const productCount = await Product.count();
    if (productCount === 0) {
      const adminUser = await User.findOne({ where: { role: 'admin' } });
      const [books, digital, life] = await Promise.all([
        Category.findOne({ where: { name: '教材资料' } }),
        Category.findOne({ where: { name: '数码产品' } }),
        Category.findOne({ where: { name: '生活用品' } })
      ]);

      await Product.bulkCreate([
        {
          title: '高等数学（第七版）上',
          description: '同济大学出版，九成新，无笔记划线，学弟学妹可放心入手',
          price: 15.00,
          originalPrice: 45.00,
          images: JSON.stringify(['/uploads/products/demo1.jpg']),
          categoryId: books ? books.id : null,
          sellerId: adminUser ? adminUser.id : null,
          status: 'approved',
          stock: 1
        },
        {
          title: '全新蓝牙耳机',
          description: '活动抽奖获得，全新未拆封，音质不错',
          price: 88.00,
          originalPrice: 199.00,
          images: JSON.stringify(['/uploads/products/demo2.jpg']),
          categoryId: digital ? digital.id : null,
          sellerId: adminUser ? adminUser.id : null,
          status: 'approved',
          stock: 1
        },
        {
          title: '宿舍小风扇',
          description: '毕业出，用了两年，功能正常，适合宿舍夏天用',
          price: 20.00,
          originalPrice: 59.00,
          images: JSON.stringify(['/uploads/products/demo3.jpg']),
          categoryId: life ? life.id : null,
          sellerId: adminUser ? adminUser.id : null,
          status: 'approved',
          stock: 1
        }
      ]);
      console.log('测试商品初始化成功');
    }

    console.log('\n==============================');
    console.log('数据库初始化完成！');
    if (adminPassword) {
      console.log(`管理员初始密码: ${adminPassword}（请立即登录后修改，此密码不再重复显示）`);
    }
    if (studentPassword) {
      console.log(`测试用户初始密码: ${studentPassword}（请立即登录后修改）`);
    }
    console.log('==============================');
    process.exit(0);
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    process.exit(1);
  }
}

initDB();
