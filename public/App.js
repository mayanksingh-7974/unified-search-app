// =============================================
//  KnowFlow AI — app.js
//  TripleIT Titans · IIIT Una
// =============================================

const API_BASE = 'http://localhost:8000'; // Change to deployed URL in production

let queryCount = 0;

// ---- SECTION SWITCHING ----
// function showSection(name) {
//   document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
//   const target = document.getElementById(`section-${name}`);
//   if (target) target.classList.remove('hidden');

//   document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
//   const activeNav = document.querySelector(`.sidebar-nav li[onclick*="${name}"]`);
//   if (activeNav) activeNav.classList.add('active');

//   const app = document.getElementById('app');
//   app.scrollIntoView({ behavior: 'smooth' });

//   if (name === 'analytics') drawChart();
// }
function showSection(section) {
  document.getElementById("home").style.display = "none";
  document.getElementById("app").style.display = "flex";

  const sections = document.querySelectorAll(".panel");
  sections.forEach(sec => sec.classList.add("hidden"));

  document.getElementById("section-" + section).classList.remove("hidden");
}

// ---- FILL QUERY FROM SUGGESTION ----
function fillQuery(text) {
  showSection('chat');
  const input = document.getElementById('queryInput');
  input.value = text;
  input.focus();
}

// ---- SEND QUERY ----
async function sendQuery() {
  const input = document.getElementById('queryInput');
  const query = input.value.trim();
  if (!query) return;

  input.value = '';
  addMessage('user', query, null);

  const typingId = addTypingIndicator();
  queryCount++;
  updateMetric();

  try {
    const res = await fetch(`${API_BASE}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, session_id: getSessionId() })
    });

    removeTypingIndicator(typingId);

    if (res.ok) {
      const data = await res.json();
      addMessage('bot', data.answer, data.sources || []);
    } else {
      // Fallback demo response if backend isn't running
      demoResponse(query);
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    demoResponse(query);
  }
}

// ---- DEMO RESPONSE (when backend offline) ----
function demoResponse(query) {
  const lq = query.toLowerCase();
  let answer = '';
  let sources = [];

  if (lq.includes('api') || lq.includes('rate limit')) {
    answer = `Based on our API documentation, the rate limit for v2 is **1,000 requests/hour** for standard plans and **10,000 requests/hour** for enterprise plans. Burst limits allow up to 100 simultaneous connections. You can monitor usage in the developer dashboard.`;
    sources = ['docs/api-reference.md', 'Slack #dev-general (Mar 12)'];
  } else if (lq.includes('refund') || lq.includes('policy')) {
    answer = `Our refund policy allows full refunds within **30 days** of purchase for unused licenses. Pro-rated refunds are available for annual plans canceled after 30 days. Contact billing@company.com to initiate a refund request.`;
    sources = ['HR/policies/refund-policy.pdf', 'Notion: Customer Policies'];
  } else if (lq.includes('onboard') || lq.includes('engineer')) {
    answer = `To onboard a new engineer:\n\n1. Create accounts in Jira, GitHub, Slack, and AWS\n2. Share the Engineering Handbook (Drive: /Engineering/Onboarding)\n3. Assign a buddy from the team\n4. Schedule intro calls with product and design\n5. First week: complete the dev environment setup guide\n\nExpected setup time: 1–2 days.`;
    sources = ['Engineering Handbook v3.pdf', 'Notion: Onboarding Checklist'];
  } else if (lq.includes('q3') || lq.includes('revenue') || lq.includes('report')) {
    answer = `The Q3 2024 Revenue Report shows **$4.2M ARR** (up 28% QoQ). Key highlights: SaaS products drove 72% of revenue, enterprise deals grew 45%, and churn dropped to 2.1%. Full report available in Drive: /Finance/Q3-2024-Report.pdf`;
    sources = ['Finance/Q3-2024-Report.pdf', 'Slack #finance-updates'];
  } else {
    answer = `I searched across your connected knowledge sources — Google Drive, Slack, and our document library — but couldn't find a precise match for **"${query}"**. Try rephrasing or connect additional sources like Notion or SharePoint for broader coverage.`;
    sources = [];
  }

  addMessage('bot', answer, sources);
}

// ---- ADD MESSAGE TO CHAT ----
function addMessage(role, text, sources) {
  const window = document.getElementById('chatWindow');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'bot' ? '🤖' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Render basic markdown: **bold**, line breaks
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
  bubble.innerHTML = `<p>${formatted}</p>`;

  if (sources && sources.length > 0) {
    const srcDiv = document.createElement('div');
    srcDiv.className = 'sources-list';
    srcDiv.innerHTML = `<strong>Sources:</strong> ` +
      sources.map(s => `<span class="source-ref">📎 ${s}</span>`).join('');
    bubble.appendChild(srcDiv);
  }

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  window.appendChild(msg);
  window.scrollTop = window.scrollHeight;
}

// ---- TYPING INDICATOR ----
function addTypingIndicator() {
  const window = document.getElementById('chatWindow');
  const id = 'typing-' + Date.now();
  const msg = document.createElement('div');
  msg.className = 'chat-msg bot';
  msg.id = id;
  msg.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble">
      <div class="typing"><span></span><span></span><span></span></div>
    </div>`;
  window.appendChild(msg);
  window.scrollTop = window.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ---- FILE UPLOAD ----
function handleFiles(files) {
  Array.from(files).forEach(file => {
    uploadFile(file);
  });
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
}

async function uploadFile(file) {
  const list = document.getElementById('uploadedList');
  const status = document.getElementById('uploadStatus');

  const item = document.createElement('div');
  item.className = 'uploaded-item';
  item.innerHTML = `<span>📄</span><span>${file.name}</span><span style="margin-left:auto;color:var(--text3)">Uploading...</span>`;
  list.appendChild(item);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', 'manual-upload');

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      item.querySelector('span:last-child').textContent = `✅ Indexed (${data.chunks} chunks)`;
      item.querySelector('span:last-child').style.color = 'var(--accent3)';
    } else {
      throw new Error('Upload failed');
    }
  } catch {
    // Demo mode
    setTimeout(() => {
      const chunks = Math.floor(Math.random() * 20) + 5;
      item.querySelector('span:last-child').textContent = `✅ Demo: ${chunks} chunks indexed`;
      item.querySelector('span:last-child').style.color = 'var(--accent3)';
      status.textContent = `✅ ${file.name} indexed successfully. Ask questions about it in Chat!`;
    }, 1500);
  }
}

// ---- CONNECT SOURCE ----
function connectSource(name) {
  alert(`Connecting to ${name}...\n\nIn production, this opens an OAuth flow to authorize KnowFlow AI to read your ${name} workspace.\n\nFor the hackathon demo, integration is pre-configured.`);
}

// ---- ANALYTICS CHART ----
function drawChart() {
  const canvas = document.getElementById('queryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const data = [12, 19, 8, 24, 31, 18, queryCount + 5];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const max = Math.max(...data) + 5;

  const W = canvas.width = canvas.offsetWidth || 600;
  const H = 200;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const pad = { left: 40, right: 20, top: 20, bottom: 30 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = (chartW / data.length) * 0.5;
  const step = chartW / data.length;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  // Bars
  data.forEach((val, i) => {
    const x = pad.left + step * i + step / 2 - barW / 2;
    const barH = (val / max) * chartH;
    const y = pad.top + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#00d4ff');
    grad.addColorStop(1, 'rgba(0,212,255,0.1)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, H - 8);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(val, x + barW / 2, y - 6);
  });
}

// ---- METRIC UPDATE ----
function updateMetric() {
  const el = document.getElementById('totalQueries');
  if (el) el.textContent = queryCount;
}

// ---- SESSION ID ----
function getSessionId() {
  let sid = sessionStorage.getItem('knowflow_session');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('knowflow_session', sid);
  }
  return sid;
}

// ---- INIT ----
window.addEventListener('load', () => {
  // Scroll to app section if hash present
  if (location.hash === '#chat') showSection('chat');

  // Resize chart on window resize
  window.addEventListener('resize', () => {
    if (!document.getElementById('section-analytics').classList.contains('hidden')) {
      drawChart();
    }
  });
});


// 

// 🔥 PARTICLE BACKGROUND CODE START

const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.size = Math.random() * 2 + 1;
  }

  move() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = "#00d4ff";
    ctx.fill();
  }
}

for (let i = 0; i < 100; i++) {
  particles.push(new Particle());
}

function connect() {
  for (let a = 0; a < particles.length; a++) {
    for (let b = a; b < particles.length; b++) {
      let dx = particles[a].x - particles[b].x;
      let dy = particles[a].y - particles[b].y;
      let dist = dx * dx + dy * dy;

      if (dist < 12000) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0,212,255,0.08)";
        ctx.moveTo(particles[a].x, particles[a].y);
        ctx.lineTo(particles[b].x, particles[b].y);
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.move();
    p.draw();
  });

  connect();

  requestAnimationFrame(animateParticles);
}

animateParticles();

// 🔥 PARTICLE BACKGROUND CODE END
// 


// 🔥 INTERACTIVE 3D CUBES

const cubes = document.querySelectorAll(".cube");

document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 40;
  const y = (e.clientY / window.innerHeight - 0.5) * 40;

  cubes.forEach(cube => {
    cube.style.transform = `rotateX(${-y}deg) rotateY(${x}deg)`;
  });
});

// hover effect (extra control)
cubes.forEach(cube => {
  cube.addEventListener("mouseenter", () => {
    cube.style.transition = "transform 0.1s";
  });

  cube.addEventListener("mouseleave", () => {
    cube.style.transition = "transform 0.5s";
  });
});

// 

// 
// 🔥 MOUSE INTERACTION FOR CUBES

const cube = document.querySelectorAll(".cube");

document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 30;

  cubes.forEach(cube => {
    cube.style.transform = `rotateX(${-y}deg) rotateY(${x}deg)`;
  });
});
