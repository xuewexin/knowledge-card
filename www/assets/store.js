/**
 * 知识卡片 · 数据层
 * 基于 localStorage 的本地存储，管理卡片和用户学习数据
 *
 * Card:   { id, type:'qa'|'choice', subjectId:string|null,
 *           question, answer, tags:[],
 *           options:string[]|null, correctIndex:number|null,
 *           createdAt, mastery:0-100, reviewCount:0,
 *           lastReviewed:timestamp, nextReview:timestamp }
 * UserData: { streak:0, lastCheckin:date, totalLearned:0 }
 */

const STORE_KEY = 'knowledge-card-app-v1';
const USER_KEY = 'knowledge-card-user-v1';

// ── 工具函数 ──────────────────────────────────────────────
function uid(prefix = 'card') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('store load failed:', e);
    return null;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** 规范化旧卡片：补充缺失的字段 */
function normalizeCard(c) {
  if (!c.hasOwnProperty('type')) c.type = 'qa';
  if (!c.hasOwnProperty('subjectId')) c.subjectId = null;
  if (!c.hasOwnProperty('options')) c.options = null;
  if (!c.hasOwnProperty('correctIndex')) c.correctIndex = null;
  if (!c.hasOwnProperty('mastery')) c.mastery = 0;
  if (!c.hasOwnProperty('reviewCount')) c.reviewCount = 0;
  return c;
}

/** 检查是否需要迁移并执行 */
function migrateIfNeeded(cards) {
  let needsSave = false;
  for (const c of cards) {
    if (!c.hasOwnProperty('type') || !c.hasOwnProperty('subjectId') ||
        !c.hasOwnProperty('options') || !c.hasOwnProperty('correctIndex')) {
      normalizeCard(c);
      needsSave = true;
    }
  }
  if (needsSave) {
    save(STORE_KEY, cards);
  }
  return cards;
}

// ── 种子数据 ──────────────────────────────────────────────
const SEED_CARDS = [
  {
    type: 'qa',
    subjectId: 'other',
    question: '📖 欢迎使用知识卡片！',
    answer: '这是一款基于间隔重复的闪卡背诵工具。\n\n✨ 使用方法：\n1. 在「添加」页面创建卡片\n2. 选择「问答」或「选择」模式\n3. 返回「学习」页面开始背诵\n4. 知道答案点「知道了」，不确定点「再想想」\n5. 系统会自动安排下次复习时间\n\n💡 提示：\n- 可在「我的」页面配置 AI 自动生成选择题\n- 支持 Markdown 批量导入卡片\n- 所有数据仅保存在本地\n\n📦 这张卡片是使用说明，看完可以删除哦～',
    tags: ['教程'],
  },
];

