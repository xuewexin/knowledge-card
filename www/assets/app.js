/**
 * 知识卡片 App · 主逻辑 v2.0
 * 学科系统、问答/选择双模式、AI生成、日历、卡片管理
 */
import { CardStore, UserStore, fmtDate, fmtFullDate } from './store.js';
import { SubjectStore } from './subjects.js';
import { ReviewLogStore } from './reviewlog.js';
import { AIConfig, generateWrongOptions, testConnection } from './ai.js';

// ── 全局状态 ──────────────────────────────────────────────
let currentSubjectId = '__all__'; // 当前选中的学科
let currentCardType = 'qa';       // 当前卡片类型
let tagInputState = { tags: [] };

// ── 页面导航 ──────────────────────────────────────────────
const pages = {
  home: document.getElementById('page-home'),
  add:  document.getElementById('page-add'),
  user: document.getElementById('page-user'),
};

const navItems = document.querySelectorAll('.nav-item');

function switchPage(name) {
  Object.keys(pages).forEach(k => pages[k].classList.remove('active'));
  pages[name].classList.add('active');

  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === name);
  });

  if (name === 'home') renderHome();
  if (name === 'user') renderUser();
}

navItems.forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

// ── Toast 提示 ────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ═══════════════════════════════════════════════════════════
//  学科横滑选择器
// ═══════════════════════════════════════════════════════════

function renderSubjectCarousel() {
  const carousel = document.getElementById('subject-carousel');
  const subjects = SubjectStore.list(); // 包含预设

  let html = `
    <div class="subject-chip ${currentSubjectId === '__all__' ? 'active' : ''}"
         data-subject="__all__" style="background:${currentSubjectId === '__all__' ? '#4CAF84' : ''};color:${currentSubjectId === '__all__' ? '#fff' : ''}">
      <span class="chip-icon">📚</span>
      <span class="chip-name">全部</span>
    </div>`;

  subjects.forEach(s => {
    const active = currentSubjectId === s.id;
    html += `
      <div class="subject-chip ${active ? 'active' : ''}"
           data-subject="${s.id}"
           style="background:${active ? s.color : ''};color:${active ? '#fff' : ''}">
        <span class="chip-icon">${s.icon}</span>
        <span class="chip-name">${esc(s.name)}</span>
      </div>`;
  });

  carousel.innerHTML = html;

  // 点击事件
  carousel.querySelectorAll('.subject-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.subject;
      selectSubject(id);
    });
  });
}

function selectSubject(id) {
  currentSubjectId = id;
  renderSubjectCarousel();
  renderHome();
}

// ═══════════════════════════════════════════════════════════
//  主页渲染
// ═══════════════════════════════════════════════════════════

const CIRCUMFERENCE = 2 * Math.PI * 40;

