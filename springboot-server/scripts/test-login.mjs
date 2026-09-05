#!/usr/bin/env node
/**
 * 第 1 阶段接口联调脚本（登录 + 商品列表）
 * -------------------------------------------
 * 零依赖，仅用 Node 内置 crypto 模拟前端 jsencrypt 的 RSA 加密流程：
 *   1. GET  /api/auth/public-key          获取公钥
 *   2. RSA PKCS#1 v1.5 加密密码（与前端 jsencrypt 默认完全一致）
 *   3. POST /api/auth/login               登录
 *   4. GET  /api/products                 商品列表
 *
 * 用法：
 *   node scripts/test-login.mjs                     # 默认 http://localhost:3000，账号 student / 123456
 *   node scripts/test-login.mjs 8080 admin 123456   # 自定义端口与账号
 */
import crypto from 'node:crypto';

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const USERNAME = process.argv[3] || 'student';
const PASSWORD = process.argv[4] || '123456';

function section(title) {
  console.log(`\n========== ${title} ==========`);
}

async function main() {
  // 1. 获取公钥
  section('1) GET /api/auth/public-key');
  const keyRes = await fetch(`${BASE}/api/auth/public-key`);
  const keyBody = await keyRes.json();
  console.log('HTTP', keyRes.status, JSON.stringify({ code: keyBody.code, hasPublicKey: !!keyBody.data?.publicKey }));
  if (keyBody.code !== 200 || !keyBody.data?.publicKey) {
    console.error('✗ 公钥获取失败，中止。');
    process.exit(1);
  }
  console.log('✓ 公钥获取成功（前 60 字符）:', keyBody.data.publicKey.slice(0, 60) + '...');

  // 2. RSA 加密密码（PKCS#1 v1.5，与 jsencrypt 默认一致）
  const encrypted = crypto.publicEncrypt(
    { key: keyBody.data.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(PASSWORD, 'utf8')
  ).toString('base64');

  // 3. 登录
  section('2) POST /api/auth/login');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: encrypted }),
  });
  const loginBody = await loginRes.json();
  console.log('HTTP', loginRes.status, JSON.stringify(loginBody, null, 2));
  if (loginRes.status !== 200) {
    console.error(`✗ 登录失败（${loginBody.message}）。若提示密码错误，请确认你数据库里该账号的密码。`);
    process.exit(1);
  }
  const token = loginBody.data.token;
  console.log('✓ 登录成功，token 前 40 字符:', token.slice(0, 40) + '...');
  console.log('✓ 返回 user 字段:', Object.keys(loginBody.data.user).join(', '));
  console.log('✓ user.password 是否泄漏:', loginBody.data.user.password === undefined ? '否' : '是(严重!)');

  // 3.5 错误密码负向用例
  section('2.5) 错误密码（期望 400 用户名或密码错误）');
  const badEncrypted = crypto.publicEncrypt(
    { key: keyBody.data.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from('wrong-pass', 'utf8')
  ).toString('base64');
  const badRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: badEncrypted }),
  });
  const badBody = await badRes.json();
  console.log('HTTP', badRes.status, JSON.stringify(badBody));
  if (badRes.status === 400 && badBody.message === '用户名或密码错误') {
    console.log('✓ 负向用例通过');
  } else {
    console.log('✗ 负向用例不符合预期');
  }

  // 4. 商品列表
  section('3) GET /api/products?page=1&pageSize=10');
  const listRes = await fetch(`${BASE}/api/products?page=1&pageSize=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listBody = await listRes.json();
  const data = listBody.data;
  console.log('HTTP', listRes.status, '| code:', listBody.code, '| total:', data?.total, '| page:', data?.page, '| pageSize:', data?.pageSize, '| totalPages:', data?.totalPages);
  if (!Array.isArray(data?.list)) {
    console.error('✗ list 不是数组，响应：', JSON.stringify(listBody));
    process.exit(1);
  }
  console.log('✓ 本页商品数:', data.list.length);
  if (data.list.length > 0) {
    const first = data.list[0];
    console.log('✓ 首条商品:', JSON.stringify({
      id: first.id, title: first.title, price: first.price, originalPrice: first.originalPrice,
      condition: first.condition, status: first.status, views: first.views,
      images: first.images, user: first.user, category: first.category,
      createdAt: first.createdAt,
    }, null, 2));
    console.log('✓ price 是否为字符串:', typeof first.price === 'string' ? '是' : `否(实际 ${typeof first.price})`);
    console.log('✓ createdAt 格式:', first.createdAt);
  }

  // 5. 健康检查
  section('4) GET /health');
  const healthRes = await fetch(`${BASE}/health`);
  console.log('HTTP', healthRes.status, await healthRes.text());

  console.log('\n✅ 全部用例执行完毕。');
}

main().catch((e) => {
  console.error('执行出错:', e.message);
  console.error('请确认 Spring Boot 已启动且监听在', BASE);
  process.exit(1);
});
