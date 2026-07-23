# 📖 知识卡片 Knowledge Card

一款极简风格的 Android 闪卡背诵应用，基于间隔重复算法（SM-2）帮助高效记忆。

<div align="center">

![Platform](https://img.shields.io/badge/platform-Android-green)
![Framework](https://img.shields.io/badge/framework-Capacitor-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

</div>

## ✨ 功能特性

- 🧠 **间隔重复** — 基于 SM-2 算法，自动安排最佳复习时间
- 📝 **双模式卡片** — 支持问答模式和选择题模式
- 🤖 **AI 出题** — 接入 OpenAI / Claude / DeepSeek，自动生成选择题干扰项
- 📂 **学科分类** — 8 个预设学科 + 自定义学科，横滑切换
- 📊 **打卡日历** — GitHub 风格热力图，记录学习轨迹
- 📄 **批量导入** — 支持 Markdown 格式批量导入卡片
- 🎉 **撒花动画** — 每日首次完成学习触发庆祝效果
- 🔒 **纯本地存储** — 所有数据保存在设备本地，无需服务器
- 🌐 **离线可用** — 无需网络连接即可使用（AI 出题除外）

## 📸 界面预览

| 学习主页 | 背诵模式 | 打卡日历 |
|:---:|:---:|:---:|
| 学科横滑 + 进度环 | 3D 翻转卡片 + 选择题 | 70 天热力图 |

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Android Studio Hedgehog+
- Android SDK 34

### 安装运行

```bash
# 克隆项目
git clone <repo-url>
cd knowledge-card

# 安装依赖
npm install

# 同步 Capacitor 资源
npx cap sync

# 构建 APK
cd android
./gradlew assembleDebug
```

APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`

### 浏览器预览

```bash
cd www
python -m http.server 8080
# 打开 http://localhost:8080
```

## 📖 使用指南

### 创建卡片
1. 点击底部 `＋` 进入添加页面
2. 选择学科和卡片类型（问答 / 选择）
3. 输入问题和答案
4. 选择题可点击「AI 生成干扰项」自动生成错误选项

### 开始背诵
1. 返回「学习」页面
2. 点击「开始学习」
3. 翻转卡片查看答案
4. 点击「知道了」或「再想想」
5. 系统自动安排下次复习

### 批量导入
1. 进入「我的」→「批量导入」
2. 下载导入模板
3. 按 Markdown 格式填写卡片
4. 粘贴内容或上传 .md 文件
5. 点击导入

**Markdown 格式示例：**

```markdown
## 数学
Q: 什么是勾股定理？
A: a²+b²=c²

Q: [选择] 1+1=?
A: 2
- 3
- 4
- 5

## 英语
Q: apple 的中文意思是？
A: 苹果
```

### AI 出题配置
1. 进入「我的」→「AI 出题配置」
2. 选择提供商（OpenAI / Claude / DeepSeek / 自定义）
3. 输入 API Key
4. 点击「测试连接」验证
5. 保存配置后即可在选择题模式下使用 AI 生成干扰项

> ⚠️ API Key 仅保存在设备本地，不会上传到任何服务器。

## 🏗️ 技术架构

```
knowledge-card/
├── www/                     # Web 源码（Capacitor webDir）
│   ├── index.html           # 主页面（SPA 三页 + 覆盖层）
│   └── assets/
│       ├── app.js           # UI 逻辑（页面导航、学习模式、AI配置、卡片管理）
│       ├── store.js         # 数据层（Card/User 存储、间隔重复、导入导出）
│       ├── subjects.js      # 学科管理模块
│       ├── reviewlog.js     # 复习日志模块
│       ├── ai.js            # AI API 调用（OpenAI/Claude/DeepSeek）
│       └── style.css        # 全局样式（极简白 + 靛蓝 + 毛玻璃）
├── android/                 # Capacitor Android 项目
├── capacitor.config.json    # Capacitor 配置
└── package.json
```

- **前端**：纯 HTML/CSS/JS（无框架），ES Modules
- **移动端**：Capacitor WebView（Android）
- **存储**：localStorage（最多 ~5MB，足够存储数千张卡片）
- **AI**：fetch API 直接调用各厂商 API

## 📦 数据备份

在「我的」页面可导出完整备份（JSON 格式，包含卡片、学科、复习日志），也可导入恢复。建议定期导出备份。

## 📄 License

MIT License

---

<p align="center">每天进步一点点 📚</p>