// ── 卡片操作 ──────────────────────────────────────────────
export const CardStore = {
  /** 获取所有卡片（自动迁移旧数据） */
  list(subjectId) {
    let cards = load(STORE_KEY) || [];
    if (!cards.length) {
      // 首次使用，注入种子数据
      const seeded = SEED_CARDS.map(c => ({
        id: uid('card'),
        type: c.type || 'qa',
        subjectId: c.subjectId || null,
        question: c.question,
        answer: c.answer,
        options: c.options || null,
        correctIndex: c.correctIndex != null ? c.correctIndex : null,
        tags: c.tags || ['通用'],
        createdAt: Date.now(),
        mastery: 0,
        reviewCount: 0,
        lastReviewed: null,
        nextReview: Date.now(),
      }));
      save(STORE_KEY, seeded);
      return this.list(subjectId); // 递归调用以应用过滤
    }

    // 迁移旧数据
    cards = migrateIfNeeded(cards);

    // 按学科过滤
    if (subjectId && subjectId !== '__all__') {
      cards = cards.filter(c => (c.subjectId || null) === subjectId);
    }

    return cards;
  },

  /** 获取需要今天复习的卡片 */
  getDueCards(subjectId) {
    const now = Date.now();
    return this.list(subjectId)
      .filter(c => !c.nextReview || c.nextReview <= now)
      .sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
  },

  /** 获取已掌握的卡片 */
  getMastered(subjectId) {
    return this.list(subjectId).filter(c => c.mastery >= 80);
  },

  /** 查找单张卡片 */
  find(id) {
    return this.list().find(c => c.id === id) || null;
  },

  /** 添加卡片 */
  add({ question, answer, tags = [], type = 'qa', subjectId = null, options = null, correctIndex = null }) {
    const cards = this.list();
    const card = {
      id: uid('card'),
      type,
      subjectId: subjectId || null,
      question: question.trim(),
      answer: answer.trim(),
      options: type === 'choice' ? (options || []) : null,
      correctIndex: type === 'choice' ? (correctIndex != null ? correctIndex : 0) : null,
      tags: tags.length ? tags : ['通用'],
      createdAt: Date.now(),
      mastery: 0,
      reviewCount: 0,
      lastReviewed: null,
      nextReview: Date.now(),
    };
    cards.unshift(card);
    save(STORE_KEY, cards);
    return card;
  },

  /** 更新卡片 */
  update(id, patch) {
    const cards = this.list();
    const idx = cards.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Card not found: ' + id);
    Object.assign(cards[idx], patch);
    save(STORE_KEY, cards);
    return cards[idx];
  },

  /** 删除卡片 */
  delete(id) {
    const cards = this.list().filter(c => c.id !== id);
    save(STORE_KEY, cards);
  },

  /** 批量移动卡片到指定学科 */
  moveToSubject(cardIds, subjectId) {
    const cards = this.list();
    for (const c of cards) {
      if (cardIds.includes(c.id)) {
        c.subjectId = subjectId;
      }
    }
    save(STORE_KEY, cards);
  },

  /** 复习反馈：记录用户回答结果，更新掌握度 */
  review(id, remembered) {
    const cards = this.list();
    const card = cards.find(c => c.id === id);
    if (!card) return;

    card.reviewCount = (card.reviewCount || 0) + 1;
    card.lastReviewed = Date.now();

    // 间隔重复算法（简化版 SM-2）
    if (remembered) {
      card.mastery = Math.min(100, (card.mastery || 0) + 20);
      // 根据掌握度计算下次复习间隔（小时）
      const intervals = [4, 8, 24, 72, 168, 336, 720]; // 小时
      const level = Math.min(Math.floor(card.mastery / 15), intervals.length - 1);
      card.nextReview = Date.now() + intervals[level] * 3600 * 1000;
    } else {
      card.mastery = Math.max(0, (card.mastery || 0) - 10);
      card.nextReview = Date.now() + 1 * 3600 * 1000; // 1小时后重新复习
    }

    save(STORE_KEY, cards);

    // 记录复习日志（内联实现，避免循环依赖）
    try {
      const LOG_KEY = 'knowledge-card-review-log-v1';
      const raw = localStorage.getItem(LOG_KEY);
      const logData = raw ? JSON.parse(raw) : {};
      const d = new Date();
      const todayKey = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      logData[todayKey] = (logData[todayKey] || 0) + 1;
      localStorage.setItem(LOG_KEY, JSON.stringify(logData));
    } catch (e) { /* 忽略 */ }

    return card;
  },

  /** 获取统计信息 */
  stats(subjectId) {
    const cards = this.list(subjectId);
    const total = cards.length;
    const mastered = cards.filter(c => c.mastery >= 80).length;
    const now = Date.now();
    const due = cards.filter(c => !c.nextReview || c.nextReview <= now).length;
    const totalReviews = cards.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
    const avgMastery = total > 0 ? Math.round(cards.reduce((s, c) => s + (c.mastery || 0), 0) / total) : 0;
    return { total, mastered, due, totalReviews, avgMastery };
  },

  /** 导出备份 */
  exportJSON() {
    const data = {
      cards: this.list(),
      user: UserStore.get(),
      exportedAt: new Date().toISOString(),
    };
    // 附带导出学科和复习日志
    try {
      const rawSubjects = localStorage.getItem('knowledge-card-subjects-v1');
      if (rawSubjects) data.subjects = JSON.parse(rawSubjects);
      const rawLog = localStorage.getItem('knowledge-card-review-log-v1');
      if (rawLog) data.reviewLog = JSON.parse(rawLog);
    } catch (e) { /* 忽略 */ }
    return JSON.stringify(data, null, 2);
  },

  /** 导入备份 */
  importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data.cards || !Array.isArray(data.cards)) throw new Error('无效的备份文件');
    // 规范化导入的卡片
    data.cards = data.cards.map(c => normalizeCard(c));
    save(STORE_KEY, data.cards);
    if (data.user) save(USER_KEY, data.user);
    if (data.subjects) {
      localStorage.setItem('knowledge-card-subjects-v1', JSON.stringify(data.subjects));
    }
    if (data.reviewLog) {
      localStorage.setItem('knowledge-card-review-log-v1', JSON.stringify(data.reviewLog));
    }
  },

  /** 清空所有数据 */
  resetAll() {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('knowledge-card-subjects-v1');
    localStorage.removeItem('knowledge-card-review-log-v1');
    localStorage.removeItem('knowledge-card-ai-config-v1');
  },
};

// ── 用户数据 ──────────────────────────────────────────────
export const UserStore = {
  get() {
    return load(USER_KEY) || {
      streak: 0,
      lastCheckin: null,
      totalLearned: 0,
    };
  },

  update(patch) {
    const user = this.get();
    Object.assign(user, patch);
    save(USER_KEY, user);
    return user;
  },

  /** 每日打卡 */
  checkin() {
    const user = this.get();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (user.lastCheckin === today) return user; // 今天已打卡

    if (user.lastCheckin === yesterday) {
      user.streak += 1; // 连续打卡
    } else {
      user.streak = 1;  // 重新开始
    }
    user.lastCheckin = today;
    save(USER_KEY, user);
    return user;
  },
};

// ── 工具函数 ──────────────────────────────────────────────
export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtFullDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
