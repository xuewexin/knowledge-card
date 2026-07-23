/**
 * 知识卡片 · 复习日志模块
 * 记录每日复习次数，支持日历热力图和今日统计
 *
 * 存储格式：{ "YYYY-MM-DD": count, ... }
 * 仅保留最近 180 天的数据
 */
const REVIEW_LOG_KEY = 'knowledge-card-review-log-v1';

function load() {
  try {
    const raw = localStorage.getItem(REVIEW_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function save(data) {
  localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(data));
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** 清理超过 180 天的旧记录 */
function prune(data) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffStr = cutoff.getFullYear() + '-' +
    String(cutoff.getMonth() + 1).padStart(2, '0') + '-' +
    String(cutoff.getDate()).padStart(2, '0');

  const cleaned = {};
  for (const [date, count] of Object.entries(data)) {
    if (date >= cutoffStr) cleaned[date] = count;
  }
  return cleaned;
}

export const ReviewLogStore = {
  /** 记录一次复习 */
  log() {
    const data = load();
    const key = today();
    data[key] = (data[key] || 0) + 1;
    // 每记录 20 次清理一次旧数据（低频操作）
    if (data[key] % 20 === 0) {
      const pruned = prune(data);
      save(pruned);
    } else {
      save(data);
    }
  },

  /** 获取今日复习次数 */
  getTodayCount() {
    const data = load();
    return data[today()] || 0;
  },

  /** 获取统计数据 */
  getStats() {
    const data = load();
    const todayKey = today();
    const todayCount = data[todayKey] || 0;

    // 本周
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    let weekCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      weekCount += data[key] || 0;
    }

    // 本月
    let monthCount = 0;
    const thisMonth = todayKey.slice(0, 7);
    for (const [date, count] of Object.entries(data)) {
      if (date.startsWith(thisMonth)) monthCount += count;
    }

    // 总复习次数
    const total = Object.values(data).reduce((sum, c) => sum + c, 0);
    // 有记录的天数
    const totalDays = Object.keys(data).length;

    return { today: todayCount, week: weekCount, month: monthCount, total, totalDays };
  },

  /** 获取热力图数据（最近 N 天） */
  getHeatmap(daysBack = 70) {
    const data = load();
    const result = new Map();
    const now = new Date();

    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      result.set(key, data[key] || 0);
    }

    return result;
  },

  /** 导出 */
  exportJSON() {
    return JSON.stringify(load());
  },

  /** 导入 */
  importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (typeof data !== 'object') throw new Error('无效的复习日志');
    save(data);
  },
};
