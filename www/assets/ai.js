/**
 * 知识卡片 · AI 调用模块
 * 支持 OpenAI / Claude / DeepSeek 的 API 调用
 * API Key 使用简单 XOR 混淆存储在 localStorage
 */

const AI_CONFIG_KEY = 'knowledge-card-ai-config-v1';

// ── 简单混淆 ──────────────────────────────────────────────
const XOR_SEED = 'kc2026_seed_7x';

function xor(str, key) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function obfuscate(plain) {
  return btoa(xor(plain, XOR_SEED));
}

function deobfuscate(encoded) {
  try {
    return xor(atob(encoded), XOR_SEED);
  } catch (e) {
    return '';
  }
}

// ── API 配置操作 ─────────────────────────────────────────
export const AIConfig = {
  get() {
    try {
      const raw = localStorage.getItem(AI_CONFIG_KEY);
      if (!raw) return null;
      const cfg = JSON.parse(raw);
      if (cfg.apiKey) {
        cfg.apiKey = deobfuscate(cfg.apiKey);
      }
      // 确保有默认值
      cfg.provider = cfg.provider || 'openai';
      cfg.model = cfg.model || '';
      return cfg;
    } catch (e) {
      return null;
    }
  },

  save({ provider, apiKey, model, baseUrl }) {
    const cfg = {
      provider: provider || 'openai',
      apiKey: apiKey ? obfuscate(apiKey) : '',
      model: model || '',
      baseUrl: baseUrl || '',
    };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
  },

  delete() {
    localStorage.removeItem(AI_CONFIG_KEY);
  },

  /** 获取纯文本 API Key */
  getKey() {
    const cfg = this.get();
    return cfg ? cfg.apiKey : '';
  },
};

// ── API 调用 ─────────────────────────────────────────────

/** 构造生成错误选项的 Prompt */
function buildPrompt(question, answer, count) {
  return `你是一个出题助手。为以下选择题生成${count}个错误选项。

题目：${question}
正确答案：${answer}

要求：
- 错误选项要有高度迷惑性，与正确答案相关但实质不同
- 不要包含正确答案
- 每行一个选项
- 不要编号
- 不要解释
- 选项长度与正确答案相近`;
}

/** 调用 OpenAI API */
async function callOpenAI({ apiKey, model, baseUrl, prompt, count }) {
  const url = (baseUrl || 'https://api.openai.com/v1') + '/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI 错误: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

/** 调用 Claude API */
async function callClaude({ apiKey, model, baseUrl, prompt, count }) {
  const url = (baseUrl || 'https://api.anthropic.com/v1') + '/messages';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude 错误: ${resp.status}`);
  }
  const data = await resp.json();
  return data.content[0].text.trim();
}

/** 调用 DeepSeek API */
async function callDeepSeek({ apiKey, model, baseUrl, prompt, count }) {
  const url = (baseUrl || 'https://api.deepseek.com/v1') + '/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek 错误: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

/** 解析 AI 返回的选项文本 */
function parseOptions(text) {
  // 按行分割，去除空行、编号、引号
  return text
    .split('\n')
    .map(line => line.trim())
    .map(line => line.replace(/^[\d]+[\.\)\、\s]+/, '')) // 去编号
    .map(line => line.replace(/^[-*•]\s*/, ''))          // 去列表符号
    .map(line => line.replace(/^["'""''【】\[\]]+|["'""''【】\[\]]+$/g, '')) // 去引号
    .filter(line => line.length > 1)
    .slice(0, 5); // 最多5个
}

/** 主要导出：生成干扰项 */
export async function generateWrongOptions(question, answer, count = 3) {
  const cfg = AIConfig.get();
  if (!cfg || !cfg.apiKey) {
    throw new Error('请先配置 API 密钥');
  }

  if (!question || !answer) {
    throw new Error('请先输入题目和答案');
  }

  const prompt = buildPrompt(question, answer, count);

  let rawText;
  switch (cfg.provider) {
    case 'claude':
      rawText = await callClaude({ ...cfg, prompt, count });
      break;
    case 'deepseek':
      rawText = await callDeepSeek({ ...cfg, prompt, count });
      break;
    default:
      rawText = await callOpenAI({ ...cfg, prompt, count });
  }

  const options = parseOptions(rawText);
  if (options.length < 2) {
    throw new Error('AI 生成结果不足，请重试');
  }

  return options;
}

/** 测试 API 连接 */
export async function testConnection() {
  const cfg = AIConfig.get();
  if (!cfg || !cfg.apiKey) {
    throw new Error('请先配置 API 密钥');
  }

  const question = '水的化学式是什么？';
  const answer = 'H₂O';
  const prompt = buildPrompt(question, answer, 1);

  switch (cfg.provider) {
    case 'claude':
      await callClaude({ ...cfg, prompt, count: 1 });
      break;
    case 'deepseek':
      await callDeepSeek({ ...cfg, prompt, count: 1 });
      break;
    default:
      await callOpenAI({ ...cfg, prompt, count: 1 });
  }

  return true;
}
