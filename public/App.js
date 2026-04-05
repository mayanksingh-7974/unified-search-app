// =============================================
//  STATE
// =============================================
let state = {
  claudeKey:      sessionStorage.getItem('kf_claude')   || '',
  slackToken:     sessionStorage.getItem('kf_slack')    || '',
  notionToken:    sessionStorage.getItem('kf_notion')   || '',
  slackChannels:  sessionStorage.getItem('kf_slack_channels') || 'general',
  slackChannelIds: JSON.parse(sessionStorage.getItem('kf_slack_ch_ids') || '[]'),
  slackConnected:  false,
  notionConnected: false,
  searchSlack:  true,
  searchNotion: true,
  queryCount: 0,
  slackHits:  0,
  notionHits: 0,
  aiAnswers:  0,
};

// =============================================
//  INIT
// =============================================
window.addEventListener('load', () => {
  initParticles();

  if (state.claudeKey) {
    document.getElementById('claude-key-main').value = state.claudeKey;
    document.getElementById('sb-claude-key').value   = state.claudeKey;
    updateClaudeStatus(true);
  }

  if (state.slackToken) {
    document.getElementById('slack-bot-token').value  = state.slackToken;
    document.getElementById('slack-channels') &&
      (document.getElementById('slack-channels').value = state.slackChannels);
  }

  if (state.notionToken) {
    document.getElementById('notion-token').value = state.notionToken;
  }
});

// =============================================
//  NAVIGATION
// =============================================
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + id).classList.remove('hidden');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'analytics') drawChart();
}

function fillQuery(text) {
  showPanel('chat');
  document.getElementById('queryInput').value = text;
  document.getElementById('queryInput').focus();
}

// =============================================
//  KEY MANAGEMENT
// =============================================
function saveClaude() {
  const v = document.getElementById('claude-key-main').value.trim();
  document.getElementById('sb-claude-key').value = v;
  state.claudeKey = v;
  sessionStorage.setItem('kf_claude', v);
  updateClaudeStatus(v.startsWith('sk-'));
  updateChatBadge();
}

function saveKeys() {
  const v = document.getElementById('sb-claude-key').value.trim();
  document.getElementById('claude-key-main').value = v;
  state.claudeKey = v;
  sessionStorage.setItem('kf_claude', v);
  updateClaudeStatus(v.startsWith('sk-'));
  updateChatBadge();
}

function updateClaudeStatus(ok) {
  const dot = document.querySelector('#claude-status-indicator .dot');
  const txt = document.getElementById('claude-status-text');
  if (ok) {
    dot.className = 'dot dot-green';
    txt.textContent = 'Connected';
  } else {
    dot.className = 'dot dot-gray';
    txt.textContent = 'Not set';
  }
}

function updateChatBadge() {
  const badge    = document.getElementById('chat-badge');
  const slackOk  = state.slackConnected;
  const notionOk = state.notionConnected;
  const claudeOk = state.claudeKey.startsWith('sk-');

  if (claudeOk && (slackOk || notionOk)) {
    const srcs = [slackOk ? 'Slack' : null, notionOk ? 'Notion' : null].filter(Boolean).join(' + ');
    badge.className   = 'badge badge-live';
    badge.textContent = `Live · ${srcs}`;
  } else {
    badge.className   = 'badge badge-demo';
    badge.textContent = 'Configure integrations to begin';
  }
}

// =============================================
//  SLACK — via CORS proxy (browser restriction)
// =============================================
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

async function slackAPI(endpoint, params, token) {
  const target = new URL('https://slack.com/api/' + endpoint);
  if (params) Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
  const targetUrl = target.toString();

  let lastErr;
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('Network error (CORS proxy failed): ' + (lastErr?.message || 'unknown'));
}

function showSlackError(msg) {
  const el = document.getElementById('slack-error-msg');
  el.style.display = 'block';
  el.innerHTML = msg;
}

