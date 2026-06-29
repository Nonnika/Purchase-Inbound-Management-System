# PIMS Docker Compose 部署指南（Linux 服务器）

本指南把 PIMS（Go 后端 + React 前端 + MySQL）打包成 Docker Compose，一键部署到 Linux 服务器。部署产物全部位于 `frontend/docs/deploy/`，需按下面步骤把其中几份文件放到仓库根目录，并应用一处后端代码补丁。

---

## 0. 架构与端口

```
浏览器 ──HTTP:80──▶ [frontend 容器: nginx]
                        │ 静态资源 dist
                        │ /api/ ──proxy──▶ [backend 容器: gin :8080]
                        │                      │ tcp 3306
                        │                      ▼
                        │                 [db 容器: mysql 8.0]
                        │                      │
                        └── volumes: db_data (持久化)
```

| 服务 | 容器端口 | 主机端口（默认） | 说明 |
|------|----------|------------------|------|
| db | 3306 | 不发布 | MySQL 8.0，首次启动自动跑 `init.sql` |
| backend | 8080 | 不发布 | Go/Gin，所有路由在 `/api` 下 |
| frontend | 80 | 80（`WEB_PORT` 可改） | Nginx 托管 SPA + 反代 `/api` |

> 默认只发布 `WEB_PORT`（80/443），`backend` 与 `db` 仅容器间互通。如需临时调试数据库或后端接口，再显式添加端口映射。

---

## 1. 前置条件（服务器）

```bash
# Docker Engine + Compose v2（插件）
docker --version          # >= 20.10
docker compose version    # >= 2.0

# 若未安装（Ubuntu/Debian 示例）
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # 重新登录生效
```

---

## 2. 后端 DB_ADDR 支持（已应用 ✅）

后端 `internal/config/config.go` 已支持从环境变量读取数据库地址，DSN 不再硬编码 `127.0.0.1`：

```go
type Config struct {
	user, password, addr, port, params string
	Dsn                                string
}

func (c *Config) Init(dbName string) {
	c.Dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?%s", c.user, c.password, c.addr, c.port, dbName, c.params)
}
```

`cmd/server/main.go` 通过 `DB_ADDR` 传入：

```go
cfg := config.NewConfig(os.Getenv("DB_USER"), os.Getenv("DB_PASSWD"), os.Getenv("DB_ADDR"), os.Getenv("DB_PORT"), os.Getenv("DB_PARAMS"))
```

> ⚠️ 环境变量名是 **`DB_ADDR`**（不是 `DB_HOST`）。docker-compose.yml 已为 backend 设置 `DB_ADDR: db`（compose 服务名，指向 MySQL 容器）。本地开发不设 `DB_ADDR` 时，`addr` 为空，DSN 会拼成 `tcp(:port)`——本地仍需在 `.env` 里设 `DB_ADDR=127.0.0.1`，否则连不上。

---

## 3. 文件就位

把 `frontend/docs/deploy/` 中的编排相关文件放到**仓库根目录**（compose 的相对路径以根目录为基准）：

```bash
cd /opt/pims   # 假设仓库克隆在此

# 1) docker-compose.yml 到根目录
cp frontend/docs/deploy/docker-compose.yml ./docker-compose.yml

# 2) 根目录 .dockerignore（减小构建上下文）
cp frontend/docs/deploy/.dockerignore ./.dockerignore

# 3) 环境变量（复制后务必修改密码与密钥）
cp frontend/docs/deploy/.env.example ./.env
vi .env
```

> `Dockerfile.backend` / `Dockerfile.frontend` / `nginx.conf` / `wait-for-mysql.sh` **保持在 `frontend/docs/deploy/` 原位即可**——compose 通过 `context: .` + `dockerfile: frontend/docs/deploy/...` 引用它们，无需移动。数据库初始化脚本来自 `backend/migrations/init/init.sql`，由 `Dockerfile.db` 构建进 MySQL 镜像。

最终根目录应包含：

