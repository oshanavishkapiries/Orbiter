export function getViewerHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Orbiter – LLM Chat Viewer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--surface:#161b22;--surface2:#21262d;--surface3:#30363d;
  --border:#30363d;--text:#e6edf3;--text2:#8b949e;--text3:#6e7681;
  --blue:#58a6ff;--green:#3fb950;--orange:#d29922;--red:#f85149;
  --purple:#bc8cff;--cyan:#39d353;--teal:#56d364;
  --tool-bg:#1a2a1a;--user-bg:#1a2233;--sys-bg:#1e1a2e;
  --radius:8px;--font:ui-monospace,"Cascadia Code","Fira Code",monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:13px;display:flex;height:100vh;overflow:hidden}
a{color:var(--blue);text-decoration:none}

/* ── Sidebar ── */
#sidebar{width:280px;min-width:280px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
#sidebar-header{padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
#sidebar-header h1{font-size:14px;font-weight:600;color:var(--text)}
.logo{font-size:20px}
#search{flex:1;padding:8px 12px;border-bottom:1px solid var(--border)}
#search input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;font-family:var(--font);outline:none}
#search input:focus{border-color:var(--blue)}
#session-list{flex:1;overflow-y:auto;padding:8px}
.session-card{padding:10px 12px;border-radius:var(--radius);cursor:pointer;border:1px solid transparent;margin-bottom:4px;transition:all .15s}
.session-card:hover{background:var(--surface2);border-color:var(--border)}
.session-card.active{background:var(--surface2);border-color:var(--blue)}
.sc-goal{font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
.sc-meta{font-size:11px;color:var(--text3);display:flex;gap:8px;align-items:center}
.badge{padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600}
.badge-ok{background:#1a3a1a;color:var(--green)}
.badge-fail{background:#3a1a1a;color:var(--red)}
.badge-run{background:#1a2a3a;color:var(--blue)}
#sidebar-footer{padding:10px 12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)}
#no-sessions{padding:32px 16px;text-align:center;color:var(--text3);font-size:12px}

/* ── Main panel ── */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#toolbar{padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:16px;min-height:48px}
#toolbar h2{font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.tb-stat{font-size:11px;color:var(--text3);white-space:nowrap}
.tb-stat span{color:var(--text2)}
#reload-btn{padding:4px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);cursor:pointer;font-size:12px;font-family:var(--font)}
#reload-btn:hover{border-color:var(--blue);color:var(--blue)}

#chat-area{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:0}
#empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);gap:12px}
#empty-state .big{font-size:48px}
#empty-state p{font-size:13px}

/* ── Chat turns ── */
.turn{margin-bottom:20px}
.turn-header{display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--blue)}
.turn-num{font-size:11px;font-weight:700;color:var(--blue)}
.turn-ts{font-size:11px;color:var(--text3);flex:1}
.turn-badges{display:flex;gap:6px}
.pill{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.pill-tokens{background:#0d2a3a;color:#58a6ff}
.pill-dur{background:#1a2a1a;color:#3fb950}
.pill-stop{background:#1a2a1a;color:#3fb950}
.pill-tool{background:#2a1a3a;color:#bc8cff}
.pill-len{background:#2a1a1a;color:#d29922}
.pill-err{background:#3a1a1a;color:#f85149}

/* ── Messages ── */
.msg{margin-bottom:8px;border-radius:var(--radius);overflow:hidden}

/* System prompt */
.msg-system{border:1px solid #2a1a4a}
.msg-system .msg-label{background:#1e1328;color:#bc8cff;padding:5px 12px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}
.msg-system .msg-body{background:var(--sys-bg);padding:12px;font-size:12px;color:var(--text2);white-space:pre-wrap;line-height:1.6;max-height:200px;overflow-y:auto;display:none}
.msg-system.expanded .msg-body{display:block}

/* User trigger */
.msg-user{border:1px solid #1a2a4a}
.msg-user .msg-label{background:#0d1a2e;color:var(--blue);padding:5px 12px;font-size:11px;font-weight:600}
.msg-user .msg-body{background:var(--user-bg);padding:12px;font-size:12px;color:var(--text);white-space:pre-wrap;word-break:break-word;line-height:1.6}

/* Assistant text */
.msg-assistant{border:1px solid var(--border)}
.msg-assistant .msg-label{background:var(--surface2);color:var(--text2);padding:5px 12px;font-size:11px;font-weight:600}
.msg-assistant .msg-body{background:var(--surface);padding:12px;font-size:12px;color:var(--text);white-space:pre-wrap;word-break:break-word;line-height:1.6}

/* Tool calls */
.tool-calls{display:flex;flex-direction:column;gap:6px}
.tool-call{border:1px solid #2a2a1a;border-radius:var(--radius);overflow:hidden}
.tc-header{background:#1e1e0d;padding:6px 12px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
.tc-name{font-size:12px;font-weight:700;color:var(--orange)}
.tc-arrow{font-size:10px;color:var(--text3);transition:transform .15s;margin-left:auto}
.tool-call.expanded .tc-arrow{transform:rotate(90deg)}
.tc-body{background:#121208;padding:10px 12px;display:none;overflow-x:auto}
.tool-call.expanded .tc-body{display:block}
.tc-body pre{font-size:11px;color:#d29922;line-height:1.5}

/* vision image in message */
.msg-image{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:8px}
.msg-image .msg-label{background:var(--surface2);color:var(--text2);padding:5px 12px;font-size:11px;font-weight:600}
.msg-image img{display:block;max-width:100%;max-height:300px;object-fit:contain;background:#000}

/* ── Scrollbars ── */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:3px}

/* ── Loading ── */
#loading{position:fixed;inset:0;background:rgba(13,17,23,.85);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text2);z-index:100;display:none}
#loading.active{display:flex}
.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;margin-right:10px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div id="loading"><div class="spinner"></div>Loading...</div>

<!-- ── Sidebar ── -->
<aside id="sidebar">
  <div id="sidebar-header">
    <span class="logo">🛸</span>
    <h1>Orbiter Viewer</h1>
  </div>
  <div id="search"><input id="search-input" placeholder="Filter sessions…" autocomplete="off"/></div>
  <div id="session-list"><div id="no-sessions">Loading sessions…</div></div>
  <div id="sidebar-footer" id="sf">0 sessions</div>
</aside>

<!-- ── Main Panel ── -->
<main id="main">
  <div id="toolbar">
    <h2 id="toolbar-goal">Select a session</h2>
    <span class="tb-stat" id="tb-calls"></span>
    <span class="tb-stat" id="tb-tokens"></span>
    <span class="tb-stat" id="tb-dur"></span>
    <button id="reload-btn" onclick="reloadSessions()">↻ Refresh</button>
  </div>
  <div id="chat-area">
    <div id="empty-state">
      <div class="big">🛸</div>
      <p>Select a session from the sidebar to view the LLM conversation</p>
    </div>
  </div>
</main>

<script>
const API = '';
let allSessions = [];
let currentSessionId = null;

// ── Utilities ──────────────────────────────────────────────

function fmt(ts) {
  return new Date(ts).toLocaleString();
}
function fmtDur(ms) {
  return ms >= 1000 ? (ms/1000).toFixed(1)+'s' : ms+'ms';
}
function fmtTokens(n) {
  return n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function loading(on) {
  document.getElementById('loading').classList.toggle('active', on);
}

// ── Sessions ───────────────────────────────────────────────

async function reloadSessions() {
  try {
    const r = await fetch(API+'/api/sessions');
    allSessions = await r.json();
  } catch(e) {
    allSessions = [];
  }
  renderSidebar();
}

function renderSidebar(filter='') {
  const list = document.getElementById('session-list');
  const footer = document.getElementById('sidebar-footer');
  const f = filter.toLowerCase();
  const filtered = allSessions.filter(s => s.goal.toLowerCase().includes(f));

  if (!filtered.length) {
    list.innerHTML = '<div id="no-sessions">No sessions found</div>';
    footer.textContent = '0 sessions';
    return;
  }

  footer.textContent = filtered.length + ' session' + (filtered.length===1?'':'s');

  list.innerHTML = filtered.map(s => {
    const badge = s.status === 'completed'
      ? '<span class="badge badge-ok">✓ done</span>'
      : s.status === 'failed'
        ? '<span class="badge badge-fail">✗ failed</span>'
        : '<span class="badge badge-run">● running</span>';
    const dt = new Date(s.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const active = s.id === currentSessionId ? ' active' : '';
    return \`<div class="session-card\${active}" onclick="loadSession('\${s.id}',\${JSON.stringify(escHtml(s.goal))})">
      <div class="sc-goal" title="\${escHtml(s.goal)}">\${escHtml(s.goal)}</div>
      <div class="sc-meta">\${badge}<span>\${dt}</span><span style="color:var(--text3)">\${s.model||''}</span></div>
    </div>\`;
  }).join('');
}

document.getElementById('search-input').addEventListener('input', e => {
  renderSidebar(e.target.value);
});

// ── Load Session ───────────────────────────────────────────

async function loadSession(sessionId, goal) {
  currentSessionId = sessionId;
  // Re-render sidebar to show active state
  renderSidebar(document.getElementById('search-input').value);

  document.getElementById('toolbar-goal').textContent = goal || 'Session';
  document.getElementById('tb-calls').innerHTML = '';
  document.getElementById('tb-tokens').innerHTML = '';
  document.getElementById('tb-dur').innerHTML = '';

  loading(true);
  let interactions = [];
  try {
    const r = await fetch(API+'/api/interactions/'+sessionId);
    interactions = await r.json();
  } catch(e) {
    interactions = [];
  }
  loading(false);

  renderChat(interactions);
}

// ── Render Chat ────────────────────────────────────────────

function renderChat(interactions) {
  const area = document.getElementById('chat-area');

  if (!interactions.length) {
    area.innerHTML = \`<div id="empty-state">
      <div class="big">📭</div>
      <p>No LLM interactions recorded for this session yet.</p>
    </div>\`;
    return;
  }

  // Compute totals for toolbar
  const totalTokens = interactions.reduce((a,i)=>a+(i.totalTokens||0),0);
  const totalDur = interactions.reduce((a,i)=>a+(i.durationMs||0),0);
  document.getElementById('tb-calls').innerHTML = \`Calls: <span>\${interactions.length}</span>\`;
  document.getElementById('tb-tokens').innerHTML = \`Tokens: <span>\${fmtTokens(totalTokens)}</span>\`;
  document.getElementById('tb-dur').innerHTML = \`Total: <span>\${fmtDur(totalDur)}</span>\`;

  const turns = interactions.map((intr, idx) => renderTurn(intr, idx === 0)).join('');
  area.innerHTML = turns;
}

function renderTurn(intr, isFirst) {
  const msgs = intr.fullMessages || [];
  const systemMsg = msgs.find(m => m.role === 'system');
  const triggerMsg = [...msgs].reverse().find(m => m.role === 'user');

  const finishClass =
    intr.finishReason === 'stop' ? 'pill-stop' :
    intr.finishReason === 'tool_calls' ? 'pill-tool' :
    intr.finishReason === 'length' ? 'pill-len' : 'pill-err';

  const finishLabel =
    intr.finishReason === 'tool_calls' ? '🔧 tool_calls' :
    intr.finishReason === 'stop' ? '✓ stop' : (intr.finishReason || '?');

  let html = \`<div class="turn">
    <div class="turn-header">
      <span class="turn-num">Call #\${intr.callIndex}</span>
      <span class="turn-ts">\${fmt(intr.timestamp)}</span>
      <div class="turn-badges">
        <span class="pill pill-tokens">↑\${fmtTokens(intr.promptTokens)} ↓\${fmtTokens(intr.completionTokens)}</span>
        <span class="pill pill-dur">\${fmtDur(intr.durationMs)}</span>
        <span class="pill \${finishClass}">\${finishLabel}</span>
      </div>
    </div>\`;

  // System prompt (shown collapsed on first turn only)
  if (isFirst && systemMsg) {
    html += renderSystemMsg(systemMsg);
  }

  // User trigger message
  if (triggerMsg) {
    html += renderUserMsg(triggerMsg, isFirst);
  }

  // Assistant response
  html += renderAssistantResponse(intr);

  html += '</div>';
  return html;
}

function renderSystemMsg(msg) {
  const id = 'sys-' + Math.random().toString(36).slice(2);
  return \`<div class="msg msg-system" id="\${id}">
    <div class="msg-label" onclick="toggleExpand('\${id}')">
      ⚙ SYSTEM PROMPT
      <span>▶ click to expand</span>
    </div>
    <div class="msg-body">\${escHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content,null,2))}</div>
  </div>\`;
}

function renderUserMsg(msg, isFirst) {
  let bodyHtml = '';
  const label = isFirst ? '👤 TASK' : '🔧 TOOL RESULT';

  if (Array.isArray(msg.content)) {
    // Vision message: text + image parts
    for (const part of msg.content) {
      if (part.type === 'text') {
        bodyHtml += \`<div class="msg msg-user">
          <div class="msg-label">\${label}</div>
          <div class="msg-body">\${escHtml(part.text)}</div>
        </div>\`;
      } else if (part.type === 'image_url') {
        const url = part.image_url?.url || '';
        if (url.startsWith('data:image')) {
          bodyHtml += \`<div class="msg-image">
            <div class="msg-label">🖼 SCREENSHOT</div>
            <img src="\${escHtml(url)}" alt="screenshot"/>
          </div>\`;
        }
      }
    }
    return bodyHtml;
  }

  const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2);
  return \`<div class="msg msg-user">
    <div class="msg-label">\${label}</div>
    <div class="msg-body">\${escHtml(text)}</div>
  </div>\`;
}

function renderAssistantResponse(intr) {
  const hasText = intr.responseContent && intr.responseContent.trim();
  const hasCalls = intr.toolCalls && intr.toolCalls.length > 0;

  let html = '';

  if (hasText) {
    html += \`<div class="msg msg-assistant">
      <div class="msg-label">🤖 ASSISTANT</div>
      <div class="msg-body">\${escHtml(intr.responseContent)}</div>
    </div>\`;
  }

  if (hasCalls) {
    html += \`<div class="msg msg-assistant">
      <div class="msg-label">🤖 TOOL CALLS (×\${intr.toolCalls.length})</div>
      <div class="msg-body" style="padding:8px">
        <div class="tool-calls">\${intr.toolCalls.map(renderToolCall).join('')}</div>
      </div>
    </div>\`;
  }

  if (!hasText && !hasCalls) {
    html += \`<div class="msg msg-assistant">
      <div class="msg-label">🤖 ASSISTANT</div>
      <div class="msg-body" style="color:var(--text3)">(no response content)</div>
    </div>\`;
  }

  return html;
}

function renderToolCall(tc) {
  const id = 'tc-' + Math.random().toString(36).slice(2);
  const prettyArgs = JSON.stringify(tc.arguments || {}, null, 2);
  return \`<div class="tool-call" id="\${id}">
    <div class="tc-header" onclick="toggleExpand('\${id}')">
      <span class="tc-name">⚡ \${escHtml(tc.name)}</span>
      <span style="font-size:11px;color:var(--text3)">\${escHtml(summarizeArgs(tc.arguments))}</span>
      <span class="tc-arrow">▶</span>
    </div>
    <div class="tc-body"><pre>\${escHtml(prettyArgs)}</pre></div>
  </div>\`;
}

function summarizeArgs(args) {
  if (!args) return '';
  const keys = Object.keys(args);
  if (!keys.length) return '';
  const first = keys[0];
  const val = String(args[first] || '').slice(0, 60);
  return first + ': ' + val + (keys.length > 1 ? ' …' : '');
}

function toggleExpand(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}

// ── Boot ────────────────────────────────────────────────────

reloadSessions();
</script>
</body>
</html>`;
}
