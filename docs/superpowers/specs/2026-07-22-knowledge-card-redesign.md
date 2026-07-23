# 知识卡片 App 2.0 设计文档

## 概述

基于极简纯白视觉风格，全面重构知识卡片/闪卡背诵 App 的 UI 与交互。
技术栈从纯 Vanilla JS 升级为 Vue 3 CDN + ES Module，零构建流程，Capacitor 直接加载。

---

## 一、技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Vue 3 (CDN, `vue.esm-browser.js`) | 响应式数据绑定、`<Transition>` 组件、composition API |
| 手势 | 原生 Touch Events | 封装轻量 gesture util，不引入第三方手势库 |
| AI | `fetch()` → OpenAI 兼容 `/v1/chat/completions` | 用户自行配置 baseURL + apiKey + model |
| 存储 | localStorage | 保持现有 CardStore / UserStore 模式，扩展字段 |
| 样式 | 纯 CSS（CSS 变量 + 无预处理器） | 极简纯白、弥散阴影、毛玻璃、大圆角 |
| 构建 | 零构建 | Capacitor `webDir: "www"` 直接加载 |

## 二、视觉设计系统

### 设计令牌（CSS 变量）

```
--bg:                 #FFFFFF   纯白背景
--surface:            #FFFFFF   卡片表面
--text-primary:       #1A1A1A   主文字
--text-secondary:     #8E8E93   次要文字（iOS 风格灰）
--text-hint:          #C7C7CC   提示文字
--divider:            #F2F2F7   极淡分割
--accent:             #34C759   荧光绿强调色（仅用于关键正反馈）
--accent-glow:        0 0 20px rgba(52,199,89,0.25)
--shadow-card:        0 2px 20px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.03)
--radius-card:        24px      超椭圆圆角
--font-xl:            28px      卡片问题
--font-sm:            13px      元信息
--glass-bg:           rgba(255,255,255,0.72)
--glass-blur:         20px      毛玻璃模糊
```

### 关键视觉原则

1. **极致留白**：无分割线，用间距（24px/32px/48px）划分区域
2. **字体对比**：问题文字 28px Bold vs 状态文字 13px Light Gray
3. **弥散阴影**：范围大 (40px)、透明度低 (0.03)，卡片悬浮感
4. **克制配色**：全界面黑白灰，只在"知道"按钮和打卡完成时用荧光绿
5. **毛玻璃底栏**：`backdrop-filter: blur(20px)` + 半透明白底

## 三、页面与组件树

```
App
├── BottomNav              — 毛玻璃三 Tab
├── HomePage               — 首页（学习主看板）
│   ├── CheckInBadge       — "已打卡" 状态条
│   ├── SubjectCarousel    — 可滑动学科模块
│   └── StartReviewBtn     — "开始复习" CTA
├── ReviewOverlay          — 全屏背诵模式
│   ├── ReviewProgress     — 顶部进度条
│   ├── FlashCard          — 3D 翻转 + 手势滑动
│   └── ReviewComplete     — 完成统计
├── AddPage                — 卡片录入
│   ├── SubjectPicker      — 学科选择器
│   ├── QAMode             — 问答模式表单
│   └── ChoiceMode         — 选择题 + AI 生成
└── ProfilePage            — 个人中心
    ├── UserInfo           — 头像 + 昵称
    ├── CheckInCalendar    — 打卡热力图（近 12 周）
    └── DailyStats         — 今日复习数据
```

## 四、数据模型扩展

### Card

```js
{
  id: 'card_xxx',
  type: 'qa' | 'choice',       // 新增：题型
  subject: '数学',              // 新增：学科（替代原 tags 为主要分类）
  question: '函数极限的定义？',
  answer: '...',
  options: ['A. ...', ...],    // 新增：选择题选项（choice 类型专用）
  correctIndex: 0,             // 新增：正确选项索引
  aiGenerated: false,          // 新增：是否 AI 生成
  mastery: 0,
  reviewCount: 0,
  lastReviewed: null,
  nextReview: Date.now(),
  createdAt: Date.now()
}
```

### UserData（扩展）