```
/opt/pims/
├── docker-compose.yml          ← 来自 deploy/
├── .dockerignore               ← 来自 deploy/
├── .env                        ← 来自 .env.example（已改密码）
├── backend/                    （已支持 DB_ADDR，见第 2 节）
│   └── migrations/
│       └── init/
│           └── init.sql        ← 库初始化（建表+角色+管理员）
├── frontend/
│   └── docs/
│       └── deploy/
│           ├── Dockerfile.db
│           ├── Dockerfile.backend
│           ├── Dockerfile.frontend
│           ├── nginx.conf
│           └── wait-for-mysql.sh
└── ...
```

---

## 4. 配置 `.env`

编辑根目录 `.env`，至少改这两项：

```env
DB_PASSWD=你的强数据库密码
JWT_SECRET=至少32字节的随机字符串_xxxxxxxxxxxxxxxx
```

生成强随机密钥：

```bash
openssl rand -base64 48
```

> `JWT_SECRET` 不足 32 字节时后端启动会 `log.Fatal`（见 `main.go` 的 `jwt.ValidateSecret`）。

---

## 5. 构建并启动

```bash
cd /opt/pims
docker compose up -d --build
```

首次构建会拉取 `golang:1.26-alpine` / `node:22-alpine` / `nginx:1.27-alpine` / `mysql:8.0`，约几分钟。

查看启动状态：

```bash
docker compose ps                 # 三个服务都应为 running / healthy
docker compose logs -f backend    # 看后端日志，应出现 "Database connection established successfully"
docker compose logs -f db         # 确认 init.sql 执行完毕
```

预期后端日志：

```
[pims-backend] waiting for MySQL at db:3306 ...
[pims-backend] MySQL is reachable (0s). Starting backend.
... Database connection established successfully
```

如果数据库空表则执行：
```
chmod 644 /您的宿主机路径/01-init.sql
```

---

## 6. 验证

```bash
# 1) 前端页面
curl -I http://localhost/                       # 200 OK，返回 index.html

# 2) API 反代（/users/verify 未带凭据返回 401 即说明链路通）
curl -i http://localhost/api/users/verify -X POST \
  -d "username=admin&password=wrong"

# 3) 默认管理员登录（init.sql 内置：username=administrator，role=管理员 id=1）
curl -i http://localhost/api/users/verify -X POST \
  -d "username=administrator&password=管理员密码"
```

> init.sql 中内置管理员账号 `administrator` 的密码哈希来自原 `insert_admin_department` 迁移，初始密码由后端同学设定；首次登录后请立即改密（`/profile` → 修改密码）。

浏览器访问 `http://<服务器IP>/`，用 `administrator` 登录。

---

## 7. 常用运维命令

```bash
docker compose ps                      # 查看状态
docker compose logs -f                 # 跟踪全部日志
docker compose logs -f backend         # 单服务日志
docker compose restart backend         # 重启某服务
docker compose down                    # 停止并删除容器（保留 db_data 卷）
docker compose down -v                 # ⚠️ 连同数据库卷一起删除（清空数据）
docker compose up -d --build backend   # 仅重新构建后端
docker compose pull && docker compose up -d   # 更新镜像
```

---

## 8. 更新代码后重新部署

```bash
cd /opt/pims
git pull                              # 拉取新代码
docker compose up -d --build          # 重新构建变更的服务并滚动重启
```

前端/后端代码变更只需 `--build`；数据库 schema 变更见下节。

---

## 9. 数据库迁移说明

- **首次启动**：MySQL 容器自动执行镜像内的 `/docker-entrypoint-initdb.d/01-init.sql`（源文件为 `backend/migrations/init/init.sql`），完成建表、内置 5 个角色（id 1–5）、内置管理员账号。仅在数据目录为空时执行一次。
- **后续 schema 变更**：`init.sql` 不会再次执行。新增迁移应通过 `backend/migrations/` 下的 goose 文件管理，手动执行：

  ```bash
  # 用 db 容器内的 mysql 客户端直接跑迁移 SQL
  docker compose exec db mysql -uroot -p"$DB_PASSWD" "$DB_NAME" < backend/migrations/新迁移.sql
  ```

  如需使用 goose，请在能访问 compose 网络内 `db:3306` 的运维容器或临时开放的受控环境中执行：

  ```bash
  goose -dir backend/migrations mysql "root:$DB_PASSWD@tcp(db:3306)/$DB_NAME?charset=utf8mb4&parseTime=true&loc=Local" up
  ```

