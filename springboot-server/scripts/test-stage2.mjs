#!/usr/bin/env node
/**
 * 第 2 阶段接口联调脚本（注册 / 个人资料 / 修改密码 / 分类）
 * -------------------------------------------
 * 零依赖，node:crypto 模拟前端 jsencrypt 的 RSA 加密。
 *
 * 用法：
 *   node scripts/test-stage2.mjs                  # 默认 http://localhost:3000
 *   node scripts/test-stage2.mjs 3100 admin 密码   # 自定义端口 + admin 账号（用于分类管理用例）
 *
 * 说明：
 * - 会真实创建一个临时用户（用户名 stage2_随机数，密码 stage2123），测完请手动删除：
 *   DELETE FROM users WHERE username LIKE 'stage2_%';
 * - 分类管理用例需要 admin 账号密码（你库里真实 admin 的密码）
 */
import crypto from 'node:crypto';

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const ADMIN_USER = process.argv[3];
const ADMIN_PWD = process.argv[4];

const TEST_USER = `stage2_${Date.now().toString(36)}`;
const TEST_PWD = 'stage2123';
const NEW_PWD = 'stage2999';
const TEST_PHONE = '13900001111';

function section(title) {
  console.log(`\n========== ${title} ==========`);
}

async function getPublicKey() {
  const res = await fetch(`${BASE}/api/auth/public-key`);
  const body = await res.json();
  if (body.code !== 200 || !body.data?.publicKey) throw new Error('公钥获取失败');
  return body.data.publicKey;
}

function rsaEncrypt(pubKey, text) {
  return crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(text, 'utf8')
  ).toString('base64');
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* 非 JSON */ }
  return { status: res.status, body: json };
}

function assert(cond, label) {
  if (cond) console.log(`✓ ${label}`);
  else { console.error(`✗ ${label}`); process.exitCode = 1; }
}