function renderHome() {
  const stats = CardStore.stats(currentSubjectId === '__all__' ? null : currentSubjectId);
  const user = UserStore.get();
  const dueCards = CardStore.getDueCards(currentSubjectId === '__all__' ? null : currentSubjectId);
  const allCards = CardStore.list(currentSubjectId === '__all__' ? null : currentSubjectId);
  const recentCards = allCards.slice(0, 5);
  const reviewStats = ReviewLogStore.getStats();
  const subj = currentSubjectId !== '__all__' ? SubjectStore.get(currentSubjectId) : null;

  // 今日统计
  document.getElementById('today-count').textContent = reviewStats.today;
  document.getElementById('today-streak').textContent = user.streak || 0;

  // 打卡状态
  const checkinBadge = document.getElementById('checkin-badge');
  const checkinText = document.getElementById('checkin-text');
  if (user.lastCheckin === new Date().toDateString()) {
    checkinBadge.classList.add('checked');
    checkinText.textContent = '✅ 今日已打卡';
  } else {
    checkinBadge.classList.remove('checked');
    checkinText.textContent = '📌 今天还没打卡哦';
  }

  // 统计卡片
  document.getElementById('stat-due').textContent = stats.due;
  document.getElementById('stat-mastered').textContent = stats.mastered;
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('badge-total').textContent = `共 ${stats.total} 张`;

  // 卡片列表标题
  document.getElementById('card-list-title').textContent = subj
    ? `${subj.icon} ${subj.name} 的卡片`
    : '全部卡片';

  // 进度环
  const progress = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
  const ringFill = document.getElementById('ring-fill');
  ringFill.style.strokeDasharray = CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = offset;
  document.getElementById('ring-percent').textContent = progress + '%';

  // 进度文案
  const infoText = document.getElementById('progress-info-text');
  if (stats.due > 0) {
    infoText.textContent = `还有 ${stats.due} 张卡片等待复习，今天加把劲吧！`;
  } else if (stats.total === 0) {
    infoText.textContent = '还没有卡片，去添加你的第一张知识卡片吧';
  } else {
    infoText.textContent = '太棒了！当前没有需要复习的卡片，休息一下~';
  }

  // 开始学习按钮
  const btnLearn = document.getElementById('btn-start-learn');
  btnLearn.disabled = stats.due === 0;
  if (stats.due > 0) {
    btnLearn.innerHTML = `<span>📖</span> 开始学习（${stats.due}张待复习）`;
  } else {
    btnLearn.innerHTML = '<span>📖</span> 暂无待复习卡片';
  }

  // 最近卡片
  const recentList = document.getElementById('recent-cards-list');
  if (recentCards.length === 0) {
    recentList.innerHTML = `
      <div class="empty-state" style="padding:32px">
        <span class="empty-icon">📝</span>
        <p>还没有卡片，点击下方 + 号添加吧</p>
      </div>`;
  } else {
    const tagColors = ['#4CAF84', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4'];
    recentList.innerHTML = recentCards.map((c, i) => {
      const subj = c.subjectId ? SubjectStore.get(c.subjectId) : null;
      const subjName = subj ? `${subj.icon} ${subj.name}` : '未分类';
      return `
      <div class="mini-card" data-id="${c.id}">
        <div class="mini-tag ${c.mastery >= 80 ? 'mastered' : ''}" style="background:${tagColors[i % tagColors.length]}"></div>
        <div class="mini-info">
          <div class="mini-q">${c.type === 'choice' ? '📋 ' : ''}${esc(c.question)}</div>
          <div class="mini-meta">${subjName} · 掌握 ${c.mastery || 0}% · 复习 ${c.reviewCount || 0} 次</div>
        </div>
        <span class="mini-arrow">›</span>
      </div>`;
    }).join('');

    recentList.querySelectorAll('.mini-card').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.id;
        const card = CardStore.list().find(c => c.id === cardId);
        if (card) startLearn([card]);
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  学习模式
// ═══════════════════════════════════════════════════════════

let learnState = null;

function startLearn(cards) {
  if (!cards || cards.length === 0) return;

  learnState = {
    cards,
    currentIndex: 0,
    isFlipped: false,
    remembered: [],
    forgotten: [],
    isProcessing: false, // 防抖（选择题）
  };

  document.getElementById('learn-overlay').classList.add('active');
  document.getElementById('learn-complete').classList.remove('active');
  document.getElementById('learn-actions').style.display = 'none';

  updateLearnCard();
  updateLearnProgress();
}

function updateLearnCard() {
  if (!learnState) return;
  const card = learnState.cards[learnState.currentIndex];
  if (!card) return;

  learnState.isFlipped = false;
  learnState.isProcessing = false;

  if (card.type === 'choice') {
    // 选择题模式
    document.getElementById('card-flip-container').style.display = 'none';
    document.getElementById('choice-display').style.display = '';
    document.getElementById('learn-actions').style.display = 'none';

    const subj = card.subjectId ? SubjectStore.get(card.subjectId) : null;
    document.getElementById('choice-tag').textContent = subj
      ? `${subj.icon} ${subj.name}`
      : (card.tags?.[0] || '通用');
    document.getElementById('choice-question').textContent = card.question;

    // 渲染选项（随机打乱）
    const options = card.options || [];
    const correctIdx = card.correctIndex != null ? card.correctIndex : 0;
    const indexed = options.map((text, i) => ({ text, isCorrect: i === correctIdx }));
    // 简单洗牌
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }

    const grid = document.getElementById('choice-options-grid');
    grid.innerHTML = indexed.map((opt, i) => `
      <button class="choice-option-btn" data-index="${i}" data-correct="${opt.isCorrect}">
        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="option-text">${esc(opt.text)}</span>
      </button>
    `).join('');

    // 绑定点击
    grid.querySelectorAll('.choice-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => handleChoiceClick(btn, indexed));
    });
  } else {
    // 问答模式
    document.getElementById('card-flip-container').style.display = '';
    document.getElementById('choice-display').style.display = 'none';
    document.getElementById('card-flip-inner').classList.remove('flipped');
    document.getElementById('learn-actions').style.display = 'none';

    const subj = card.subjectId ? SubjectStore.get(card.subjectId) : null;
    document.getElementById('learn-tag').textContent = subj
      ? `${subj.icon} ${subj.name}`
      : (card.tags?.[0] || '通用');
    document.getElementById('learn-question').textContent = card.question;
    document.getElementById('learn-answer').textContent = card.answer;
  }
}

function handleChoiceClick(clickedBtn, indexedOptions) {
  if (!learnState || learnState.isProcessing) return;
  learnState.isProcessing = true;

  const isCorrect = clickedBtn.dataset.correct === 'true';
  const grid = document.getElementById('choice-options-grid');

  // 高亮所有按钮
  grid.querySelectorAll('.choice-option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') {
      btn.classList.add('correct');
    }
  });

  if (isCorrect) {
    clickedBtn.classList.add('correct');
  } else {
    clickedBtn.classList.add('wrong');
  }

  // 记录并延迟切换
  setTimeout(() => {
    handleFeedback(isCorrect);
  }, isCorrect ? 700 : 1200);
}

function updateLearnProgress() {
  if (!learnState) return;
  const done = learnState.currentIndex;
  const total = learnState.cards.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('learn-progress-text').textContent = `${done} / ${total}`;
  document.getElementById('learn-progress-fill').style.width = pct + '%';
}

function flipCard() {
  if (!learnState) return;
  const card = learnState.cards[learnState.currentIndex];
  if (!card || card.type === 'choice') return;

  learnState.isFlipped = !learnState.isFlipped;
  const inner = document.getElementById('card-flip-inner');
  if (learnState.isFlipped) {
    inner.classList.add('flipped');
    document.getElementById('learn-actions').style.display = 'flex';
  } else {
    inner.classList.remove('flipped');
    document.getElementById('learn-actions').style.display = 'none';
  }
}

