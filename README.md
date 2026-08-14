# 家教 Vault —— AI 辅助备课工作流框架

一套基于 Claude Code + Obsidian 的**结构化备课系统**。将家教备课从"每次从头来"变成"填空即用"。

## 核心设计

```
🔴 前置读取 → 🟢 执行操作 → 🔵 后置更新
```

收到任何请求 → 先读工作流 → 再读学生画像 → 最后执行 → 执行完自动更新 wiki/日记/workflow。

## 快速开始（3 步上手）

### 第 1 步：复制框架

```bash
git clone <repo-url> 我的家教库
cd 我的家教库
```

### 第 2 步：填空

需要你填的内容（搜 `{{` 即可找到所有占位符）：

| 文件 | 要填什么 |
|:---|:---|
| `CLAUDE.example.md` → 重命名为 `CLAUDE.md` | Vault 路径、你的科目、学生目录名 |
| `数学/系统课程/.claude-workflow.example.md` → 重命名为 `.claude-workflow.md` | 学生背景、家长要求、课程进度 |
| `物理/系统课程/.claude-workflow.example.md` → 同上 | 同上 |
| `.claude/shared/workflow.example.md` → 重命名为 `workflow.md` | 基本不用改，开箱即用 |
| `vision.example.js` → 重命名为 `vision.js` | 填入 DashScope API Key |
| `.claude/settings.example.json` → 重命名为 `settings.json` | 把 `{{VAULT_ROOT}}` 替换为你的 Vault 路径 |

### 第 3 步：初始化学生

```bash
# 复制学生模板
cp -r 学生-模板 数学-张同学

# 编辑 index.md、wiki/学生/学生画像.md，填学生信息
```

完成后目录结构自动符合框架约定。

## 目录结构

```
家教/
├── CLAUDE.md              ← 项目宪章（规则、路径、铁律）
├── README.md              ← 你在这里
├── vision.example.js      ← 识图脚本模板（千问 VL）
│
├── .claude/               ← 🧠 AI 工作流引擎
│   ├── shared/workflow.example.md  ← 通用规范（两科共享）
│   ├── skills/            ← 5 个 Skill 定义
│   │   ├── lecture/       ← 课前：作业→诊断→讲义
│   │   ├── feedback/      ← 课后：逐字稿→简报→反馈
│   │   ├── system-course/ ← 系统课程编写
│   │   ├── ingest/        ← 新资料入库
│   │   └── workflow-maintain/ ← 健康检查+升级
│   ├── templates/         ← 学生初始化模板
│   ├── commands/          ← 快捷指令（/lecture, /feedback...）
│   ├── scripts/           ← 工具脚本（初始化/绘图/通知）
│   └── settings.json      ← 权限配置
│
├── 学生-模板/             ← 📋 学生目录模板（填空即用）
│   ├── index.md           ← 全库索引
│   ├── log.md             ← 操作日志
│   ├── wiki/
│   │   ├── 学生/学生画像.md
│   │   ├── 进度/课程进度.md
│   │   ├── 错题/index.md
│   │   ├── 概念/          ← 知识点 Wiki
│   │   └── 方法/          ← 解题方法 Wiki
│   ├── 讲义/              ← 按日期存放（MMDD/）
│   ├── 作业/              ← 学生提交的作业图片
│   ├── 课后习题/
│   └── 参考题库/          ← 学生专属题库
│
├── 数学/                  ← 📐 数学共享资源
│   ├── 系统课程/          ← 教材驱动的系统讲义
│   │   └── .claude-workflow.example.md
│   ├── 高中教材/          ← （自行放入教材 PDF）
│   ├── 参考教辅/          ← （自行放入教辅 PDF）
│   └── 高考试卷/          ← （自行放入真题 PDF）
│
└── 物理/                  ← ⚛️ 物理共享资源
    └── 系统课程/
        └── .claude-workflow.example.md
```

## 5 个 Skill —— 覆盖完整教学周期

