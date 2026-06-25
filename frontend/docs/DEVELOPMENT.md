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
| 字体 | IBM Plex Sans（英文正文）/ 思源黑体 Noto Sans SC（中文）/ JetBrains Mono（数字、代码、技术标签） | 经 @fontsource 本地引入 |
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

没有单独的 lint / test 脚本；类型检查是唯一的静态校验关卡，改动后请跑一次 `npm run typecheck`。

### 开发服务器与后端联调

Vite 开发服务器将 `/api/*` 代理到 `http://localhost:8080`（Go/Gin 后端），见 `vite.config.ts` 的 `server.proxy`。因此前端代码直接调用 `/api/...` 即可，**不要**在前端硬编码后端地址。

要拿到真实数据，需先单独启动后端（`backend/cmd/server/main.go`，监听 `:8080`）。后端未启动时，页面会进入错误状态——这是预期行为，各页面的 `ErrorBanner` 已处理（提示「请检查后端服务是否运行」）。

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
    │   ├── client.ts          # 共享 axios 实例（baseURL: /api，请求/响应拦截器）
    │   ├── errors.ts          # ApiError + 状态码归一化（fromAxiosError / toApiError / errorLabel）
    │   ├── auth.ts            # JWT 会话持久化 + login/logout
    │   ├── users.ts           # 用户资源 API
    │   ├── roles.ts           # 角色（只读）
    │   ├── departments.ts     # 部门（树形 CRUD）
    │   ├── items.ts           # 物品（list + create）
    │   ├── itemCategories.ts  # 物品分类（树形 CRUD）
    │   ├── warehouses.ts      # 仓库（扁平 CRUD）
    │   └── orders.ts          # 订单 + 事件哈希链
    ├── types/                 # 与后端 model 一一对应的类型
    │   ├── user.ts  role.ts  department.ts
    │   ├── item.ts  itemCategory.ts  warehouse.ts
    │   └── order.ts
    ├── components/
    │   ├── layout/            # AppLayout：顶栏 + Outlet + 页脚
    │   └── ui/                # 通用 UI 组件（Button / Tag / TextInput / Select / Modal / ErrorBanner）
    ├── router/
    │   └── index.tsx          # createBrowserRouter，含 RequireAuth 守卫
    └── pages/                 # 页面组件
        ├── home/HomePage.tsx
        ├── login/LoginPage.tsx
        ├── users/UsersPage.tsx
        ├── roles/RolesPage.tsx
        ├── departments/DepartmentsPage.tsx
        ├── items/ItemsPage.tsx
        ├── categories/CategoriesPage.tsx
        ├── warehouses/WarehousesPage.tsx
        ├── orders/OrdersPage.tsx
        └── NotFoundPage.tsx