function handleFeedback(remembered) {
  if (!learnState) return;

  const card = learnState.cards[learnState.currentIndex];
  CardStore.review(card.id, remembered);

  if (remembered) {
    learnState.remembered.push(card.id);
  } else {
    learnState.forgotten.push(card.id);
  }

  learnState.currentIndex++;

  if (learnState.currentIndex >= learnState.cards.length) {
    showLearnComplete();
  } else {
    updateLearnCard();
    updateLearnProgress();
  }
}

function showLearnComplete() {
  document.getElementById('card-flip-container').style.display = 'none';
  document.getElementById('choice-display').style.display = 'none';
  document.getElementById('learn-actions').style.display = 'none';
  document.getElementById('learn-complete').classList.add('active');

  const total = learnState.cards.length;
  const remembered = learnState.remembered.length;

  document.getElementById('complete-emoji').textContent =
    remembered === total ? '🎉' : remembered >= total * 0.7 ? '👏' : '💪';
  document.getElementById('complete-title').textContent =
    remembered === total ? '全部掌握！' : remembered >= total * 0.7 ? '表现不错！' : '继续加油！';
  document.getElementById('complete-text').textContent =
    `本次复习 ${total} 张卡片，记住了 ${remembered} 张`;

  // 打卡
  const userBefore = UserStore.get();
  UserStore.checkin();
  const userAfter = UserStore.get();

  // 首次打卡撒花
  if (userBefore.lastCheckin !== userAfter.lastCheckin) {
    spawnConfetti();
  }

  document.getElementById('learn-progress-text').textContent = `${total} / ${total}`;
  document.getElementById('learn-progress-fill').style.width = '100%';
}

function closeLearn() {
  document.getElementById('learn-overlay').classList.remove('active');
  learnState = null;
  document.getElementById('card-flip-container').style.display = '';
  document.getElementById('choice-display').style.display = 'none';
  document.getElementById('learn-complete').classList.remove('active');
  renderHome();
  renderUser();
}

// ── 学习模式事件绑定 ──────────────────────────────────────
document.getElementById('learn-close').addEventListener('click', closeLearn);
document.getElementById('card-flip-container').addEventListener('click', (e) => {
  if (document.getElementById('learn-complete').classList.contains('active')) return;
  if (learnState?.cards[learnState?.currentIndex]?.type === 'choice') return;
  flipCard();
});
document.getElementById('btn-again').addEventListener('click', (e) => {
  e.stopPropagation();
  handleFeedback(false);
});
document.getElementById('btn-got-it').addEventListener('click', (e) => {
  e.stopPropagation();
  handleFeedback(true);
});
document.getElementById('btn-start-learn').addEventListener('click', () => {
  const dueCards = CardStore.getDueCards(currentSubjectId === '__all__' ? null : currentSubjectId);
  if (dueCards.length === 0) return;
  startLearn(dueCards);
});
document.getElementById('btn-continue-learn').addEventListener('click', () => {
  const forgotten = learnState?.forgotten || [];
  const forgottenCards = forgotten
    .map(id => CardStore.list().find(c => c.id === id))
    .filter(Boolean);
  if (forgottenCards.length > 0) {
    startLearn(forgottenCards);
  } else {
    closeLearn();
  }
});
document.getElementById('btn-close-learn').addEventListener('click', closeLearn);

// ═══════════════════════════════════════════════════════════
//  撒花动画
// ═══════════════════════════════════════════════════════════

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#4CAF84','#FF9800','#2196F3','#E91E63','#FFEB3B','#9C27B0','#00BCD4','#FF5722'];
  const pieces = [];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = -(Math.random() * 20 + 10) + 'px';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (Math.random() * 8 + 4) + 'px';
    piece.style.height = (Math.random() * 8 + 4) + 'px';
    piece.style.animationDelay = Math.random() * 0.8 + 's';
    piece.style.animationDuration = (Math.random() * 1.5 + 2) + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
    pieces.push(piece);
  }

  setTimeout(() => {
    pieces.forEach(p => p.remove());
  }, 3500);
}

// ═══════════════════════════════════════════════════════════
//  添加页面
// ═══════════════════════════════════════════════════════════

// ── 类型切换 ──────────────────────────────────────────────
document.getElementById('type-toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;
  currentCardType = btn.dataset.type;

  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (currentCardType === 'choice') {
    document.getElementById('qa-answer-group').style.display = 'none';
    document.getElementById('choice-options-section').style.display = '';
  } else {
    document.getElementById('qa-answer-group').style.display = '';
    document.getElementById('choice-options-section').style.display = 'none';
  }
});

// ── 渲染学科选择器 ────────────────────────────────────────
function renderSubjectSelect(selectEl, defaultId) {
  const subjects = SubjectStore.list();
  selectEl.innerHTML = '<option value="">未分类</option>' +
    subjects.map(s => `<option value="${s.id}" ${s.id === defaultId ? 'selected' : ''}>${s.icon} ${s.name}</option>`).join('');
}

