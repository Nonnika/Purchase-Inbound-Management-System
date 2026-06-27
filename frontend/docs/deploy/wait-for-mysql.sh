#!/bin/sh
# =============================================================================
# 后端启动前等待 MySQL 端口可连
# compose 的 depends_on healthcheck 已保证 MySQL 就绪，此脚本作为额外保险，
# 防止 healthcheck 误判或 init.sql 尚未跑完时后端 Ping 失败导致 crash-loop。
# 用法：wait-for-mysql.sh <要启动的命令...>
# =============================================================================
set -e

host="${DB_ADDR:-db}"
port="${DB_PORT:-3306}"
max_wait="${MYSQL_WAIT_TIMEOUT:-60}"
elapsed=0

echo "[pims-backend] waiting for MySQL at ${host}:${port} ..."
while ! nc -z "$host" "$port" 2>/dev/null; do
  if [ "$elapsed" -ge "$max_wait" ]; then
    echo "[pims-backend] MySQL not reachable after ${max_wait}s, giving up."
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
echo "[pims-backend] MySQL is reachable (${elapsed}s). Starting backend."

exec "$@"
