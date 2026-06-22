# 前端开发手册 · PIMS Frontend

物品采购入库管理系统（Purchase Inbound Management System）的前端开发手册。本手册面向接手前端开发的人员（含 AI 协作者），描述技术栈、目录结构、开发约定与扩展方式。

> 设计风格规范见 `frontend/docs/example/DESIGN.md`（IBM Carbon 风格）。本手册聚焦工程实现，不重复设计细节。

---

## 1. 技术栈

| 关注点 | 选型 | 版本 |
|--------|------|------|
| 构建工具 | Vite | 6.x |
| UI 框架 | React | 19.x |
| 语言 | TypeScript（strict 模式） | 5.x |
| 路由 | react-router-dom | 7.x |
| HTTP | axios | 1.x |
| 字体 | IBM Plex Sans / Mono | 经 @fontsource 本地引入 |
| 样式方案 | CSS Modules（`*.module.css`） | — |

运行环境要求：Node.js 18+（开发机当前为 Node 24，npm 11）。

---

## 2. 环境准备与常用命令

所有命令在 `frontend/` 目录下执行。后端（Go/Gin）的命令不归前端负责。

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://localhost:5173
npm run build      # 类型检查(tsc -b) + 生产构建，产物在 dist/（已 gitignore）
npm run preview    # 预览生产构建
npm run typecheck  # 仅类型检查（tsc -b --noEmit）
```

### 开发服务器与后端联调

Vite 开发服务器将 `/api/*` 代理到 `http://localhost:8080`（Go/Gin 后端），见 `vite.config.ts` 的 `server.proxy`。因此前端代码直接调用 `/api/...` 即可，**不要**在前端硬编码后端地址。

要拿到真实数据，需先单独启动后端（`backend/cmd/server/main.go`，监听 `:8080`）。后端未启动时，页面会进入错误状态——这是预期行为，`UsersPage` 已处理。

---

## 3. 目录结构

```
frontend/
├── docs/                      # 文档
│   ├── DEVELOPMENT.md         # 本手册
│   └── example/               # IBM Carbon 设计参考（DESIGN.md / preview.html）
├── index.html                 # Vite 入口 HTML
├── package.json
├── vite.config.ts             # Vite 配置：@ 别名 + /api 代理
├── tsconfig.json              # TS 项目引用入口
├── tsconfig.app.json          # 应用代码 TS 配置（含 @ 路径别名）
├── tsconfig.node.json         # 构建脚本 TS 配置（vite.config.ts）
└── src/
    ├── main.tsx               # 应用入口：挂载字体、全局样式、RouterProvider
    ├── vite-env.d.ts
    ├── styles/
    │   ├── tokens.css         # 设计令牌（--cds-* 语义变量 + 原始色板）
    │   └── global.css         # 全局 reset + 排版默认 + 布局原语（.container / .section 等）
    ├── api/
    │   ├── client.ts          # 共享 axios 实例（baseURL: /api，错误归一化）
    │   └── users.ts           # 用户资源 API 封装
    ├── types/
    │   └── user.ts            # User 类型，镜像后端 model
    ├── components/
    │   ├── layout/            # AppLayout：顶栏 + Outlet + 页脚
    │   └── ui/                # 通用 UI 组件（Button / Tag）
    ├── router/
    │   └── index.tsx          # createBrowserRouter，路由表
    └── pages/                 # 页面组件
        ├── home/HomePage.tsx
        ├── users/UsersPage.tsx
        └── NotFoundPage.tsx
```

### 路径别名

`@/*` → `src/*`，同时在 `vite.config.ts` 和 `tsconfig.app.json` 中配置。**优先使用 `@/` 导入**，避免深层相对路径：

```ts
import { Button } from '@/components/ui/Button/Button'
import type { User } from '@/types/user'
```

---

## 4. 设计系统与样式约定

设计令牌集中在 `src/styles/tokens.css`，以 `--cds-*` 语义变量对外暴露（Carbon 风格命名），原始色值保留为 `--gray-*` / `--blue-*` 供特殊场景直接使用。全局基础样式在 `src/styles/global.css`，二者均在 `src/main.tsx` 中导入一次。

### 核心规则（来自 DESIGN.md，务必遵守）

- **单一强调色**：IBM Blue 60 `#0f62fe`，所有交互元素、CTA、链接的唯一蓝色。
- **圆角**：按钮 / 输入 / 卡片一律 0px；标签 24px（pill）；头像 / 图标 50%。这是 Carbon 的身份特征，不要软化。
- **深度**：通过背景色分层（白 → Gray 10 `#f4f4f4` → Gray 20 `#e0e0e0`）表达层级，**不用阴影**。阴影仅保留给真正浮起的元素（下拉、弹窗、tooltip）。
- **字体**：IBM Plex Sans（正文）/ IBM Plex Mono（代码、技术标签）。字重仅用 300 / 400 / 600，**禁止 700（bold）**。
- **字距**：仅在小字号加字距——14px 文本 0.16px，12px caption 0.32px；大号展示文字不加字距。
- **间距**：8px 基准网格（Carbon 2x grid），所有间距值应为 8 的倍数（2px / 4px 用于微调）。
- **输入框**：仅底部边框（bottom-border），不要全框包围。

### CSS Modules

每个组件就近放置同名 `.module.css`。读现有 `Button` / `Tag` / `AppLayout` 再新增组件，保持一致的写法。设计令牌通过 `var(--cds-...)` 引用，不要在组件样式中硬编码色值。

### 可复用布局原语（global.css）

`.container`（居中、最大 1200px）、`.section`（48px 上下内边距）、`.section--alt`（Gray 10 交替背景）、`.section-label`、`.section-title`、`.section-divider`。新页面尽量复用这些类，保持节奏统一。

---

## 5. 组件

### 通用 UI 组件（`src/components/ui/`）

**Button**（`Button/Button.tsx`）

```tsx
import { Button } from '@/components/ui/Button/Button'

<Button variant="primary" onClick={...}>主操作</Button>
<Button variant="danger" iconRight={<span>→</span>}>删除</Button>
```

- 变体：`primary` | `secondary` | `tertiary` | `ghost` | `danger`
- 48px 高，非对称内边距（右侧留空给尾部图标），0px 圆角
- 接收原生 `<button>` 全部属性（`onClick` / `disabled` / `type` 等）

**Tag**（`Tag/Tag.tsx`）

```tsx
import { Tag } from '@/components/ui/Tag/Tag'

<Tag kind="blue">信息</Tag>
<Tag kind="green">成功</Tag>
```

- kind：`blue` | `red` | `green` | `gray`，对应 10% 浓度背景 + 60 级文字
- 24px pill 圆角，12px 文字

### 布局组件（`src/components/layout/`）

**AppLayout**：应用外壳。Gray 100 深色 48px 顶栏，导航项用 `NavLink` 实现激活态（白字 + 2px 底边框指示）。内容区为 `<Outlet />`，所有路由都在其下渲染。新增主导航项时，编辑 `AppLayout.tsx` 的 `navItems` 数组。

### 新增组件规范

- 放入对应分类目录：通用 UI 进 `components/ui/<Name>/`，布局进 `components/layout/`
- 组件与样式文件同名同目录：`Foo.tsx` + `Foo.module.css`
- 通过 `variant` / `kind` 等枚举式 prop 暴露样式差异，不暴露原始 className 让外部覆盖
- 用 `var(--cds-...)` 引用令牌，不硬编码色值

---

## 6. 路由

路由表在 `src/router/index.tsx`，使用 `createBrowserRouter`。`AppLayout` 作为父路由，各功能页为其子路由通过 `<Outlet />` 渲染。

当前路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 概览 + 组件预览 |
| `/users` | UsersPage | 用户列表，调用 `GET /api/users/selectAll` |
| `/purchasing` | HomePage（占位） | 待后端接口就绪后实现 |
| `/inbound` | HomePage（占位） | 待后端接口就绪后实现 |
| `*` | NotFoundPage | 404 |

### 新增页面步骤

1. 在 `src/pages/<feature>/` 下创建页面组件 + `.module.css`
2. 在 `src/router/index.tsx` 的 `children` 中添加路由项
3. 如需进入主导航，在 `AppLayout.tsx` 的 `navItems` 中添加

---

## 7. API 层

### 约定

- **共享实例**：`src/api/client.ts` 导出 `apiClient`，`baseURL: '/api'`，已做响应拦截——后端返回的 `{ message: string }` 错误被归一化为 `Error`，前端 `catch` 后取 `err.message` 即可。
- **按资源拆分**：每个后端资源一个文件（`src/api/users.ts`），导出一个对象集中该资源的所有方法。
- **类型在 `src/types/`**：与后端 `model` 一一对应，字段保持同步。

### 调用示例

```ts
import { usersApi } from '@/api/users'

const list = await usersApi.selectAll()          // User[]
const one  = await usersApi.selectById(1)        // User
```

### 对接新后端接口

1. 在 `src/types/` 新增 / 更新类型（对照后端 `model` 与迁移）
2. 在 `src/api/<resource>.ts` 新增方法，复用 `apiClient`
3. 在页面中调用，处理 loading / error / empty 三态（参照 `UsersPage`）

### 当前可用的后端接口

- `GET /api/users/selectAll` → `200` 用户数组
- `GET /api/users/selectById?id=<int>` → `200` 单个用户；错误时 `500 { "message": "..." }`

User 字段：`id` `username` `password_hash` `real_name` `phone` `role_id` `department_id` `status`（1=正常 / 0=禁用）`created_at` `updated_at`。

---

## 8. 页面状态处理规范

涉及数据请求的页面，统一遵循 `UsersPage` 的模式：

- `loading` / `error` / `data`（含空态）三态分别渲染
- 数据获取逻辑用 `useCallback` 包裹，`useEffect` 中调用，提供手动「刷新」入口
- 错误用 `Tag kind="red"` + 文案提示，`role="alert"` 便于无障碍
- 表格类数据用 `overflow-x: auto` 容器包裹，保证窄屏可横向滚动

---

## 9. Git 工作流（前端协作者约束）

- 仅在 `frontend/` 内工作；`backend/`、`migrations/`、`.idea/`、根目录均不可改动
- `git add` 与 `git commit` 限定在 `frontend/`（如 `git add frontend/`）
- **禁止 `git push`**：提交留在本地，由项目所有者审查后自行推送
- 分支：前端工作在 `feature/frontend` 上；`main` 变动后及时 `git merge main` 同步
- 仓库根 `README.md` 描述了从 `main` 切 `feature/<name>` 的通用贡献流程

---

## 10. 扩展清单（后续待做）

- [ ] 采购管理页（`/purchasing`）：采购申请、订单跟踪、供应商管理
- [ ] 入库管理页（`/inbound`）：到货验收、入库登记、库存更新
- [ ] 登录 / 鉴权：后端目前无鉴权，需接口就绪后补充
- [ ] 表单组件：复用 Carbon bottom-border 输入风格（参照 DESIGN.md §4 Inputs）
- [ ] 表格组件抽象：将 `UsersPage` 的表格提炼为通用 `Table` 组件
- [ ] 暗色主题：tokens.css 已预留语义变量，切换 `--cds-*` 即可（DESIGN.md §2 Dark Theme）