```js
{
  name: '知识探索者',
  avatar: '📖',
  streak: 0,
  lastCheckin: null,
  checkinHistory: ['2026-07-20', '2026-07-21'],  // 新增
  totalLearned: 0
}
```

### AISettings（新增）

```js
{
  baseURL: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini'
}
```

## 五、核心交互设计

### 5.1 首页学科滑动

- 学科模块以横向卡片形式并排，`overflow-x: auto` + `scroll-snap-type: x mandatory`
- 每个模块显示：学科名 + 卡片数 + 掌握度微进度条
- 选中态：卡片微微放大 + 阴影加深

### 5.2 背诵模式（核心）

**流程**：问题面 → 点击/滑动翻面 → 显示答案 + 「不知道」「知道」按钮 → 下一张

**手势**：
- 点击卡片任意位置 → 翻转
- 向右滑动（>80px） → "知道"，卡片飞出 + 绿色闪屏
- 向左滑动（>80px） → "不知道"，卡片飞出 + 加入重考队列
- 未滑过阈值 → 回弹

**3D 翻转**：CSS `transform: rotateY(180deg)` + `transform-style: preserve-3d` + `backface-visibility: hidden`，过渡用 `cubic-bezier(0.4, 0, 0.2, 1)` 0.5s

**遗忘重考**：点"不知道"的卡片在当前轮次结束后重新加入队列，直到全部记住

**完成页**：显示记住数、遗忘数、鼓励文案，可"复习忘记的"或"返回首页"

### 5.3 卡片录入

**学科选择**：顶部横向滚动的学科胶囊（数学、英语、编程、生物、物理、化学、历史、自定义）

**问答模式**：题 → 答，两个 textarea，保存 type='qa'

**选择题模式**：
- 输入题干 + 点击「🤖 AI 生成选项」
- 调用 OpenAI 兼容 API，prompt 约束输出格式：`["选项A", "选项B", "选项C", "选项D"] + 正确答案索引`
- 用户可手动编辑 AI 生成的选项，选择正确答案，保存 type='choice'

### 5.4 个人中心

**打卡热力图**：近 12 周（84 天）的 GitHub 风格小方格网格，有打卡日期显示荧光绿

**今日统计**：今日复习卡片数 + 记住数 + 遗忘数

## 六、文件结构

```
www/
├── index.html                   — SPA 入口
├── assets/
│   ├── style.css                — CSS 变量 + 全局样式 + 组件样式
│   ├── app.js                   — Vue createApp + 组件注册
│   ├── store.js                 — CardStore / UserStore / AISettings（扩展现有）
│   └── components/
│       ├── BottomNav.js         — 底部导航
│       ├── HomePage.js          — 首页
│       ├── ReviewOverlay.js     — 背诵模式全屏覆盖
│       ├── AddPage.js           — 卡片录入
│       ├── ProfilePage.js       — 个人中心
│       └── utils/
│           ├── ai.js            — OpenAI API 封装
│           └── gestures.js      — Touch Events 手势工具
```

## 七、迁移策略

1. **保留 store.js 核心逻辑**（CardStore / UserStore），仅扩展字段，API 不变
2. **增量替换**：旧 HTML 全部移除，Vue 接管 `#app`
3. **store.js 导出不变**，Vue 组件直接 import 使用
4. **localStorage key 不变**，存量用户数据兼容（旧卡片无 type/subject 字段时默认 type='qa', subject='通用'）

## 八、AI 接口设计

```js
// POST {baseURL}/v1/chat/completions
{
  model: 'gpt-4o-mini',
  messages: [{
    role: 'system',
    content: '你是知识卡片选项生成器。根据题目生成4个选项...'
  }, {
    role: 'user',
    content: '题目：{question}，答案：{answer}'
  }],
  response_format: { type: 'json_object' }
}

// 返回格式
{
  options: ['选项A', '选项B', '选项C', '选项D'],
  correctIndex: 0
}
```

---

## 自审检查

- [x] 无 TODO / TBD / placeholder
- [x] 各章节无矛盾
- [x] 范围聚焦一个项目，无需拆分
- [x] 所有需求可明确验证（翻面动效、手势滑动、AI 生成、热力图）