// ── 标签输入 ──────────────────────────────────────────────
function renderTagChips() {
  const wrapper = document.getElementById('tag-chips');
  const input = document.getElementById('tag-input');

  wrapper.innerHTML = tagInputState.tags.map(tag => `
    <span class="tag-chip">
      ${esc(tag)}
      <span class="tag-remove" data-tag="${esc(tag)}">×</span>
    </span>
  `).join('');

  wrapper.appendChild(input);
  input.value = '';

  wrapper.querySelectorAll('.tag-remove').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      tagInputState.tags = tagInputState.tags.filter(t => t !== tag);
      renderTagChips();
    });
  });
}

document.getElementById('tag-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim();
    if (val && !tagInputState.tags.includes(val) && tagInputState.tags.length < 5) {
      tagInputState.tags.push(val);
      renderTagChips();
    }
  }
});

// ── AI 生成按钮 ───────────────────────────────────────────
document.getElementById('btn-ai-generate').addEventListener('click', async () => {
  const question = document.getElementById('input-question').value.trim();
  const correctAnswer = document.getElementById('input-correct-option').value.trim();

  if (!question) { toast('请先输入问题'); return; }
  if (!correctAnswer) { toast('请先输入正确答案'); return; }

  const btn = document.getElementById('btn-ai-generate');
  const status = document.getElementById('ai-status');
  btn.disabled = true;
  btn.querySelector('.ai-btn-text').textContent = 'AI 正在生成…';
  status.style.display = 'none';

  try {
    const options = await generateWrongOptions(question, correctAnswer, 3);
    const container = document.getElementById('wrong-options-container');
    const inputs = container.querySelectorAll('.wrong-option-input');
    options.forEach((opt, i) => {
      if (inputs[i]) inputs[i].value = opt;
    });
    toast('✅ AI 已生成 ' + options.length + ' 个干扰项');
  } catch (err) {
    status.style.display = 'block';
    status.textContent = '❌ ' + err.message;
    status.style.color = '#E53935';
    // 未配置时引导用户
    if (err.message.includes('API 密钥') || err.message.includes('配置')) {
      toast('⚙️ 请先在「我的」页面配置 AI 密钥');
    }
  } finally {
    btn.disabled = false;
    btn.querySelector('.ai-btn-text').textContent = 'AI 生成干扰项';
  }
});

// ── 保存卡片 ──────────────────────────────────────────────
document.getElementById('btn-submit-card').addEventListener('click', () => {
  const question = document.getElementById('input-question').value.trim();
  const subjectId = document.getElementById('input-subject').value || null;

  if (!question) { toast('请输入问题'); return; }

  if (currentCardType === 'choice') {
    const correctAnswer = document.getElementById('input-correct-option').value.trim();
    const wrongInputs = document.querySelectorAll('#wrong-options-container .wrong-option-input');
    const wrongOptions = Array.from(wrongInputs)
      .map(inp => inp.value.trim())
      .filter(v => v);

    if (!correctAnswer) { toast('请输入正确答案'); return; }
    if (wrongOptions.length < 2) { toast('请至少输入2个错误选项'); return; }

    // 构建选项数组：正确答案在第一位 + 错误选项
    const options = [correctAnswer, ...wrongOptions];

    CardStore.add({
      type: 'choice',
      subjectId,
      question,
      answer: correctAnswer,
      options,
      correctIndex: 0,
      tags: tagInputState.tags.length ? tagInputState.tags : ['通用'],
    });
  } else {
    const answer = document.getElementById('input-answer').value.trim();
    if (!answer) { toast('请输入答案'); return; }

    CardStore.add({
      type: 'qa',
      subjectId,
      question,
      answer,
      tags: tagInputState.tags.length ? tagInputState.tags : ['通用'],
    });
  }

  // 重置表单
  document.getElementById('input-question').value = '';
  document.getElementById('input-answer').value = '';
  document.getElementById('input-correct-option').value = '';
  document.querySelectorAll('#wrong-options-container .wrong-option-input').forEach(inp => inp.value = '');
  tagInputState.tags = [];
  renderTagChips();

  toast('✅ 卡片添加成功！');
});

// ═══════════════════════════════════════════════════════════
//  用户页面
// ═══════════════════════════════════════════════════════════

function renderUser() {
  const stats = CardStore.stats();
  const user = UserStore.get();
  const reviewStats = ReviewLogStore.getStats();

  document.getElementById('user-streak').textContent = '🔥 连续打卡 ' + user.streak + ' 天';
  document.getElementById('user-stat-total').textContent = stats.total;
  document.getElementById('user-stat-mastered').textContent = stats.mastered;
  document.getElementById('user-stat-due').textContent = stats.due;
  document.getElementById('user-stat-reviews').textContent = reviewStats.total;

  document.getElementById('checkin-date').textContent =
    user.lastCheckin ? fmtFullDate(new Date(user.lastCheckin).getTime()) : '尚未打卡';

  renderCalendar();
}

