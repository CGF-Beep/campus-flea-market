# 校园二手交易平台 - Spring Boot 后端

原 Express(Node.js) 后端迁移到 Spring Boot 的产物，**逐阶段迁移，每阶段测试通过再继续**。

当前阶段：**第 2 阶段** —— 注册 / 个人资料 / 修改密码 / 分类接口。
（已完成：第 1 阶段 登录+商品列表；前置依赖：RSA 公钥接口、健康检查、静态资源服务。）

## 技术栈

- Spring Boot 3.4.1（JDK 17+，本机 JDK 23 亦可）
- MyBatis-Plus 3.5.7（分页/条件构造器）
- MySQL 8（连接库 mysql-connector-j）
- jjwt 0.12.6（JWT）
- spring-security-crypto（仅 BCrypt，未引入完整 Spring Security）
- Lombok

## 目录结构

```
springboot-server/
├── pom.xml
├── keys/                       # RSA 密钥（从原 server/keys 复制，与前端公钥配对）
│   ├── rsa_private.pem
│   └── rsa_public.pem
├── scripts/
│   └── test-login.mjs          # 阶段测试脚本（零依赖，模拟前端加密流程）
└── src/main/
    ├── java/com/campusfleamarket/
    │   ├── common/             # ApiResponse / PageResult / 全局异常兜底
    │   ├── config/             # Jackson 序列化 / CORS / 静态资源 / MyBatis-Plus 分页
    │   ├── controller/         # Auth / Product / Health
    │   ├── dto/                # LoginRequest / UserVO / ProductVO / LoginData
    │   ├── entity/             # User / Product / Category（与数据库表一一对应）
    │   ├── mapper/             # MyBatis-Plus Mapper
    │   ├── security/           # JWT / 鉴权切面 / 登录限流 / UserContext
    │   ├── service/            # AuthService / ProductService
    │   └── util/               # RsaUtil
    └── resources/application.yml
```

## 启动命令

前置条件：MySQL 已建库 `campus_flea_market`（用原 `database/init.sql` 初始化过即可），
`application.yml` 中的 `DB_PASSWORD` 改为你的 MySQL 密码（或用环境变量覆盖）。

```bash
# 方式一：直接运行
cd springboot-server
mvn spring-boot:run

# 方式二：打包后运行（生产用）
mvn clean package -DskipTests
java -jar target/campus-flea-market-server.jar
```

启动后默认监听 **3000** 端口（与原 Express 一致，Nginx upstream 不用改）。

## 配置说明（application.yml）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `server.port` | `${PORT:3000}` | 端口，与原 Express 一致 |
| `spring.datasource.password` | `${DB_PASSWORD:123456}` | **务必改为实际 MySQL 密码** |
| `app.jwt-secret` | 原 .env 的 JWT_SECRET | 必须与原 Express 一致，旧 token 才能通过校验 |
| `app.jwt-expires-seconds` | 604800 | 对应原 `JWT_EXPIRES=7d` |
| `app.rsa-private-key-path` | `keys/rsa_private.pem` | 与前端 jsencrypt 公钥配对 |
| `app.upload-dir` | `../server/src/uploads` | **复用原 Express 上传目录**，两后端共存时图片互通 |
| `app.client-url` | `http://localhost:5173` | CORS 白名单 |
| `app.client-dist-dir` | `../client/dist` | 存在时开启 SPA 回退（同原 app.js） |
| `app.trusted-proxy` | `${TRUST_PROXY:true}` | true 时取 X-Forwarded-For 做限流 |

所有项都支持环境变量覆盖（`${ENV:默认值}` 语法），部署时与 Node 版共用一套环境变量即可。

## 测试方式

### 方式一：脚本一键验证（推荐先用这个）

需要 Node（项目本身就有）：

```bash
cd springboot-server
node scripts/test-login.mjs          # 第 1 阶段：登录 + 商品列表（默认 3000，账号 student / 123456）
node scripts/test-login.mjs 8080 admin 你的密码

node scripts/test-stage2.mjs                        # 第 2 阶段：注册/资料/改密码/分类列表
node scripts/test-stage2.mjs 3100 admin 你的密码     # 加 admin 账号可连分类管理用例一起测
```

- test-login.mjs：自动完成 取公钥 → RSA 加密密码 → 登录 → 错误密码负向 → 商品列表 → 健康检查，并校验 price 字符串、UTC 时间、user 无 password。
- test-stage2.mjs：真实注册一个 `stage2_*` 临时用户 → 登录 → profile → 更新资料 → 改密码（含旧密码被拒）→ 分类列表 → （若给 admin 账号）普通用户 403 / admin 增改删分类、404、空名称 400。**测完按脚本提示清理临时用户**。