function hideSlackError() {
  document.getElementById('slack-error-msg').style.display = 'none';
}

async function connectSlack() {
  const userToken = document.getElementById('slack-bot-token').value.trim();
  const botToken  = document.getElementById('slack-bot-token-b').value.trim();
  const token     = userToken || botToken;

  if (!token) {
    showSlackError('⚠️ Please enter at least one token (User or Bot).');
    return;
  }
  hideSlackError();

  const btn = document.getElementById('slack-connect-btn');
  btn.textContent = 'Connecting…';
  btn.disabled    = true;

  try {
    // Step 1: verify identity
    const auth = await slackAPI('auth.test', null, token);
    if (!auth.ok) {
      const tips = {
        'invalid_auth':   'Token is invalid or expired. Double-check it was copied fully.',
        'not_authed':     'No token sent. Make sure there are no extra spaces.',
        'account_inactive': 'This Slack account is deactivated.',
        'token_revoked':  'Token has been revoked. Generate a new one.',
        'missing_scope':  'Token is missing required scopes. Add <code>channels:read</code>, <code>channels:history</code>, and <code>search:read</code> (search:read needs a User token).',
      };
      const tip = tips[auth.error] || '';
      throw new Error(`<strong>${auth.error}</strong>${tip ? ' — ' + tip : ''}`);
    }

    // Step 2: fetch channels list
    let channels = [];
    const convRes = await slackAPI(
      'conversations.list',
      { limit: 200, types: 'public_channel,private_channel' },
      token
    );

    if (convRes.ok && convRes.channels) {
      channels = convRes.channels
        .filter(c => !c.is_archived)
        .sort((a, b) => (b.num_members || 0) - (a.num_members || 0));
    } else if (convRes.error === 'missing_scope') {
      showSlackError('⚠️ <strong>channels:read</strong> scope missing. Add it to your Slack app, reinstall, then reconnect.');
      channels = [];
    }

    // Save state
    state.slackToken      = token;
    state.slackConnected  = true;
    state.slackChannelIds = channels.map(c => c.id);
    sessionStorage.setItem('kf_slack', token);
    sessionStorage.setItem('kf_slack_ch_ids', JSON.stringify(state.slackChannelIds));

    // Update indicators
    document.getElementById('slack-card').classList.add('connected');
    document.querySelector('#slack-status-indicator .dot').className = 'dot dot-green';
    document.getElementById('slack-status-text').textContent = `@${auth.user} · ${auth.team}`;
    document.getElementById('ss-slack').textContent = `✓ ${auth.team}`;

    // Render channel list
    const chList = document.getElementById('slack-channel-list');
    if (channels.length > 0) {
      chList.innerHTML = channels.map(ch => `
        <div class="resource-item">
          <input type="checkbox" checked data-ch-id="${ch.id}" data-ch-name="${ch.name}"/>
          <span class="ri-name">#${ch.name}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--text3)">${ch.num_members || 0} members</span>
        </div>`).join('');
    } else {
      chList.innerHTML = `<div style="font-size:13px;color:var(--text2);padding:6px 0;">
        No channels fetched. You can still search — all accessible channels will be queried.
      </div>`;
    }

    document.getElementById('slack-form').style.display          = 'none';
    document.getElementById('slack-connected-info').style.display = 'block';
    updateChatBadge();
    showToast(`Connected to ${auth.team} · ${channels.length} channels loaded`, 'success');

  } catch (e) {
    showSlackError('❌ ' + (e.message || 'Unknown error. Check your token and try again.'));
    showToast('Slack connection failed', 'error');
  }

  btn.textContent = 'Connect & Fetch Channels';
  btn.disabled    = false;
}

function selectAllChannels(checked) {
  document.querySelectorAll('#slack-channel-list input[type="checkbox"]')
    .forEach(cb => cb.checked = checked);
}