// ── 打卡日历 ──────────────────────────────────────────────
function renderCalendar() {
  const heatmap = ReviewLogStore.getHeatmap(70);
  const grid = document.getElementById('calendar-grid');

  if (!grid) return;

  // 获取日期排序列表
  const entries = Array.from(heatmap.entries());
  // 已经是从今天往前70天排好序的

  // 找到起始日（70天前）的周一，以便对齐
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 69); // 70天包括今天
  const dayOfWeek = startDate.getDay(); // 0=周日
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const gridStart = new Date(startDate);
  gridStart.setDate(startDate.getDate() + mondayOffset);

  // 生成所有格子（从 gridStart 到今天，确保是7的倍数行）
  const totalDays = Math.ceil((now - gridStart) / (86400000)) + 1;
  const rows = Math.ceil(totalDays / 7);
  const paddedDays = rows * 7;

  // 构建按日期索引的查找
  const lookup = {};
  for (const [date, count] of entries) {
    lookup[date] = count;
  }

  let html = '';
  for (let i = 0; i < paddedDays; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    const count = lookup[key] || 0;
    const inRange = d >= startDate && d <= now;
    const isToday = key === (now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0'));

    // 热力颜色
    let bg;
    if (!inRange) {
      bg = 'transparent';
    } else if (count === 0) {
      bg = '#EBEDF0';
    } else if (count <= 3) {
      bg = '#C6E48B';
    } else if (count <= 7) {
      bg = '#7BC96F';
    } else if (count <= 15) {
      bg = '#239A3B';
    } else {
      bg = '#196127';
    }

    html += `<div class="calendar-cell ${isToday ? 'today' : ''}"
      style="background:${bg}"
      title="${key}: ${count} 次复习"
      data-date="${key}"
      data-count="${count}"></div>`;
  }

  grid.innerHTML = html;
  document.getElementById('badge-calendar-days').textContent =
    `总计 ${ReviewLogStore.getStats().totalDays} 天学习了`;
}

// ── 用户页面操作 ──────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const json = CardStore.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `知识卡片备份-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('📦 导出成功');
});

document.getElementById('btn-import-trigger').addEventListener('click', () => {
  document.getElementById('file-import').click();
});

document.getElementById('file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    CardStore.importJSON(text);
    toast('📥 导入成功');
    renderHome();
    renderUser();
  } catch (err) {
    toast('❌ 文件格式错误');
  }
  e.target.value = '';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  showConfirm('清空数据', '确定要清空所有数据吗？此操作不可恢复！', () => {
    CardStore.resetAll();
    tagInputState.tags = [];
    renderTagChips();
    currentSubjectId = '__all__';
    renderSubjectCarousel();
    renderHome();
    renderUser();
    toast('🗑️ 数据已清空');
  });
});

// ═══════════════════════════════════════════════════════════
//  AI 配置 Modal
// ═══════════════════════════════════════════════════════════

const modalAIConfig = document.getElementById('modal-ai-config');

function openAIConfig() {
  const cfg = AIConfig.get();
  if (cfg) {
    document.getElementById('ai-provider').value = cfg.provider || 'openai';
    document.getElementById('ai-apikey').value = cfg.apiKey || '';
    document.getElementById('ai-model').value = cfg.model || '';
    document.getElementById('ai-baseurl').value = cfg.baseUrl || '';
    if (cfg.apiKey) {
      document.getElementById('ai-key-hint').textContent =
        `已配置 · 结尾 ${cfg.apiKey.slice(-4)}`;
    }
  }
  // 切换自定义 baseUrl 显示
  toggleBaseUrl();
  document.getElementById('test-result').style.display = 'none';
  modalAIConfig.classList.add('active');
}

function closeAIConfig() {
  modalAIConfig.classList.remove('active');
}

document.getElementById('btn-ai-config').addEventListener('click', openAIConfig);
modalAIConfig.addEventListener('click', (e) => {
  if (e.target === modalAIConfig) closeAIConfig();
});

// Provider 切换 → 显示/隐藏自定义 baseUrl
document.getElementById('ai-provider').addEventListener('change', toggleBaseUrl);
function toggleBaseUrl() {
  const provider = document.getElementById('ai-provider').value;
  document.getElementById('ai-baseurl-group').style.display =
    provider === 'custom' ? '' : 'none';
}

// 测试连接
document.getElementById('btn-test-connection').addEventListener('click', async () => {
  const result = document.getElementById('test-result');
  result.style.display = 'block';
  result.textContent = '⏳ 正在测试…';
  result.style.color = 'var(--text-secondary)';

  // 临时保存配置用于测试
  saveAIConfigSilent();

  try {
    await testConnection();
    result.textContent = '✅ 连接成功！API 配置正确';
    result.style.color = '#2E7D32';
  } catch (err) {
    result.textContent = '❌ ' + err.message;
    result.style.color = '#E53935';
  }
});

function saveAIConfigSilent() {
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('ai-apikey').value.trim();
  const model = document.getElementById('ai-model').value.trim();
  const baseUrl = document.getElementById('ai-baseurl').value.trim();

  if (!apiKey) {
    AIConfig.delete();
    return;
  }
  AIConfig.save({ provider, apiKey, model, baseUrl });
}

// 保存配置
document.getElementById('btn-save-ai-config').addEventListener('click', () => {
  const apiKey = document.getElementById('ai-apikey').value.trim();
  if (!apiKey) {
    toast('请输入 API Key');
    return;
  }
  saveAIConfigSilent();
  document.getElementById('ai-key-hint').textContent =
    `已配置 · 结尾 ${apiKey.slice(-4)}`;
  toast('✅ AI 配置已保存');
  closeAIConfig();
});