async function main() {
  const pubKey = await getPublicKey();
  console.log('✓ 公钥获取成功');

  // ========== 1. 注册 ==========
  section('1) POST /api/auth/register（新用户）');
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      username: TEST_USER,
      nickname: '阶段二测试',
      studentId: '2026999',
      college: '软件技术学院',
      password: rsaEncrypt(pubKey, TEST_PWD),
      phone: rsaEncrypt(pubKey, TEST_PHONE),
    },
  });
  console.log('HTTP', reg.status, JSON.stringify(reg.body));
  assert(reg.status === 200 && reg.body.code === 200 && reg.body.message === '注册成功', '注册成功');
  assert(reg.body.data?.user?.password === undefined, '返回 user 不含 password');
  assert(reg.body.data?.user?.role === 'user' && reg.body.data?.user?.status === 1, 'role=user / status=1');
  assert(reg.body.data?.user?.avatar === '/uploads/default-avatar.svg', 'avatar 为模型默认值');
  assert(reg.body.data?.user?.phone === TEST_PHONE, '手机号解密正确');
  const token = reg.body.data?.token;

  // 注册负向用例
  section('1.1) 注册负向用例');
  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: { username: TEST_USER, password: rsaEncrypt(pubKey, TEST_PWD) },
  });
  assert(dup.status === 400 && dup.body.message === '用户名已存在', `重复用户名 → 400 用户名已存在 (实际: ${dup.body?.message})`);
  const short = await api('/api/auth/register', {
    method: 'POST',
    body: { username: 'ab', password: rsaEncrypt(pubKey, '123456') },
  });
  assert(short.status === 400 && short.body.message === '用户名长度3-20个字符', '短用户名 → 400 用户名长度3-20个字符');
  const badPwd = await api('/api/auth/register', {
    method: 'POST',
    body: { username: 'stage2_badpwd', password: rsaEncrypt(pubKey, '123') },
  });
  assert(badPwd.status === 400 && badPwd.body.message === '密码长度6-20个字符', '短密码 → 400 密码长度6-20个字符');

  // ========== 2. 登录新用户 ==========
  section('2) POST /api/auth/login（新用户）');
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { username: TEST_USER, password: rsaEncrypt(pubKey, TEST_PWD) },
  });
  assert(login.status === 200 && login.body.message === '登录成功', '新用户登录成功');

  // ========== 3. 个人资料 ==========
  section('3) GET /api/auth/profile');
  const profile = await api('/api/auth/profile', { token });
  console.log('HTTP', profile.status, JSON.stringify(profile.body));
  assert(profile.status === 200 && profile.body.data?.username === TEST_USER, 'profile 返回当前用户');

  section('3.1) 鉴权负向用例');
  const noToken = await api('/api/auth/profile');
  assert(noToken.status === 401 && noToken.body?.message === '未登录或token已失效', '无 token → 401 未登录或token已失效');
  assert(noToken.body?.data === undefined, '401 响应无 data 字段');
  const badToken = await api('/api/auth/profile', { token: 'abc.def.ghi' });
  assert(badToken.status === 401 && badToken.body?.message === 'token无效或已过期', '坏 token → 401 token无效或已过期');

  section('4) PUT /api/auth/profile（更新昵称+学院）');
  const upd = await api('/api/auth/profile', {
    method: 'PUT',
    token,
    body: { nickname: '改名了', college: '计算机学院' },
  });
  console.log('HTTP', upd.status, JSON.stringify(upd.body));
  assert(upd.status === 200 && upd.body.data?.nickname === '改名了' && upd.body.data?.college === '计算机学院', '资料更新生效');

  // ========== 4. 修改密码 ==========
  section('5) PUT /api/auth/password');
  const cp = await api('/api/auth/password', {
    method: 'PUT',
    token,
    body: {
      oldPassword: rsaEncrypt(pubKey, TEST_PWD),
      newPassword: rsaEncrypt(pubKey, NEW_PWD),
    },
  });
  console.log('HTTP', cp.status, JSON.stringify(cp.body));
  assert(cp.status === 200 && cp.body.message === '密码修改成功', '修改密码成功');

  const oldLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { username: TEST_USER, password: rsaEncrypt(pubKey, TEST_PWD) },
  });
  assert(oldLogin.status === 400 && oldLogin.body.message === '用户名或密码错误', '旧密码登录被拒');

  const newLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { username: TEST_USER, password: rsaEncrypt(pubKey, NEW_PWD) },
  });
  assert(newLogin.status === 200 && newLogin.body.message === '登录成功', '新密码登录成功');

  const wrongOld = await api('/api/auth/password', {
    method: 'PUT',
    token,
    body: {
      oldPassword: rsaEncrypt(pubKey, 'wrongpass'),
      newPassword: rsaEncrypt(pubKey, 'whatever9'),
    },
  });
  assert(wrongOld.status === 400 && wrongOld.body.message === '原密码错误', '原密码错误 → 400 原密码错误');

  // ========== 5. 分类 ==========
  section('6) GET /api/categories');
  const cats = await api('/api/categories');
  console.log('HTTP', cats.status, '| 分类数:', cats.body?.data?.length);
  assert(cats.status === 200 && Array.isArray(cats.body?.data), '分类列表返回数组');
  if (cats.body?.data?.length) {
    const first = cats.body.data[0];
    console.log('  首条:', JSON.stringify({ id: first.id, name: first.name, icon: first.icon, sort: first.sort, status: first.status }));
    assert(typeof first.id === 'number', '分类 id 为 number');
  }

  // 分类管理（需 admin）
  if (ADMIN_USER && ADMIN_PWD) {
    section('7) 分类管理（admin）');
    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { username: ADMIN_USER, password: rsaEncrypt(pubKey, ADMIN_PWD) },
    });
    assert(adminLogin.status === 200, 'admin 登录成功');
    const adminToken = adminLogin.body?.data?.token;

    // 普通用户创建分类 → 403
    const forbidden = await api('/api/categories', { method: 'POST', token, body: { name: '越权分类' } });
    assert(forbidden.status === 403 && forbidden.body?.message === '无权限访问', `普通用户创建分类 → 403 (实际: ${forbidden.status})`);
    assert(forbidden.body?.data === undefined, '403 响应无 data 字段');

    // admin 创建
    const created = await api('/api/categories', {
      method: 'POST',
      token: adminToken,
      body: { name: '阶段二测试分类', icon: 'Test', sort: 66 },
    });
    console.log('HTTP', created.status, JSON.stringify(created.body));
    assert(created.status === 200 && created.body.message === '创建成功', 'admin 创建分类成功');
    const catId = created.body?.data?.id;
    assert(created.body?.data?.status === 1 && created.body?.data?.sort === 66, '分类默认 status=1 / sort 生效');

    // 空名称 → 400
    const emptyName = await api('/api/categories', { method: 'POST', token: adminToken, body: { name: '' } });
    assert(emptyName.status === 400 && emptyName.body.message === '分类名称不能为空', '空名称 → 400 分类名称不能为空');

    // 更新
    const updated = await api(`/api/categories/${catId}`, {
      method: 'PUT',
      token: adminToken,
      body: { name: '阶段二测试分类-改', sort: 88 },
    });
    assert(updated.status === 200 && updated.body.data?.name === '阶段二测试分类-改' && updated.body.data?.sort === 88, '更新分类成功');

    // 不存在的分类 → 404
    const notFound = await api('/api/categories/999999', { method: 'PUT', token: adminToken, body: { name: 'x' } });
    assert(notFound.status === 404 && notFound.body.message === '分类不存在', '不存在分类 → 404 分类不存在');

    // 删除
    const removed = await api(`/api/categories/${catId}`, { method: 'DELETE', token: adminToken });
    assert(removed.status === 200 && removed.body.message === '删除成功', '删除分类成功');
    const afterDelete = await api('/api/categories');
    assert(!afterDelete.body?.data?.some(c => c.id === catId), '删除后列表不再包含该分类');
  } else {
    console.log('\n（未提供 admin 账号，跳过分类管理用例。可加参数：node scripts/test-stage2.mjs 3000 admin 密码）');
  }

  console.log('\n==========================================');
  console.log('✅ 第 2 阶段用例执行完毕');
  console.log('⚠️  请清理测试数据：');
  console.log(`   DELETE FROM users WHERE username LIKE 'stage2_%';`);
  console.log('==========================================');
}

main().catch((e) => {
  console.error('执行出错:', e.message);
  process.exit(1);
});
