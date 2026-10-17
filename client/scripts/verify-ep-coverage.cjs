/**
 * 校验：模板里用到的每个 el-* 组件，其样式是否都打进了 dist CSS。
 * 用法: node verify-ep-coverage.cjs <srcDir> <distAssetsDir>
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const DIST = process.argv[3];

function walk(d, acc = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (f.endsWith('.vue')) acc.push(p);
  }
  return acc;
}

const used = new Map();
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/<(el-[a-z0-9-]+)([\s>])/g)) {
    const tag = m[1];
    if (!used.has(tag)) used.set(tag, new Set());
    used.get(tag).add(path.basename(file));
  }
}

const css = fs.readdirSync(DIST)
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(DIST, f), 'utf8'))
  .join('\n');

// 少数组件没有独立样式类，或类名与标签不同名，单独映射
const ALIAS = {
  'el-icon': '.el-icon',
  'el-button-group': '.el-button-group',
  'el-option': '.el-select-dropdown__item',
  'el-option-group': '.el-select-group',
  'el-table-column': '.el-table',
  'el-pagination': '.el-pagination',
  'el-radio-button': '.el-radio-button',
  'el-checkbox-group': '.el-checkbox',
  'el-radio-group': '.el-radio'
};

const missing = [];
console.log('组件样式覆盖检查：');
for (const [tag, files] of [...used].sort()) {
  const cls = ALIAS[tag] || '.' + tag;
  const ok = css.includes(cls);
  if (!ok) missing.push([tag, [...files].join(', ')]);
  console.log(`  ${ok ? 'OK  ' : 'MISS'} ${tag}${ok ? '' : '   <- 出现在: ' + [...files].join(', ')}`);
}
console.log(`\n共使用 ${used.size} 个 el-* 组件，缺失样式 ${missing.length} 个。`);
if (missing.length) {
  console.log('缺失清单:');
  missing.forEach(([t, f]) => console.log(`  - ${t} (${f})`));
}