function getSelectedChannelIds() {
  return Array.from(
    document.querySelectorAll('#slack-channel-list input[type="checkbox"]:checked')
  ).map(cb => cb.dataset.chId).filter(Boolean);
}

function disconnectSlack() {
  state.slackToken      = '';
  state.slackConnected  = false;
  state.slackChannelIds = [];
  sessionStorage.removeItem('kf_slack');
  sessionStorage.removeItem('kf_slack_ch_ids');

  document.getElementById('slack-form').style.display          = 'block';
  document.getElementById('slack-connected-info').style.display = 'none';
  document.getElementById('slack-card').classList.remove('connected');
  document.querySelector('#slack-status-indicator .dot').className = 'dot dot-gray';
  document.getElementById('slack-status-text').textContent = 'Not connected';
  document.getElementById('ss-slack').textContent          = 'Not set';
  document.getElementById('slack-bot-token').value         = '';
  document.getElementById('slack-bot-token-b').value       = '';
  hideSlackError();
  updateChatBadge();
  showToast('Slack disconnected', '');
}

// =============================================
//  NOTION
// =============================================
async function connectNotion() {
  const token = document.getElementById('notion-token').value.trim();
  if (!token) { showToast('Enter your Notion Integration Token', 'error'); return; }

  showToast('Testing Notion connection...', '');

  try {
    const notionTarget = encodeURIComponent('https://api.notion.com/v1/search');
    let data = null, fetchErr = null;

    for (const proxy of CORS_PROXIES) {
      try {
        const res = await fetch(proxy + notionTarget, {
          method: 'POST',
          headers: {
            'Authorization':   'Bearer ' + token,
            'Notion-Version':  '2022-06-28',
            'Content-Type':    'application/json',
          },
          body: JSON.stringify({ query: '', page_size: 5 }),
        });
        if (res.ok) { data = await res.json(); break; }
      } catch (e) { fetchErr = e; }
    }

    if (!data) throw fetchErr || new Error('All proxies failed');

    state.notionToken     = token;
    state.notionConnected = true;
    sessionStorage.setItem('kf_notion', token);

    document.getElementById('notion-form').style.display           = 'none';
    document.getElementById('notion-connected-info').style.display = 'block';
    document.getElementById('notion-card').classList.add('connected');
    document.querySelector('#notion-status-indicator .dot').className = 'dot dot-green';
    document.getElementById('notion-status-text').textContent = `${data.results?.length || 0} pages found`;
    document.getElementById('ss-notion').textContent          = '✓ Active';

    // Show page list
    const pageList = document.getElementById('notion-page-list');
    const pages    = (data.results || []).slice(0, 6);
    pageList.innerHTML = pages.length > 0
      ? pages.map(p => {
          const title =
            p.properties?.title?.title?.[0]?.plain_text ||
            p.properties?.Name?.title?.[0]?.plain_text  ||
            p.title?.[0]?.plain_text                     ||
            'Untitled';
          return `<div class="resource-item"><input type="checkbox" checked/> <span class="ri-name">◻️ ${title}</span></div>`;
        }).join('')
      : '<div style="font-size:13px;color:var(--text3);padding:6px 0;">No pages found. Make sure you shared pages with your integration.</div>';

    updateChatBadge();
    showToast('Notion connected!', 'success');

  } catch (e) {
    // Notion blocks direct browser requests with CORS
    if (
      e.message.includes('Failed to fetch') ||
      e.message.includes('CORS') ||
      e.message.includes('NetworkError')
    ) {
      state.notionToken     = token;
      state.notionConnected = true;
      sessionStorage.setItem('kf_notion', token);

      document.getElementById('notion-form').style.display           = 'none';
      document.getElementById('notion-connected-info').style.display = 'block';
      document.getElementById('notion-card').classList.add('connected');
      document.querySelector('#notion-status-indicator .dot').className = 'dot dot-amber';
      document.getElementById('notion-status-text').textContent = 'Token saved (CORS mode)';
      document.getElementById('ss-notion').textContent          = '⚠ CORS limited';
      document.getElementById('notion-page-list').innerHTML = `
        <div style="font-size:13px;color:var(--text2);padding:6px 0;">
          Notion blocks direct browser requests. When querying, we'll include your workspace context
          in the AI prompt — paste relevant Notion content manually or use the Notion API server-side
          for full access.
        </div>`;

      updateChatBadge();
      showToast('Notion token saved (see CORS note)', 'success');
    } else {
      showToast('Notion error: ' + e.message, 'error');
    }
  }
}