### 方式二：对接原有前端验证

1. 启动 Spring Boot（端口 3000）
2. 把前端 vite 代理指到 3000（原 Node 也是 3000，无需改动；若前端已直连 api.zeroly.me，
   本地验证可用 dev 模式）
3. 浏览器打开前端 → 注册新账号 → 登录 → 首页商品列表 → 个人中心改资料/改密码 → 分类栏

## 与 Express 的 1:1 对齐清单（第 1 阶段）

| 项 | 原 Express 行为 | 本实现 |
|---|---|---|
| 响应体 | `{code, message, data}` | ✅ 完全一致 |
| 业务错误 | `{code:400, message, data:null}` | ✅ 完全一致 |
| 鉴权失败 | `{code:401/403, message}`（**无 data 字段**） | ✅ 完全一致（@RequireAuth/@RequireAdmin 切面） |
| 登录限流 | 15 分钟 10 次/IP，429 文案固定 | ✅ 进程内滑动窗口，含 RateLimit-* 响应头 |
| 注册限流 | 1 小时 5 次/IP，429 文案固定 | ✅ 通用 RateLimiter 双实例 |
| JWT | HS256，载荷 `{id, username, role}`，7 天 | ✅ jjwt 显式 HS256；旧 Node 签发的 token 可被校验 |
| RSA | PKCS#1 v1.5 解密，失败返回 null | ✅ 与 jsencrypt 完全兼容 |
| 密码 | bcryptjs（$2a$） | ✅ Spring BCrypt 直接兼容 |
| 注册字段 | nickname 缺省=username、avatar=模型默认 svg、role/status 默认 | ✅ 逐项对齐 |
| 更新资料 | 仅更新请求体中出现的字段（undefined 不更新） | ✅ Map 接收 + UpdateWrapper 精确 set |
| ID | INT UNSIGNED | ✅ Integer |
| 价格 | DECIMAL → JSON 字符串 `"15.00"` | ✅ 全局 BigDecimal 序列化器 |
| images | JSON 列 → 数组（null → null） | ✅ 解析为 List，null 保留 |
| 时间 | `2026-08-28T07:00:00.000Z`（UTC+毫秒） | ✅ 自定义 LocalDateTime 序列化器 |
| 字段命名 | camelCase（userId 等） | ✅ 实体字段即 camelCase |

## 已知差异与标注（未擅自设定，需你确认）

1. **helmet 安全响应头未完整复刻**：原 Express 用了 helmet()，会输出 X-Frame-Options、
   X-XSS-Protection 等头。本实现只加了 `X-Content-Type-Options: nosniff`（/uploads 必需）。
   若需要，可在后面阶段补齐其余响应头。
2. **限流为进程内实现**：与原 express-rate-limit 默认内存存储一致，重启清零；多实例部署时
   需要换 Redis，当前单实例场景无影响。
3. **时间序列化假设**：假定 MySQL 服务器时区为东八区（与原 Sequelize `timezone: '+08:00'`
   一致）。若你的 MySQL 时区不是东八区，输出会有偏差，需要告诉我调整。
4. **RSA 密钥**：直接从原 `server/keys/` 复制，前端公钥不用换。若未来轮换密钥，需同步更换
   前端缓存中的公钥。
5. **init.sql 中的 admin/student 是占位哈希**（任意密码都无法登录）——这是原数据问题，
   与本后端无关；真实可登录账号以你数据库里实际数据为准。
6. **第 1、2 阶段已实现的接口**：登录、注册、个人资料（查/改）、修改密码、商品列表、分类（查/管理）、健康检查、RSA 公钥、/uploads 静态、SPA 回退。
7. **未实现接口**（后续阶段逐个迁移）：商品详情/发布/编辑/删除/审核、订单、收藏、消息、文件上传（含 sharp webp 动态转码）、后台管理、WebSocket 聊天。

## 前端对接要点（第 1、2 阶段）

- 前端登录/注册先调 `/api/auth/public-key` 再提交，流程与 Node 版完全一致，**前端零改动**。
- 商品列表 `/api/products`、分类 `/api/categories`、个人资料 `/api/auth/profile` 返回结构不变。
- 商品详情等接口尚未迁移，进入对应阶段后再验证。