> 注意：后端 `main.go` **不**自动执行迁移、**不**自动建角色表（`config.InitRoleTable` 已定义但未调用）。因此角色与初始数据完全依赖 `init.sql`。如后续在后端启用 `InitRoleTable`，注意它会清空并按 `config.go` 的 `roles`（id=1 code=`admin` 小写）重写，与 init.sql 的 `Admin` 大写不一致——二选一，避免冲突。

---

## 10. 数据备份与恢复

```bash
# 备份
docker compose exec db sh -c \
  'mysqldump -uroot -p"$DB_PASSWD" --single-transaction "$DB_NAME"' > pims-backup-$(date +%F).sql

# 恢复
docker compose exec -T db sh -c \
  'mysql -uroot -p"$DB_PASSWD" "$DB_NAME"' < pims-backup-2026-06-26.sql
```

数据库文件持久化在 docker 命名卷 `db_data`，`docker compose down` 不会删除它。

---

## 11. 反向代理 / HTTPS（可选）

若服务器前置 Nginx/Caddy 终结 HTTPS，只需把上游指向前端容器的 80 端口，并透传 `X-Forwarded-*`：

```nginx
server {
    listen 443 ssl http2;
    server_name pims.example.com;
    # ssl_certificate ...

    location / {
        proxy_pass http://127.0.0.1:80;     # 前端容器发布的主机端口
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

此时可把 compose 中 `frontend` 的 `ports` 改为 `127.0.0.1:80:80`，仅本机可访问，由前置代理转发。

---

## 12. 排错速查

| 现象 | 排查 |
|------|------|
| backend 容器反复重启 | `docker compose logs backend`；多半是 `DB_ADDR` 未指向 MySQL 容器（应为 `db`），或 MySQL 未就绪。确认 compose 中 `DB_ADDR: db` 且 `DB_PORT: 3306` |
| backend 日志 `JWT_SECRET` 校验失败 | `.env` 的 `JWT_SECRET` 不足 32 字节，用 `openssl rand -base64 48` 生成 |
| 登录 401 / 角色不存在 | init.sql 未执行（数据目录非空时跳过）。`docker compose down -v` 后重新 `up`，或手动导入 init.sql |
| 前端能打开但 `/api` 502 | backend 未启动或健康检查未过；`docker compose ps` 看 backend 状态 |
| 中文乱码 | 确认 MySQL 启动参数含 `--character-set-server=utf8mb4`（compose 已配置） |
| 改了代码没生效 | 必须 `docker compose up -d --build`，仅 `restart` 不会重新构建镜像 |

---

## 产物清单（`frontend/docs/deploy/`）

| 文件 | 用途 | 是否需移动到根目录 |
|------|------|--------------------|
| `docker-compose.yml` | 三服务编排 | ✅ 复制到仓库根 |
| `.env.example` | 环境变量模板 | ✅ 复制为根目录 `.env` |
| `.dockerignore` | 减小构建上下文 | ✅ 复制到仓库根 |
| `Dockerfile.backend` | 后端多阶段构建 | ❌ 原位引用 |
| `Dockerfile.frontend` | 前端多阶段构建 | ❌ 原位引用 |
| `nginx.conf` | 前端 Nginx 配置 | ❌ 原位引用 |
| `wait-for-mysql.sh` | 后端启动前等待 MySQL | ❌ 原位引用 |
| `backend/migrations/init/init.sql` | 数据库初始化脚本 | ✅ 构建进 DB 镜像 |
