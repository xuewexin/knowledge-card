/**
 * 知识卡片 · 学科管理模块
 * 管理学科/题库的增删改查，以及按学科的卡片统计
 */
const SUBJECTS_KEY = 'knowledge-card-subjects-v1';

const PRESET_SUBJECTS = [
  { id: 'math',     name: '数学', icon: '📐', color: '#4CAF84' },
  { id: 'english',  name: '英语', icon: '🔤', color: '#FF9800' },
  { id: 'physics',  name: '物理', icon: '⚡', color: '#2196F3' },
  { id: 'chemistry',name: '化学', icon: '🧪', color: '#9C27B0' },
  { id: 'biology',  name: '生物', icon: '🧬', color: '#F44336' },
  { id: 'history',  name: '历史', icon: '📜', color: '#795548' },
  { id: 'cs',       name: '编程', icon: '💻', color: '#00BCD4' },
  { id: 'other',    name: '其他', icon: '📦', color: '#607D8B' },
];

const SUBJECT_COLORS = ['#4CAF84','#FF9800','#2196F3','#9C27B0','#F44336','#00BCD4','#FF5722','#607D8B','#E91E63','#3F51B5'];

let _colorIdx = 0;

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function load() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function save(data) {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(data));
}

export const SubjectStore = {
  /** 获取所有学科（含预设），首次调用自动注入预设 */
  list() {
    let subjects = load();
    if (!subjects) {
      subjects = PRESET_SUBJECTS.map(s => ({ ...s }));
      save(subjects);
    }
    return subjects;
  },

  /** 获取单科学科 */
  get(id) {
    return this.list().find(s => s.id === id) || null;
  },

  /** 创建自定义学科 */
  create(name, icon = '📚') {
    if (!name || !name.trim()) throw new Error('学科名称不能为空');
    const subjects = this.list();
    if (subjects.find(s => s.name === name.trim())) {
      throw new Error('学科名称已存在');
    }
    const color = SUBJECT_COLORS[_colorIdx % SUBJECT_COLORS.length];
    _colorIdx++;
    const subject = {
      id: uid('subject'),
      name: name.trim(),
      icon,
      color,
      isCustom: true,
    };
    subjects.push(subject);
    save(subjects);
    return subject;
  },

  /** 更新学科信息 */
  update(id, patch) {
    const subjects = this.list();
    const idx = subjects.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('学科不存在');
    Object.assign(subjects[idx], patch);
    save(subjects);
    return subjects[idx];
  },

  /** 删除学科（关联卡片 subjectId 置 null） */
  delete(id) {
    const subjects = this.list().filter(s => s.id !== id);
    save(subjects);
    // 注意：卡片层面的 subjectId 清理由 CardStore 负责
    // 这里只删除学科记录，CardStore 读取时会自动将无效 subjectId 视为未分类
    return true;
  },

  /** 按学科统计卡片数 */
  cardCount(subjectId) {
    // 需要从 CardStore 获取，但这里为了避免循环依赖，使用 localStorage 直接读取
    try {
      const raw = localStorage.getItem('knowledge-card-app-v1');
      const cards = raw ? JSON.parse(raw) : [];
      if (subjectId === null || subjectId === '__all__') {
        return cards.length;
      }
      return cards.filter(c => (c.subjectId || null) === subjectId).length;
    } catch (e) { return 0; }
  },

  /** 按学科统计待复习数 */
  dueCount(subjectId) {
    try {
      const raw = localStorage.getItem('knowledge-card-app-v1');
      const cards = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const filtered = subjectId === '__all__' || subjectId === null
        ? cards
        : cards.filter(c => (c.subjectId || null) === subjectId);
      return filtered.filter(c => !c.nextReview || c.nextReview <= now).length;
    } catch (e) { return 0; }
  },

  /** 单学科统计（total, mastered, due） */
  stats(subjectId) {
    try {
      const raw = localStorage.getItem('knowledge-card-app-v1');
      const cards = raw ? JSON.parse(raw) : [];
      const filtered = (!subjectId || subjectId === '__all__')
        ? cards
        : cards.filter(c => (c.subjectId || null) === subjectId);
      const total = filtered.length;
      const mastered = filtered.filter(c => (c.mastery || 0) >= 80).length;
      const now = Date.now();
      const due = filtered.filter(c => !c.nextReview || c.nextReview <= now).length;
      const totalReviews = filtered.reduce((s, c) => s + (c.reviewCount || 0), 0);
      const avgMastery = total > 0
        ? Math.round(filtered.reduce((s, c) => s + (c.mastery || 0), 0) / total)
        : 0;
      return { total, mastered, due, totalReviews, avgMastery };
    } catch (e) {
      return { total: 0, mastered: 0, due: 0, totalReviews: 0, avgMastery: 0 };
    }
  },

  /** 预设学科列表（用于添加卡片时选择） */
  presets() {
    return PRESET_SUBJECTS;
  },
};