```

### 路径别名

`@/*` → `src/*`，同时在 `vite.config.ts` 和 `tsconfig.app.json` 中配置。**优先使用 `@/` 导入**，避免深层相对路径：

```ts
import { Button } from '@/components/ui/Button/Button'
import type { User } from '@/types/user'
import { usersApi } from '@/api/users'
```

---

## 4. 设计系统与样式约定

设计令牌集中在 `src/styles/tokens.css`，以 `--cds-*` 语义变量对外暴露（Carbon 风格命名），原始色值保留为 `--gray-*` / `--blue-*` 供特殊场景直接使用。全局基础样式在 `src/styles/global.css`，二者均在 `src/main.tsx` 中导入一次。

### 核心规则（来自 DESIGN.md，务必遵守）

- **单一强调色**：IBM Blue 60 `#0f62fe`，所有交互元素、CTA、链接的唯一蓝色。
- **圆角**：按钮 / 输入 / 卡片一律 0px；标签 24px（pill）；头像 / 图标 50%。这是 Carbon 的身份特征，不要软化。
- **深度**：通过背景色分层（白 → Gray 10 `#f4f4f4` → Gray 20 `#e0e0e0`）表达层级，**不用阴影**。阴影仅保留给真正浮起的元素（下拉、弹窗、tooltip）—— `Modal` 是仓库里唯一使用阴影的组件。
- **字体**：IBM Plex Sans（英文正文）/ 思源黑体 Noto Sans SC（中文，作为 CJK 回退，中文字符自动落到此字体）/ JetBrains Mono（数字、代码、技术标签）。JetBrains Mono 的点状零与 1/l/I 强区分特性提升了 ID、哈希链、价格、库存等数字列的可读性；字重仅用 300 / 400 / 600，**禁止 700（bold）**。数字一律启用 `font-variant-numeric: tabular-nums lining-nums`（已在 `global.css` 的 `body` 全局生效），保证等宽对齐。
- **字距**：仅在小字号加字距——14px 文本 0.16px，12px caption 0.32px；大号展示文字不加字距。
- **间距**：8px 基准网格（Carbon 2x grid），所有间距值应为 8 的倍数（2px / 4px 用于微调）。
- **输入框 / 下拉**：仅底部边框（bottom-border），不要全框包围。

### CSS Modules

每个组件就近放置同名 `.module.css`。读现有 `Button` / `Tag` / `TextInput` / `AppLayout` 再新增组件，保持一致的写法。设计令牌通过 `var(--cds-...)` 引用，不要在组件样式中硬编码色值。

### 可复用布局原语（global.css）

`.container`（居中、最大 1200px）、`.section`（48px 上下内边距）、`.section--alt`（Gray 10 交替背景）、`.section-label`、`.section-title`、`.section-divider`。新页面尽量复用这些类，保持节奏统一。

---

## 5. 组件

### 通用 UI 组件（`src/components/ui/`）

**Button**（`Button/Button.tsx`）

```tsx
import { Button } from '@/components/ui/Button/Button'

<Button variant="primary" onClick={...}>主操作</Button>
<Button variant="danger">删除</Button>
```

- 变体：`primary` | `secondary` | `tertiary` | `ghost` | `danger`
- 接收原生 `<button>` 全部属性（`onClick` / `disabled` / `type` 等）

**Tag**（`Tag/Tag.tsx`）

```tsx
import { Tag } from '@/components/ui/Tag/Tag'

<Tag kind="blue">信息</Tag>
<Tag kind="green">成功</Tag>
```

- kind：`blue` | `red` | `green` | `gray`，对应 10% 浓度背景 + 60 级文字
- 24px pill 圆角，12px 文字

**TextInput**（`TextInput/TextInput.tsx`）

```tsx
<TextInput label="用户名" value={v} onChange={...} />
<TextInput label="密码" type="password" reveal helper="…" error="…" />
```

- Carbon bottom-border 输入，40px 高，0px 圆角
- `helper`：字段下方说明文字；`error` 设值时替换为红色错误文案
- `reveal`（仅 `type="password"` 时生效）：渲染眼睛按钮切换明文/密文
- `id` 不传时按 `field-<label>` 自动生成，`helper`/`error` 通过 `aria-describedby` 关联

**Select**（`Select/Select.tsx`）

```tsx
<Select
  label="角色 *"
  value={String(form.role_id)}
  onChange={(e) => update('role_id', Number(e.target.value))}
  options={[
    { value: '', label: '请选择角色' },
    ...roles.map((r) => ({ value: String(r.id), label: r.name })),
  ]}
/>
```

- Carbon bottom-border `<select>`，样式与 `TextInput` 对齐（同样的 label/helper/error 模式）
- **options 由调用方传入**，包含占位项（如「请选择角色」「全部」）放在数组首位
- value 恒为字符串；数字字段需在 onChange 处自行 `Number(...)` 转换

**Modal**（`Modal/Modal.tsx`）

```tsx
<Modal open={open} title="标题" onClose={...} footer={<>...</>} closeOnScrimClick={false} closeOnEscape={false}>
  {children}
</Modal>
```

- 通过 `createPortal` 渲染到 `document.body`，深色 scrim + 浮层面板（唯一用阴影处）
- `closeOnScrimClick` / `closeOnEscape` 默认 `true`；含未保存输入的表单弹窗（如新增/编辑）应设为 `false`，让关闭成为显式动作
- 打开时锁定 `body` 滚动

**ErrorBanner**（`ErrorBanner/ErrorBanner.tsx`）

```tsx
<ErrorBanner error={apiError} prefix="删除失败" action={<Button variant="tertiary">重试</Button>} />
```

- 渲染 `ApiError` 的 `errorLabel`（`HTTP 400` / `NETWORK` / `TIMEOUT`）+ `reason` + 后端 `detail`
- `prefix` 可选上下文前缀（如「操作失败」），`action` 可选右侧动作区（如重试按钮）
- 所有失败操作对用户暴露时统一用它，`role="alert"`

### 布局组件（`src/components/layout/`）

**AppLayout**：应用外壳。Gray 100 深色 48px 顶栏，导航项用 `NavLink` 实现激活态（白字 + 2px 底边框指示）。右侧显示当前登录用户 + 退出登录。内容区为 `<Outlet />`，所有受保护路由都在其下渲染。新增主导航项时，编辑 `AppLayout.tsx` 的 `navItems` 数组。

### 新增组件规范

- 放入对应分类目录：通用 UI 进 `components/ui/<Name>/`，布局进 `components/layout/`
- 组件与样式文件同名同目录：`Foo.tsx` + `Foo.module.css`
- 通过 `variant` / `kind` 等枚举式 prop 暴露样式差异，不暴露原始 className 让外部覆盖
- 用 `var(--cds-...)` 引用令牌，不硬编码色值

---

## 6. 路由与鉴权

路由表在 `src/router/index.tsx`，使用 `createBrowserRouter`。

- `/login` 是公开路由（`LoginPage`），不经过守卫。
- 其余路由以 `RequireAuth` + `AppLayout` 作为父路由。`RequireAuth` 检查 `isLoggedIn()`，无会话时重定向到 `/login?from=<当前路径>`。
- 各功能页是 `AppLayout` 的子路由，通过 `<Outlet />` 渲染。

当前路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | LoginPage | 登录（公开） |
| `/` | HomePage | 控制台（KPI + 订单状态分布 + 快捷入口，数据来自 `GET /overview/summary`） |
| `/users` | UsersPage | 用户 CRUD |
| `/roles` | RolesPage | 角色列表（只读） |
| `/departments` | DepartmentsPage | 部门树 CRUD |
| `/items` | ItemsPage | 物品 list + create |
| `/categories` | CategoriesPage | 物品分类树 CRUD |
| `/warehouses` | WarehousesPage | 仓库扁平 CRUD |
| `/orders` | OrdersPage | 统一的采购/出库订单流 + 哈希链详情 |
| `/purchasing` `/inbound` | OrdersPage | 旧路径别名到 `/orders` |
| `*` | NotFoundPage | 404 |

### 鉴权层（`src/api/auth.ts`）

JWT token + 当前用户存于 `localStorage`（键 `pims.token` / `pims.user`），刷新页面保持登录态。

- `login(username, password)`：POST `/users/verify`，**表单字段**（`application/x-www-form-urlencoded`，非 JSON），成功后 `setSession(token, user)`。
- `getToken` / `setSession` / `clearSession` / `getCurrentUser` / `isLoggedIn` / `logout`。
- `client.ts` 的请求拦截器在每个请求上附加 `Authorization: Bearer <token>`。
- 响应拦截器在 **401**（且不是 `/users/verify` 自身）时 `clearSession()` 并 `window.location.assign('/login')`。登录接口的 401/400 不触发跳转，交给 `LoginPage` 自行显示错误。

### 新增页面步骤

1. 在 `src/pages/<feature>/` 下创建页面组件 + `.module.css`
2. 在 `src/router/index.tsx` 的 `children` 中添加路由项
3. 如需进入主导航，在 `AppLayout.tsx` 的 `navItems` 中添加

---

## 7. API 层

### 共享实例与错误归一化

`src/api/client.ts` 导出 `apiClient`，`baseURL: '/api'`，默认 `Content-Type: application/json`，超时 15s。失败统一被响应拦截器转成 `ApiError`（见下），各资源模块的方法因此都 reject 一个 `ApiError`。

**`src/api/errors.ts`** 定义 `ApiError`（继承 `Error`，携带稳定 `code` + `status` + 短中文 `reason` + 后端 `detail`）。状态码到 code 的映射：

| status | code | reason |
|--------|------|--------|
| —（无响应，超时） | `TIMEOUT` | 请求超时，请稍后重试 |
| —（无响应，非超时） | `NETWORK` | 网络连接失败，请检查后端服务是否运行 |
| 400 | `BAD_REQUEST` | 请求参数有误 |
| 401 | `UNAUTHORIZED` | 未授权，请先登录 |
| 403 | `FORBIDDEN` | 无权限执行此操作 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 5xx | `SERVER_ERROR` | 服务器内部错误 |
| 其他 4xx | `CLIENT_ERROR` | 客户端请求错误 |

工具函数：`fromAxiosError(err)`（axios 错误 → ApiError，优先读后端 `{ error }` 体，兼容 `message`）、`toApiError(err)`（任意抛出值归一化，catch 块里用）、`errorLabel(err)`（`HTTP <status>` 或 `NETWORK`/`TIMEOUT`）。

> 后端错误体约定为 `{ "error": string }`（旧版 `{ "message": string }` 仍兼容）。`detail` 取自该字段。

### 按资源拆分

每个后端资源一个文件（`src/api/users.ts`、`departments.ts` …），导出一个对象集中该资源的所有方法，方法签名镜像后端路由。类型在 `src/types/`，与后端 `model` 一一对应，字段保持同步。

### 调用示例

```ts
import { usersApi } from '@/api/users'
import { fetchAll } from '@/api/pagination'
import { toApiError } from '@/api/errors'

// Paginated list (POST { page, page_size } -> { list, total })
const { list, total } = await usersApi.selectAll({ page: 1, page_size: 10 })
const one = await usersApi.selectById(1)        // User
// Need the full set (picker / tree / name resolution)? Auto-page through it:
const all = await fetchAll(usersApi.selectAll)  // User[]
try {
  await usersApi.deleteById(7)
} catch (err) {
  setActionError(toApiError(err))                // ApiError
}
```

### 分页

后端把所有 `selectAll` 列表端点从 `GET -> T[]` 改成了 `POST -> { list, total }`，请求体 `{ page, page_size }`（服务端默认 page=1 / page_size=10，page_size 上限 100，按 `id desc` 排序）。契约类型在 `src/types/pagination.ts`（`PageParams` / `Paginated<T>`）。

- **扁平列表分页**：用 `src/hooks/usePagedList.ts`。它处理服务端分页 + loading/error + 翻页；并支持 `searchMode`——为 `true` 时一次性 `fetchAll` 全量数据，供客户端筛选跨全部记录搜索（后端无「筛选+分页」查询，否则筛选只能命中当前页）。`UsersPage` / `ItemsPage` / `WarehousesPage` / `RolesPage` / `OrdersPage`（viewer 分支）均走此 hook，配 `src/components/ui/Pagination` 分页器。
- **需要全量**的场景（树形页 `DepartmentsPage` / `CategoriesPage`，以及所有 Modal 下拉、详情页 id→name 解析）用 `src/api/pagination.ts` 的 `fetchAll(api.selectAll)`，它会按 page_size=100 自动翻页直到取完。**不要**把这些场景接到分页器上。
- `OrdersPage` 特殊：viewer（admin/auditor/warehouse）走分页 `selectAll`，非 viewer（purchaser/applicant）走未分页的 `selectByUserId` 拿自己的全部订单再客户端筛选。

### 对接新后端接口

1. 在 `src/types/` 新增 / 更新类型（对照后端 `model` 与迁移）
2. 在 `src/api/<resource>.ts` 新增方法，复用 `apiClient`
3. 在页面中调用，处理 loading / error / empty / ready 四态（参照 `UsersPage`），失败用 `ErrorBanner` 展示

### 当前资源接口概览（细节见各文件头注释 + 根 `CLAUDE.md` 的 API 契约）

> 所有资源的 `selectAll` 均为 **POST 分页**（`{ page, page_size }` → `{ list, total }`），不再是 `GET -> T[]`。详见上节「分页」。

- **users**：`selectAll`（分页）/ `selectById` / `selectByUserName`（注意查询参数是 `user_name`）/ `deleteById`（DELETE）/ `register`（JSON，后端 bcrypt 哈希）/ 逐字段 `Update*ById`。其中 `UpdatePasswordById` / `UpdateUserNameById` / `UpdateRoleById` / `UpdateDepartmentById` 走表单字段（`ctx.PostForm`），`UpdateRealNameById` / `UpdatePhoneById` 走 JSON（空串清空可空字段）。`updateDepartmentById` 现已存在——部门在注册后可改（前端 `UsersPage` 编辑 Modal 已解锁该字段）。
- **roles**：只读 `selectAll` / `selectById` / `selectByName` / `selectByCode`。
- **departments**：树形 CRUD，`register` / `selectAll` / `selectById` / `selectByName` / `deleteById` / `UpdateNameById` / `UpdateDescriptionById` / `UpdateParentById`（树结构靠 `parent`）。
- **items**：`selectAll` / `selectById` / `create`（JSON，purchaser/admin）/ `update?id=`（JSON，部分更新——`ItemUpdate` 全为可选指针，仅发送变更字段；manager = admin/warehouse/auditor 门控）/ `delete?id=`（DELETE，manager）。服务端校验 `item_inventory≥0`、`frozen_inventory≥0`、`frozen_inventory≤item_inventory`、`name` 非空。`ItemsPage` 的创建/编辑共用 lift 出来的 `ItemFormFields` 表单体，编辑按字段 diff 调 `update`。
- **itemCategories**：树形 CRUD，同 departments 模式。**路由前缀是 camelCase `itemCategories`**（不是 `item_categories`）。时间戳序列化为 `created_at`。
- **warehouses**：扁平 CRUD。**时间戳序列化为 `create_at`**（后端 model 字段 `CreateAt`），前端类型用 `create_at`。
- **orders**：角色门控的哈希链流程。创建 / 追加端点接受可选 `event_payload`（前端发送 `{ note }`）。`purchaseRequests` / `outboundRequests` / `auditApprove` / `auditReject` / `warehouseReceive` / `warehouseShip` / `selectAll` / `selectById` / `selectByUserId` / `events` / `verifyChain` / `delete?id=`（DELETE，软删除——向链上追加 `ORDER_DELETED` 事件；admin 或订单所属用户可执行；删除 `AUDIT_APPROVED` 的出库单会释放其冻结库存）。
- **overview**：`GET /overview/summary` → `OverviewSummary`（`types/overview.ts`），返回物品总数 / 库存不足 / 各订单状态计数。注册在 auth 组、不限角色，`HomePage` 控制台据此渲染 KPI 与订单状态分布。

---

## 8. 页面状态处理规范

涉及数据请求的页面，统一遵循 `UsersPage` 的模式：

- 定义 `LoadState = 'loading' | 'error' | 'empty' | 'ready'`，按状态分别渲染（loading 提示、`ErrorBanner`（含重试按钮）、空态文案、表格/列表）
- 数据获取逻辑用 `useCallback` 包裹，`useEffect` 中调用，并提供「刷新」入口
- 失败统一 `toApiError(err)` 转成 `ApiError` 后用 `ErrorBanner` 展示；`role="alert"`
- **404 作为预期 UX**：例如 `selectByUserName` 找不到用户返回 404，应展示友好空态而非错误（见 `UsersPage.runSearch`）
- 依赖项（如下拉选项来源）非致命失败时静默降级——selects 留空、表格回退到原始 id（见 `UsersPage` 加载 roles/departments 的 `.catch(() => undefined)`）
- 表格类数据用 `overflow-x: auto` 容器包裹，保证窄屏可横向滚动
- 含未保存输入的弹窗（新增/编辑）用 `Modal` + `closeOnScrimClick={false}` + `closeOnEscape={false}`，并在提交时 `submitting` 锁定按钮

### 订单流程页（`OrdersPage`）

订单生命周期是一条哈希链事件日志：每单有 `order_type`（PURCHASE 进货 / OUTBOUND 出货）与 `status`（镜像最新事件 step）。`ORDER_NEXT_STEPS`（`types/order.ts`）映射每种 `order_type` + `status` 到可达的下一步，页面据此做角色门控的流程推进（采购→审核→仓库）。详情视图用 `ordersApi.events` 取事件链、`verifyChain` 校验哈希链完整性。

---

## 9. Git 工作流（前端协作者约束）

- 仅在 `frontend/` 内工作；`backend/`、`migrations/`、`.idea/`、根目录均不可改动
- `git add` 与 `git commit` 限定在 `frontend/`（如 `git add frontend/`）
- **禁止 `git push`**：提交留在本地，由项目所有者审查后自行推送
- 分支：前端工作在 `feature/frontend` 上；`main` 变动后及时 `git merge main` 同步
- 提交信息为单句简短概括（一句话），不要多段或多条目正文
- 仓库根 `README.md` 描述了从 `main` 切 `feature/<name>` 的通用贡献流程

---

## 10. 扩展清单（后续待做）

- [ ] 表格组件抽象：将各管理页的表格提炼为通用 `Table` 组件（目前每页各自渲染 `<table>`）
- [ ] 暗色主题：tokens.css 已预留语义变量，切换 `--cds-*` 即可（DESIGN.md §2 Dark Theme）
- [x] 列表分页：所有 `selectAll` 已改为 POST 分页，扁平列表接入 `Pagination` 分页器（`UsersPage` / `ItemsPage` / `WarehousesPage` / `RolesPage` / `OrdersPage`）；树形页与下拉/详情解析走 `fetchAll` 全量。`UsersPage` 用户名搜索仍为单条精确匹配（`selectByUserName`）。