// 删除配置
document.getElementById('btn-delete-ai-config').addEventListener('click', () => {
  showConfirm('删除配置', '确定要删除 AI API 配置吗？', () => {
    AIConfig.delete();
    document.getElementById('ai-apikey').value = '';
    document.getElementById('ai-model').value = '';
    document.getElementById('ai-baseurl').value = '';
    document.getElementById('ai-key-hint').textContent = '';
    toast('🗑️ AI 配置已删除');
    closeAIConfig();
  });
});

// ═══════════════════════════════════════════════════════════
//  确认弹窗
// ═══════════════════════════════════════════════════════════

let confirmCallback = null;
const modalConfirm = document.getElementById('modal-confirm');

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  modalConfirm.classList.add('active');
}

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  modalConfirm.classList.remove('active');
  confirmCallback = null;
});

document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  modalConfirm.classList.remove('active');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});

modalConfirm.addEventListener('click', (e) => {
  if (e.target === modalConfirm) {
    modalConfirm.classList.remove('active');
    confirmCallback = null;
  }
});

// ═══════════════════════════════════════════════════════════
//  卡片管理覆盖层
// ═══════════════════════════════════════════════════════════

const manageOverlay = document.getElementById('manage-overlay');

function openManage() {
  manageOverlay.classList.add('active');
  document.getElementById('manage-search-input').value = '';

  // 渲染学科过滤器
  const filterSelect = document.getElementById('manage-filter-subject');
  const subjects = SubjectStore.list();
  filterSelect.innerHTML = '<option value="__all__">全部分科</option>';
  subjects.forEach(s => {
    filterSelect.innerHTML += `<option value="${s.id}">${s.icon} ${s.name}</option>`;
  });

  filterSelect.value = currentSubjectId === '__all__' ? '__all__' : currentSubjectId;
  renderManageCards();
}

function closeManage() {
  manageOverlay.classList.remove('active');
  renderHome();
  renderUser();
}

document.getElementById('btn-manage-cards').addEventListener('click', openManage);
document.getElementById('manage-back').addEventListener('click', closeManage);

// 搜索和过滤
document.getElementById('manage-search-input').addEventListener('input', renderManageCards);
document.getElementById('manage-filter-subject').addEventListener('change', renderManageCards);