function disconnectNotion() {
  state.notionToken     = '';
  state.notionConnected = false;
  sessionStorage.removeItem('kf_notion');

  document.getElementById('notion-form').style.display           = 'block';
  document.getElementById('notion-connected-info').style.display = 'none';
  document.getElementById('notion-card').classList.remove('connected');
  document.querySelector('#notion-status-indicator .dot').className = 'dot dot-gray';
  document.getElementById('notion-status-text').textContent = 'Not connected';
  document.getElementById('ss-notion').textContent          = 'Not set';
  updateChatBadge();
  showToast('Notion disconnected', '');
}

// =============================================
//  SCOPE TOGGLES
// =============================================
function toggleScope(platform) {
  if (platform === 'slack') {
    state.searchSlack = !state.searchSlack;
    const btn = document.getElementById('toggle-slack');
    btn.classList.toggle('slack-active', state.searchSlack);
  } else {
    state.searchNotion = !state.searchNotion;
    const btn = document.getElementById('toggle-notion');
    btn.classList.toggle('notion-active', state.searchNotion);
  }
}

// =============================================
//  SEND QUERY
// =============================================
async function sendQuery() {
  const input = document.getElementById('queryInput');
  const query = input.value.trim();
  if (!query) return;
  input.value = '';

  addMessage('user', query, null);
  state.queryCount++;
  updateMetrics();

  const btn       = document.getElementById('sendBtn');
  btn.disabled    = true;
  const typingId  = addTyping();

  const hasKey = state.claudeKey.startsWith('sk-');

  if (!hasKey) {
    removeTyping(typingId);
    addMessage('bot', '⚠️ **No Anthropic API key set.** Go to the Integrations tab and add your Claude API key to get real AI answers.', null);
    btn.disabled = false;
    return;
  }

  try {
    let slackResults  = [];
    let notionResults = [];

    if (state.slackConnected && state.searchSlack && state.slackToken) {
      try { slackResults = await searchSlack(query); }
      catch (e) { console.warn('Slack search failed:', e); }
    }

    if (state.notionConnected && state.searchNotion && state.notionToken) {
      try { notionResults = await searchNotion(query); }
      catch (e) { console.warn('Notion search failed:', e); }
    }

    if (slackResults.length  > 0) state.slackHits++;
    if (notionResults.length > 0) state.notionHits++;

    const answer = await synthesizeWithClaude(query, slackResults, notionResults);
    state.aiAnswers++;
    removeTyping(typingId);

    const sources = [];
    if (slackResults.length  > 0) sources.push({ type: 'slack',  label: `Slack (${slackResults.length} msgs)` });
    if (notionResults.length > 0) sources.push({ type: 'notion', label: `Notion (${notionResults.length} pages)` });

    addMessage('bot', answer, sources);

  } catch (e) {
    removeTyping(typingId);
    addMessage('bot', `⚠️ **Error:** ${e.message}`, null);
  }

  btn.disabled = false;
  updateMetrics();
}

