# ⚽ 世界杯小游戏 · World Cup Predict

一个用**纯静态 HTML + Canvas** 实现的足球模拟小游戏，包含 **2026 美加墨世界杯** 淘汰赛对阵图 + **5 大联赛**（英超 / 西甲 / 意甲 / 德甲 / 法甲）近 5 个赛季的积分榜对战。无需任何构建工具或依赖，浏览器打开即可游玩。

## ✨ 功能特性

- 🏆 **世界杯淘汰赛对阵树**（`worldcup.html`）：左右两侧上/下半区对阵图，点任意一场比赛开战。
- ⚽ **5 大联赛积分榜对战**（`spain.html` / `england.html` / `italy.html` / `germany.html` / `france.html`）：内置近 5 个赛季（2021/22 ~ 2025/26）积分榜，点击两支球队自定义主客队对战。
- 🎲 **随机抽队**：不想自己挑？点一下按钮 / 按空格键随机抽两队对战。
- 🎮 **canvas 球场物理模拟**：实时模拟球场与足球运动，进球判定严格——**整球需穿过门框且不碰立柱**才算进球。
- ⏱️ **完整比赛时钟**：常规时间 90 分钟，平局可配置进入加时赛至 120 分钟，再平局进入点球大战。
- 🚩 **球队标识**：世界杯页用 [flagcdn](https://flagcdn.com/) 国旗；联赛页用球队主客场色 + 3 字母缩写的动态队徽。

## 🚀 快速开始

直接用浏览器双击打开任意一个 HTML 即可，无需安装、无需构建：

- `worldcup.html` — 世界杯淘汰赛
- `spain.html` / `england.html` / `italy.html` / `germany.html` / `france.html` — 五大联赛

```bash
# 任选其一（打开世界杯页）
start worldcup.html        # Windows
open worldcup.html         # macOS
xdg-open worldcup.html     # Linux
```

## 🎯 玩法说明

1. 点击左右两侧对阵树中的任意一场比赛选中两队，或点「随机抽两队」按钮；
2. 点击 **「开始模拟」** 按钮开战；
3. 观看实时模拟，进球得分，90 分钟战平则按配置进入加时 / 点球；
4. 进球需整球穿过门框、不碰立柱。

## ⚙️ 配置项

比赛流程/物理/点球所有配置集中在 `js/engine.js` 顶部的 `// ---------- 配置 / 常量 ----------` 区域，用文本编辑器直接改即可，改完刷新浏览器生效。所有页面共享同一份引擎，改一次全生效。

### 比赛流程

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `ALLOW_EXTRA` | `true` | 是否允许加时赛。`false` = 小组赛模式：90' 战平直接终场（平局），不进加时。 |
| `ALLOW_PENS` | `true` | 是否允许点球大战。`false` = 小组赛模式：加时结束仍平局直接终场，不进点球。仅在进入加时后才生效。 |
| `FORCE_EXTRA` | `false` | **测试开关**。`true` = 任何比分 90' 结束都强制进入加时（无视是否平局、无视 `ALLOW_EXTRA`）。 |
| `FORCE_PENS` | `false` | **测试开关**。`true` = 任何比分结束都直接进点球大战。优先级最高，会覆盖上面所有流程。 |
| `T_REG` | `60` | 常规时间（0~90'）映射的真实秒数。改小 → 比赛更紧凑，改大 → 更慢。 |
| `T_EXTRA` | `20` | 加时赛（90~120'）映射的真实秒数（与常规同比例 0.667s/min）。 |
| `P_ACCEL` | `1` | 计时曲线指数。`1` = 匀速线性；`>1` = 前慢后快（缓入，临近终场节奏加快）。 |
| `KICKOFF_PAUSE` | `1.0` | 中圈开球后停顿秒数（开场 / 半场 / 进球后 / 加时开球都会触发）。 |

#### 流程优先级

当 90' 常规时间结束时，按以下顺序判断（前者命中则不再往下）：

1. `FORCE_PENS` → 直接进点球大战
2. `FORCE_EXTRA` → 强制进入加时
3. 平局且 `ALLOW_EXTRA` → 进入加时
4. 否则 → 终场（分出胜负，或小组赛平局收场）

加时 120' 结束时：`FORCE_PENS` 或（平局且 `ALLOW_PENS`）→ 点球大战；否则终场。

#### 常用预设

- **小组赛模式**：`ALLOW_EXTRA = false` + `ALLOW_PENS = false`（90' 战平即终场，记平局）
- **淘汰赛模式**（默认）：`ALLOW_EXTRA = true` + `ALLOW_PENS = true`
- **调试点球大战**：`FORCE_PENS = true`（一开局就能看到点球）
- **调试加时赛**：`FORCE_EXTRA = true`

### 物理

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `TARGET_SP` | `480` | 足球恒定目标速率（像素/秒）。调大球更快、比赛更激烈。 |

### 点球大战

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `PEN_GOAL_P` | `0.72` | 单粒点球进球概率（0~1）。调高更易进、调低更易扑。 |
| `PEN_GC` | `-Math.PI/2` | 点球阶段球门固定角度（球场正上方），一般无需改。 |
| `PEN_PREP` | `0.5` | 助跑准备阶段秒数。 |
| `PEN_FLIGHT` | `0.85` | 球飞行阶段秒数。 |
| `PEN_RESOLVE` | `0.9` | 进球/扑救落定阶段秒数。 |
| `PEN_GAP` | `0.6` | 两轮点球之间的间隔秒数。 |

## 🛠️ 技术栈

- 纯原生 **HTML / CSS / JavaScript**，零依赖，零构建
- **Canvas 2D** 绘制球场与足球动画
- CSS/JS 按功能模块拆分（`base.css` 通用 / `standings.css` 积分榜 / `bracket.css` 对阵图；`engine.js` 引擎 / `standings.js` 联赛 / `bracket.js` 世界杯），通过 TEAM 适配器复用引擎
- 世界杯页国旗资源来自 [flagcdn](https://flagcdn.com/)（支持 CORS）

## 📁 项目结构

```
worldcup-predict/
├── worldcup.html              # 2026 美加墨世界杯淘汰赛
├── spain.html                 # 西甲 · LaLiga
├── england.html               # 英超 · Premier League
├── italy.html                 # 意甲 · Serie A
├── germany.html               # 德甲 · Bundesliga
├── france.html                # 法甲 · Ligue 1
├── css/
│   ├── base.css               # 通用样式（记分牌/时钟/canvas/结果卡/点球条/按钮）
│   ├── standings.css          # 积分榜（联赛页专属）
│   └── bracket.css            # 对阵树（世界杯页专属）
├── js/
│   ├── engine.js              # 比赛引擎（物理/点球/渲染/主循环，所有页面共享）
│   ├── standings.js           # 联赛积分榜逻辑 + 队徽适配器
│   └── bracket.js             # 世界杯对阵图逻辑 + 国旗适配器
└── data/                      # （预留）JSON 数据目录，见 data/README.md
```

### 想接入 HTTP 数据加载

目前所有球队/赛季数据都写死在各 HTML 内联 `<script>` 里，因为 `file://` 协议下浏览器禁止 `fetch()` 读本地 JSON。若日后要把数据外置到 `data/*.json`，需通过 HTTP 服务器访问：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/spain.html
```

详见 `data/README.md`。

## 📄 License

本项目仅供学习与娱乐使用。
