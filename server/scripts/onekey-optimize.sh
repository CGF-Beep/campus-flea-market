#!/usr/bin/env bash
# ============================================================
# 校园二手平台 · 一键优化脚本（在服务器上执行）
#   1) 备份 uploads 目录 + 数据库
#   2) 历史图片转 WebP 并补齐缩略图（解决列表页 404 + 慢）
#   3) 补数据库复合索引
#   4) 重启服务
#
# 用法：
#   cd campus-flea-market/server
#   chmod +x scripts/onekey-optimize.sh
#   bash scripts/onekey-optimize.sh
#
# 如果报错 "bad interpreter" 或语法错误，先执行（解决 Windows 换行符问题）：
#   sed -i 's/\r$//' scripts/onekey-optimize.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=============================================="
echo "  校园二手平台 · 一键优化（图片 + 索引）"
echo "  当前目录: $(pwd)"
echo "=============================================="

# ---------- 0. 环境检查 ----------
command -v node >/dev/null 2>&1 || { echo "❌ 找不到 node 命令，请确认 Node 已安装并在 PATH 中"; exit 1; }
[ -f .env ] || { echo "❌ 当前目录下没有 .env，请确认在 server 目录执行"; exit 1; }

DB_USER=$(grep -E '^DB_USER=' .env | head -1 | cut -d= -f2- | tr -d '\r"')
DB_PASS=$(grep -E '^DB_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '\r"')
DB_NAME=$(grep -E '^DB_NAME=' .env | head -1 | cut -d= -f2- | tr -d '\r"')
DB_HOST=$(grep -E '^DB_HOST=' .env | head -1 | cut -d= -f2- | tr -d '\r"')
DB_PORT=$(grep -E '^DB_PORT=' .env | head -1 | cut -d= -f2- | tr -d '\r"')
DB_NAME=${DB_NAME:-campus_flea_market}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}

TS=$(date +%Y%m%d-%H%M%S)

# ---------- 1. 备份 uploads ----------
echo
echo "[1/4] 备份 uploads 目录 -> backup-uploads-$TS/"
cp -r src/uploads "backup-uploads-$TS"
echo "      完成"

# ---------- 1.5 备份数据库 ----------
echo "[2/4] 备份数据库 -> backup-db-$TS.sql"
if command -v mysqldump >/dev/null 2>&1; then
  mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "backup-db-$TS.sql" 2>/dev/null
  echo "      完成：$(du -h "backup-db-$TS.sql" | cut -f1)"
else
  echo "      ⚠️ 未找到 mysqldump，已跳过（建议自行手动备份数据库）"
fi

# ---------- 2. 图片迁移 ----------
echo
echo "[3/4] 图片迁移（先跑 dry-run 预览，不改任何东西）"
node scripts/optimize-legacy-images.js --dry-run

echo
read -r -p "确认执行图片迁移？(输入 yes 执行 / 其它任意键跳过) " ans
if [ "$ans" = "yes" ]; then
  node scripts/optimize-legacy-images.js
  echo "      图片迁移完成"
else
  echo "      已跳过图片迁移"
fi

# ---------- 3. 索引 ----------
echo
echo "[4/4] 补数据库复合索引"
node scripts/add-indexes.js

# ---------- 4. 重启 ----------
echo
read -r -p "现在重启服务？(输入 yes 重启 / 其它任意键稍后手动重启) " ans2
if [ "$ans2" = "yes" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart all
    echo "      已重启（pm2）"
  else
    echo "      ⚠️ 未找到 pm2，请手动重启你的 Node 服务"
  fi
else
  echo "      已跳过重启（记得稍后手动重启，脚本改动才会生效）"
fi

echo
echo "=============================================="
echo "  全部完成 ✅"
echo "  回滚用文件：backup-uploads-$TS/ 与 backup-db-$TS.sql"
echo "  提示：确认一切正常后，uploads/_legacy_backup/ 和 backup-* 可删除释放空间"
echo "=============================================="