// =============================================
//  SLACK SEARCH
// =============================================
async function searchSlack(query) {
  const results     = [];
  const selectedIds = getSelectedChannelIds();

  let searchQuery = query;
  if (selectedIds.length > 0 && selectedIds.length < 20) {
    const chNames = Array.from(
      document.querySelectorAll('#slack-channel-list input[type="checkbox"]:checked')
    ).map(cb => cb.dataset.chName).filter(Boolean);
    if (chNames.length > 0 && chNames.length <= 5) {
      searchQuery = query + ' ' + chNames.map(n => `in:${n}`).join(' ');
    }
  }

  const data = await slackAPI(
    'search.messages',
    { query: searchQuery, count: '10', sort: 'score' },
    state.slackToken
  );

  if (!data.ok) {
    if (data.error === 'missing_scope') {
      throw new Error('search:read scope missing — use a User token (xoxp-) not a Bot token for message search.');
    }
    throw new Error('Slack search error: ' + data.error);
  }

  for (const match of (data.messages?.matches || []).slice(0, 8)) {
    results.push({
      text:      match.text,
      channel:   match.channel?.name || 'unknown',
      user:      match.username || match.user || 'unknown',
      ts:        new Date(parseFloat(match.ts) * 1000).toLocaleDateString(),
      permalink: match.permalink,
    });
  }
  return results;
}

// =============================================
//  NOTION SEARCH
// =============================================
async function searchNotion(query) {
  const results      = [];
  const notionTarget = encodeURIComponent('https://api.notion.com/v1/search');

  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + notionTarget, {
        method: 'POST',
        headers: {
          'Authorization':  'Bearer ' + state.notionToken,
          'Notion-Version': '2022-06-28',
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({ query, page_size: 5 }),
      });
      if (!res.ok) continue;
      const data = await res.json();

      if (data.results) {
        for (const page of data.results.slice(0, 5)) {
          const title =
            page.properties?.title?.title?.[0]?.plain_text ||
            page.properties?.Name?.title?.[0]?.plain_text  ||
            page.title?.[0]?.plain_text                     ||
            'Untitled';
          results.push({
            title,
            url:         page.url,
            last_edited: page.last_edited_time?.slice(0, 10),
            type:        page.object,
          });
        }
      }
      break;
    } catch (e) {
      console.warn('Notion proxy attempt failed:', e);
    }
  }
  return results;
}

