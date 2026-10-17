/**
 * 诊断：本地运行中的后端是否加载了最新代码？
 *
 * 背景：改动后端代码后，如果 3000 端口上还挂着旧的 node/nodemon 进程，
 * 浏览器（经 vite proxy）打到的就是旧代码，表现为「代码明明写了但没生效」。
 *
 * 做法：用当前磁盘上的代码临时起一个实例（随机端口），
 * 对比它与 3000 端口对新接口的响应差异。
 *
 * 用法：node scripts/check-running-server.js
 */
require('dotenv').config();

const PROBE_PATH = '/api/users/2'; // 较新加入的接口，旧进程会返回 404
const TARGET_PORT = 3000;
const PROBE_PORT = 4137;

async function fetchStatus(base, path) {
  try {
    const r = await fetch(base + path);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: null, err: e.message };
  }
}

async function main() {
  console.log('=== 后端代码新鲜度诊断 ===\n');

  // 1) 探运行中的实例
  const running = await fetchStatus(`http://127.0.0.1:${TARGET_PORT}`, PROBE_PATH);

  if (running.status === null) {
    console.log(`⚠️  ${TARGET_PORT} 端口无响应：后端可能没启动`);
    console.log('   → 执行：cd server && npm run dev');
    return;
  }
  console.log(`运行中的实例 (${TARGET_PORT})  ${PROBE_PATH} -> HTTP ${running.status}`);

  // 2) 用当前磁盘代码起一个临时实例做对照
  const express = require('express');
  const routes = require('../src/routes');
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = await new Promise((resolve) => {
    const s = app.listen(PROBE_PORT, () => resolve(s));
  });

  const fresh = await fetchStatus(`http://127.0.0.1:${PROBE_PORT}`, PROBE_PATH);
  console.log(`磁盘上的代码 (${PROBE_PORT})  ${PROBE_PATH} -> HTTP ${fresh.status}`);
  server.close();

  // 3) 结论
  console.log('');
  if (running.status === 404 && fresh.ok) {
    console.log('❌ 结论：运行中的后端是【旧进程】，未加载最新代码。');
    console.log('   → 这就是「改了代码但没生效」的原因。');
    console.log(`   → 处理：先结束占用 ${TARGET_PORT} 端口的进程，再重启后端。`);
    console.log('');
    console.log('   Windows 查看占用进程：');
    console.log(`     netstat -ano | findstr :${TARGET_PORT}`);
    console.log('     然后 taskkill /PID <上面查到的PID> /F');
    console.log('');
    console.log('   一句话搞定（Git Bash / PowerShell）：');
    console.log(`     taskkill //F //PID $(netstat -ano | grep :${TARGET_PORT} | grep LISTENING | head -1 | awk '{print $NF}')`);
  } else if (running.ok && fresh.ok) {
    console.log('✅ 结论：运行中的后端已加载最新代码，接口正常。');
  } else {
    console.log(`⚠️  两侧响应不一致（运行中 ${running.status} / 磁盘 ${fresh.status}），请人工确认。`);
  }
}

main().catch((e) => {
  console.error('诊断失败:', e.message);
  process.exitCode = 1;
});