```
课前                上课                课后              定期
│                   │                   │                 │
lecture ──────→  [教师使用] ──────→ feedback ────→ maintain
│                                     │                 │
├─ 批改作业                          ├─ 读逐字稿        ├─ 健康检查
├─ 诊断薄弱点                        ├─ 生成简报        └─ 工作流升级
├─ 出学生版讲义                      ├─ 生成家长反馈
└─ 出教师版讲稿                      └─ 更新 wiki+日记+收入

ingest ──── 新资料入库（随时）
system ──── 系统课程编写（超前储备）
```

每个 Skill 严格执行 `🔴前置→🟢执行→🔵后置` 三步闭环。

## 工作流三层结构

```
CLAUDE.md（项目宪章——铁律、路径、严禁行为）
  │
  ├─ .claude/shared/workflow.md（共享层）
  │   ├─ 文件命名规范
  │   ├─ 学生版/教师版铁律
  │   ├─ 讲义制作流程（选题→截图→编写→核对）
  │   ├─ PDF/图片处理工具链
  │   ├─ Wiki 知识库规范
  │   └─ 统一课后闭环清单
  │
  ├─ 数学/系统课程/.claude-workflow.md（数学层）
  │   ├─ 学生背景 & 家长要求
  │   ├─ 数学特有：答题格式（解→设→列→解→答）
  │   └─ 数学特有：选题优先级
  │
  └─ 物理/系统课程/.claude-workflow.md（物理层）
      ├─ 学生背景 & 家长要求
      ├─ 物理特有：答题格式（字母公式→代入→结果）
      └─ 物理特有：临界条件分析
```

## 核心概念

### 系统课程 vs 讲义

| | 系统课程 | 讲义 |
|:---|:---|:---|
| 驱动 | 教材 + 课标 | 学生错题 + 进度 |
| 依赖学生 | 不依赖 | 完全依赖 |
| 存放 | `学科/系统课程/` | `讲义/YYYY-MM-DD/` |
| 节奏 | 超前储备 | 按需灵活 |

### 学生版 vs 教师版

| | 学生版 | 教师版 |
|:---|:---|:---|
| 用途 | 打印给学生做题 | 老师上课讲稿 |
| 风格 | 题目 + 留白 | 口语化 + 思路引导 + 全步骤 |
| 禁止 | AI 味 meta、完整解题过程 | 跳步、干巴巴 |

### 选题优先级

```
⓪ 用户指名资料 → 最高优先
① 学生专属参考题库
② 共享参考教辅
③ 系统课程
④ 自编（仅前三都没有时才用）
```

## 资料库约定

所有参考教辅 PDF 均为扫描图片版，提取方式：

```
PDF → PyMuPDF 渲染为 PNG → vision.js 读取内容
```

详见 `shared/workflow.md` §1.4.1。

## 工具链

| 工具 | 用途 |
|:---|:---|
| PyMuPDF (fitz) | PDF 渲染、嵌入图提取 |
| vision.js | 千问 VL 识图（需 DashScope API Key） |
| rapidocr_onnxruntime | 图片 OCR 文字提取 |
| pdftotext | 文字型 PDF 提取 |
| Obsidian CLI | Vault 操作 |

## 添加新学生

```bash
cp -r 学生-模板 数学-李同学
```

然后填写 4 个文件：
1. `index.md` — 库索引和快速导航
2. `wiki/学生/学生画像.md` — 学生基本信息、性格、学习特征
3. `wiki/进度/课程进度.md` — 当前进度
4. `wiki/错题/index.md` — 错题本入口

首次课后根据反馈持续更新。

## 添加新科目

```bash
mkdir -p 化学/系统课程
cp 数学/系统课程/.claude-workflow.example.md 化学/系统课程/.claude-workflow.md
```

修改 workflow 中的科目特有规范（答题格式、选题来源），在 `CLAUDE.md` 路径约定中注册。

## 许可证

MIT