function renderManageCards() {
  const query = document.getElementById('manage-search-input').value.trim().toLowerCase();
  const subjectFilter = document.getElementById('manage-filter-subject').value;

  let cards = CardStore.list();
  if (subjectFilter !== '__all__') {
    cards = cards.filter(c => (c.subjectId || null) === subjectFilter);
  }
  if (query) {
    cards = cards.filter(c =>
      c.question.toLowerCase().includes(query) ||
      c.answer.toLowerCase().includes(query) ||
      (c.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  const list = document.getElementById('manage-card-list');
  const empty = document.getElementById('manage-empty');

  if (cards.length === 0) {
    list.style.display = 'none';
    empty.style.display = '';
    return;
  }

  list.style.display = '';
  empty.style.display = 'none';

  const tagColors = ['#4CAF84', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4'];
  list.innerHTML = cards.map((c, i) => {
    const subj = c.subjectId ? SubjectStore.get(c.subjectId) : null;
    const subjName = subj ? `${subj.icon} ${subj.name}` : '未分类';
    const typeBadge = c.type === 'choice' ? '📋选择' : '📝问答';
    return `
    <div class="manage-card-item">
      <div class="manage-card-left">
        <div class="mini-tag ${c.mastery >= 80 ? 'mastered' : ''}" style="background:${tagColors[i % tagColors.length]}"></div>
        <div class="manage-card-info">
          <div class="manage-card-q">${esc(c.question)}</div>
          <div class="manage-card-meta">
            <span class="type-badge">${typeBadge}</span>
            <span>${subjName}</span>
            <span>掌握 ${c.mastery || 0}%</span>
          </div>
        </div>
      </div>
      <div class="manage-card-actions">
        <button class="btn-icon-sm" data-action="edit" data-id="${c.id}" title="编辑">✏️</button>
        <button class="btn-icon-sm danger" data-action="delete" data-id="${c.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }).join('');

  // 绑定操作按钮
  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.id;
      const card = CardStore.list().find(c => c.id === cardId);
      showConfirm('删除卡片', `确定要删除「${card?.question?.slice(0, 30)}…」吗？`, () => {
        CardStore.delete(cardId);
        renderManageCards();
        toast('🗑️ 卡片已删除');
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  编辑卡片 Modal
// ═══════════════════════════════════════════════════════════

const modalEdit = document.getElementById('modal-edit-card');

function openEditModal(cardId) {
  const card = CardStore.list().find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-question').value = card.question;

  // 渲染学科选择器
  renderSubjectSelect(document.getElementById('edit-subject'), card.subjectId);

  if (card.type === 'choice') {
    document.getElementById('edit-answer-group').style.display = 'none';
    document.getElementById('edit-choice-section').style.display = '';
    document.getElementById('edit-correct-option').value = card.answer || '';
    const wrongInputs = document.querySelectorAll('#edit-wrong-options .wrong-option-input');
    const wrongs = (card.options || []).filter((_, i) => i !== (card.correctIndex || 0));
    wrongInputs.forEach((inp, i) => {
      inp.value = wrongs[i] || '';
    });
  } else {
    document.getElementById('edit-answer-group').style.display = '';
    document.getElementById('edit-choice-section').style.display = 'none';
    document.getElementById('edit-answer').value = card.answer;
  }

  document.getElementById('edit-tags').value = (card.tags || []).join(', ');
  modalEdit.classList.add('active');
}

function closeEditModal() {
  modalEdit.classList.remove('active');
}

document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);
modalEdit.addEventListener('click', (e) => {
  if (e.target === modalEdit) closeEditModal();
});

document.getElementById('btn-save-edit').addEventListener('click', () => {
  const cardId = document.getElementById('edit-card-id').value;
  if (!cardId) return;

  const card = CardStore.list().find(c => c.id === cardId);
  if (!card) return;

  const question = document.getElementById('edit-question').value.trim();
  const subjectId = document.getElementById('edit-subject').value || null;
  const tagsStr = document.getElementById('edit-tags').value.trim();
  const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5) : ['通用'];

  if (!question) { toast('请输入问题'); return; }

  const patch = { question, subjectId, tags };

  if (card.type === 'choice') {
    const correctAnswer = document.getElementById('edit-correct-option').value.trim();
    const wrongInputs = document.querySelectorAll('#edit-wrong-options .wrong-option-input');
    const wrongs = Array.from(wrongInputs).map(inp => inp.value.trim()).filter(v => v);

    if (!correctAnswer) { toast('请输入正确答案'); return; }
    if (wrongs.length < 2) { toast('请至少输入2个错误选项'); return; }

    patch.answer = correctAnswer;
    patch.options = [correctAnswer, ...wrongs];
    patch.correctIndex = 0;
  } else {
    const answer = document.getElementById('edit-answer').value.trim();
    if (!answer) { toast('请输入答案'); return; }
    patch.answer = answer;
  }

  CardStore.update(cardId, patch);
  closeEditModal();
  renderManageCards();
  toast('✅ 卡片已更新');
});

// ═══════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════════════════════════════════════════════════
//  Onboarding 引导
// ═══════════════════════════════════════════════════════════

const ONBOARD_KEY = 'knowledge-card-onboard-done';
const onboardOverlay = document.getElementById('onboard-overlay');
const onboardSlides = document.getElementById('onboard-slides');
const onboardDots = document.getElementById('onboard-dots');
const onboardNext = document.getElementById('onboard-next');
const onboardSkip = document.getElementById('onboard-skip');
let onboardSlideIdx = 0;
const onboardTotal = 3;

function showOnboarding() {
  if (localStorage.getItem(ONBOARD_KEY)) return;
  onboardOverlay.classList.add('active');
  onboardSlideIdx = 0;
  updateOnboardUI();
}

function updateOnboardUI() {
  onboardSlides.scrollTo({ left: onboardSlideIdx * onboardSlides.clientWidth, behavior: 'smooth' });
  const dots = onboardDots.querySelectorAll('.onboard-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === onboardSlideIdx));
  if (onboardSlideIdx === onboardTotal - 1) {
    onboardNext.textContent = '开始使用';
    onboardNext.classList.add('start');
  } else {
    onboardNext.textContent = '下一步';
    onboardNext.classList.remove('start');
  }
}

function finishOnboarding() {
  onboardOverlay.classList.remove('active');
  localStorage.setItem(ONBOARD_KEY, 'true');
}

onboardNext.addEventListener('click', () => {
  if (onboardSlideIdx < onboardTotal - 1) {
    onboardSlideIdx++;
    updateOnboardUI();
  } else {
    finishOnboarding();
  }
});

onboardSkip.addEventListener('click', finishOnboarding);

// 监听滑动更新 dots
onboardSlides.addEventListener('scroll', () => {
  const idx = Math.round(onboardSlides.scrollLeft / onboardSlides.clientWidth);
  if (idx !== onboardSlideIdx) {
    onboardSlideIdx = idx;
    const dots = onboardDots.querySelectorAll('.onboard-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (idx === onboardTotal - 1) {
      onboardNext.textContent = '开始使用';
      onboardNext.classList.add('start');
    } else {
      onboardNext.textContent = '下一步';
      onboardNext.classList.remove('start');
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  Markdown 批量导入
// ═══════════════════════════════════════════════════════════

const modalImport = document.getElementById('modal-batch-import');

function openBatchImport() {
  document.getElementById('import-md-textarea').value = '';
  document.getElementById('import-md-file').value = '';
  document.getElementById('import-result').style.display = 'none';
  modalImport.classList.add('active');
}

function closeBatchImport() {
  modalImport.classList.remove('active');
}

/** 解析 Markdown 卡片文本 */
function parseMarkdownCards(mdText) {
  const cards = [];
  let currentSubject = null;

  const lines = mdText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // 学科标题：## 学科名
    if (line.startsWith('## ')) {
      currentSubject = line.slice(3).trim();
      i++;
      continue;
    }

    // 问题：Q: 或 Q：[选择]
    if (line.startsWith('Q:') || line.startsWith('Q：')) {
      let question = line.slice(2).trim();
      let type = 'qa';

      // 检测 [选择] 标记
      const choiceMatch = question.match(/^\[选择\]\s*(.*)/);
      if (choiceMatch) {
        type = 'choice';
        question = choiceMatch[1];
      }

      // 找答案 A:
      let answer = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('Q:') && !lines[i].trim().startsWith('Q：') && !lines[i].trim().startsWith('## ')) {
        const aLine = lines[i].trim();
        if (aLine.startsWith('A:') || aLine.startsWith('A：')) {
          answer = aLine.slice(2).trim();
          break;
        }
        i++;
      }

      if (question && answer) {
        if (type === 'choice') {
          // 收集错误选项（- xxx 行）
          const wrongOptions = [];
          i++;
          while (i < lines.length && lines[i].trim().startsWith('-')) {
            wrongOptions.push(lines[i].trim().slice(1).trim());
            i++;
          }
          // 回退一行（可能是下一个 Q: 或 ##）
          if (i < lines.length && (lines[i].trim().startsWith('Q:') || lines[i].trim().startsWith('Q：') || lines[i].trim().startsWith('## '))) {
            // don't advance
          } else {
            i++;
          }

          if (wrongOptions.length >= 2) {
            cards.push({
              type: 'choice',
              subjectId: findSubjectId(currentSubject),
              question,
              answer,
              options: [answer, ...wrongOptions],
              correctIndex: 0,
              tags: currentSubject ? [currentSubject] : ['通用'],
            });
          }
        } else {
          cards.push({
            type: 'qa',
            subjectId: findSubjectId(currentSubject),
            question,
            answer,
            tags: currentSubject ? [currentSubject] : ['通用'],
          });
          i++;
        }
      } else {
        i++;
      }
      continue;
    }

    i++;
  }

  return cards;
}

/** 根据学科名称查找 ID（模糊匹配） */
function findSubjectId(name) {
  if (!name) return null;
  const subjects = SubjectStore.list();
  // 精确匹配
  const exact = subjects.find(s => s.name === name);
  if (exact) return exact.id;
  // 包含匹配
  const partial = subjects.find(s => s.name.includes(name) || name.includes(s.name));
  if (partial) return partial.id;
  // 不匹配则返回 null（未分类）
  return null;
}

/** 下载 Markdown 模板 */
function downloadTemplate() {
  const template = `## 数学
Q: 什么是勾股定理？
A: 直角三角形的两条直角边的平方和等于斜边的平方，即 a²+b²=c²

Q: [选择] 1+1 等于几？
A: 2
- 3
- 4
- 5

## 英语
Q: apple 的中文意思是？
A: 苹果

Q: abandon 的中文意思是？
A: 放弃；抛弃

## 编程
Q: 什么是闭包？
A: 函数能够访问其外部作用域中变量的特性，即使外部函数已经执行完毕`;
  const blob = new Blob([template], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '知识卡片导入模板.md';
  a.click();
  toast('📥 模板已下载');
}

/** 执行批量导入 */
function doBatchImport() {
  let mdText = document.getElementById('import-md-textarea').value.trim();

  if (!mdText) {
    toast('请粘贴 Markdown 内容或选择文件');
    return;
  }

  const cards = parseMarkdownCards(mdText);
  if (cards.length === 0) {
    document.getElementById('import-result').style.display = 'block';
    document.getElementById('import-result').textContent = '❌ 未识别到有效的卡片格式';
    document.getElementById('import-result').style.color = 'var(--danger)';
    return;
  }

  let imported = 0;
  cards.forEach(c => {
    try {
      CardStore.add(c);
      imported++;
    } catch (e) {
      console.warn('import failed:', e);
    }
  });

  document.getElementById('import-result').style.display = 'block';
  document.getElementById('import-result').textContent =
    `✅ 成功导入 ${imported} 张卡片` + (imported < cards.length ? `（${cards.length - imported} 张失败）` : '');
  document.getElementById('import-result').style.color = 'var(--success)';
  document.getElementById('import-md-textarea').value = '';

  renderHome();
  renderUser();
}

// 批量导入事件绑定
document.getElementById('btn-batch-import').addEventListener('click', openBatchImport);
document.getElementById('btn-cancel-import').addEventListener('click', closeBatchImport);
modalImport.addEventListener('click', (e) => { if (e.target === modalImport) closeBatchImport(); });
document.getElementById('btn-download-template').addEventListener('click', downloadTemplate);
document.getElementById('btn-do-import').addEventListener('click', doBatchImport);

// 文件选择导入
document.getElementById('import-md-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    document.getElementById('import-md-textarea').value = text;
    toast('📄 文件已加载，点击「导入」继续');
  } catch (err) {
    toast('❌ 文件读取失败');
  }
  e.target.value = '';
});

// ═══════════════════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════════════════

renderSubjectCarousel();
renderHome();
renderTagChips();
renderSubjectSelect(document.getElementById('input-subject'), null);

// 显示引导页
showOnboarding();

// 暴露到全局供 HTML onclick 使用
window.switchPage = switchPage;
window.startLearn = startLearn;
window.flipCard = flipCard;
window.handleFeedback = handleFeedback;
window.closeLearn = closeLearn;