// =============================================
//  CLAUDE SYNTHESIS
// =============================================
async function synthesizeWithClaude(query, slackResults, notionResults) {
  const contextParts = [];

  if (slackResults.length > 0) {
    const slackCtx = slackResults.map(r =>
      `[Slack #${r.channel} | ${r.user} | ${r.ts}]: ${r.text}`
    ).join('\n');
    contextParts.push(`=== SLACK RESULTS ===\n${slackCtx}`);
  }

  if (notionResults.length > 0) {
    const notionCtx = notionResults.map(r =>
      `[Notion page: "${r.title}" | Last edited: ${r.last_edited || 'unknown'} | URL: ${r.url}]`
    ).join('\n');
    contextParts.push(`=== NOTION RESULTS ===\n${notionCtx}`);
  }

  const hasContext = contextParts.length > 0;
  const context    = contextParts.join('\n\n');

  const systemPrompt = hasContext
    ? `You are KnowFlow AI, a knowledge retrieval assistant. You have searched the user's Slack and/or Notion workspace and retrieved the following results. Synthesize a clear, helpful answer based ONLY on the retrieved content. Use **bold** for key terms. Cite sources naturally (e.g., "In the #engineering Slack channel..." or "According to the Notion page 'Onboarding Guide'..."). If results don't fully answer the question, say so and describe what was found.\n\nRETRIEVED CONTENT:\n${context}`
    : `You are KnowFlow AI. No connected platforms returned results for this query (either no platforms are connected, or no matching content was found). Let the user know what happened and suggest: 1) checking integrations in the Integrations tab, 2) rephrasing their query, or 3) ensuring their Slack bot has access to the relevant channels. Keep it brief and helpful. Use **bold** for key terms.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       state.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: query }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// =============================================
//  CHAT UI HELPERS
// =============================================
function addMessage(role, text, sources) {
  const win = document.getElementById('chatWindow');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;

  const av = document.createElement('div');
  av.className  = 'avatar';
  av.textContent = role === 'bot' ? '🤖' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Render simple markdown
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  bubble.innerHTML = `<p>${formatted}</p>`;

  if (sources && sources.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'source-tags';
    tags.innerHTML = sources.map(s =>
      `<span class="source-tag ${s.type}">📎 ${s.label}</span>`
    ).join('');
    bubble.appendChild(tags);
  }

  msg.appendChild(av);
  msg.appendChild(bubble);
  win.appendChild(msg);
  win.scrollTop = win.scrollHeight;
}

function addTyping() {
  const win = document.getElementById('chatWindow');
  const id  = 'typing-' + Date.now();
  const msg = document.createElement('div');
  msg.className = 'chat-msg bot';
  msg.id        = id;
  msg.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  win.appendChild(msg);
  win.scrollTop = win.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// =============================================
//  TOAST
// =============================================
function showToast(msg, type) {
  const t       = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// =============================================
//  METRICS & CHART
// =============================================
function updateMetrics() {
  document.getElementById('m-queries').textContent = state.queryCount;
  document.getElementById('m-slack').textContent   = state.slackHits;
  document.getElementById('m-notion').textContent  = state.notionHits;
  document.getElementById('m-ai').textContent      = state.aiAnswers;
}

function drawChart() {
  const canvas = document.getElementById('queryChart');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const data   = [4, 11, 8, 17, 22, 13, Math.max(state.queryCount, 1)];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const max    = Math.max(...data) + 4;
  const W      = canvas.width  = canvas.offsetWidth || 600;
  const H      = canvas.height = 180;

  ctx.clearRect(0, 0, W, H);

  const pad  = { l: 36, r: 16, t: 16, b: 28 };
  const cW   = W - pad.l - pad.r;
  const cH   = H - pad.t  - pad.b;
  const step = cW / data.length;
  const bW   = step * 0.45;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
  }

  // Bars
  data.forEach((v, i) => {
    const x  = pad.l + step * i + step / 2 - bW / 2;
    const bH = (v / max) * cH;
    const y  = pad.t + cH - bH;

    ctx.fillStyle = i === data.length - 1 ? '#7c6ef5' : 'rgba(124,110,245,0.35)';
    ctx.beginPath();
    ctx.roundRect(x, y, bW, bH, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle  = 'rgba(255,255,255,0.3)';
    ctx.font       = '11px DM Sans, sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(labels[i], x + bW / 2, H - 6);
  });
}

// =============================================
//  PARTICLES
// =============================================
function initParticles() {
  const cv = document.getElementById('bg');
  const cx = cv.getContext('2d');

  function resize() {
    cv.width  = innerWidth;
    cv.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);

  const pts = Array.from({ length: 60 }, () => ({
    x:  Math.random() * innerWidth,
    y:  Math.random() * innerHeight,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    r:  Math.random() * 1.5 + 0.3,
  }));

  function frame() {
    cx.clearRect(0, 0, cv.width, cv.height);

    for (const p of pts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > cv.width)  p.vx *= -1;
      if (p.y < 0 || p.y > cv.height) p.vy *= -1;
      cx.beginPath();
      cx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(124,110,245,0.5)';
      cx.fill();
    }

    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const dx = pts[a].x - pts[b].x;
        const dy = pts[a].y - pts[b].y;
        const d  = dx * dx + dy * dy;
        if (d < 8000) {
          cx.beginPath();
          cx.strokeStyle = `rgba(124,110,245,${0.05 * (1 - d / 8000)})`;
          cx.moveTo(pts[a].x, pts[a].y);
          cx.lineTo(pts[b].x, pts[b].y);
          cx.stroke();
        }
      }
    }

    requestAnimationFrame(frame);
  }

  frame();
}