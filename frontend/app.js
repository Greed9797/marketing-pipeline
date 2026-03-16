const API = (localStorage.getItem('pipeline_api_url') || 'http://localhost:5050') + '/api';

// ── Estado ───────────────────────────────────────
let topicsData  = null;
let anglesData  = null;
let scriptsData = null;
let pollingTimers = {};
let _refreshing = false;

const tipoColor = {
  'contraintuitivo': 'var(--accent)',
  'dado':            'var(--accent2)',
  'lista':           'var(--accent4)',
  'historia':        'var(--accent3)',
  'história':        'var(--accent3)',
  'opiniao':         '#d080f0',
  'opinião':         '#d080f0',
};

// ── Tema ─────────────────────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('pipeline_theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isDark ? '◑ TEMA' : '◐ TEMA';
}

// ── Toast ─────────────────────────────────────────
function showToast(msg, type = 'ok') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast-out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 3500);
}

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('pipeline_theme') === 'dark') {
    document.body.classList.add('dark');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = '◑ TEMA';
  }
  refreshAll();
  setInterval(refreshAll, 30000);
});

async function refreshAll() {
  if (_refreshing) return;
  _refreshing = true;
  try {
    await Promise.all([fetchStatus(), fetchCycle(), fetchAllData()]);
  } finally {
    _refreshing = false;
  }
}

// ── Tabs ──────────────────────────────────────────
function switchTab(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
}

// ── Cycle badge ───────────────────────────────────
async function fetchCycle() {
  try {
    const d = await fetchJson(`${API}/current-cycle`);
    if (!d) return;
    // Header date: "15 / 03\n2026"
    const parts = (d.date || '').split('_'); // DD_MM_YYYY
    if (parts.length === 3) {
      document.getElementById('header-date').innerHTML = `${parts[0]} / ${parts[1]}<br>${parts[2]}`;
    }
    document.getElementById('kpi-cycle').textContent = d.date || '—';
    document.getElementById('kpi-cycle-sub').textContent = d.folder_name || '—';
    document.getElementById('footer-cycle').textContent = d.folder_name || '—';
  } catch (_) {}
}

// ── Agent status ──────────────────────────────────
async function fetchStatus() {
  const d = await fetchJson(`${API}/status`);
  if (!d) return;

  let allOk = true;
  let anyRunning = false;

  ['researcher','ideator','scripter','analyst'].forEach(name => {
    const info = d[name];
    updateAgentCard(name, info);
    if (info.status !== 'ok') allOk = false;
    if (info.is_running) anyRunning = true;
  });

  const statusEl = document.getElementById('header-status-text');
  if (anyRunning)   statusEl.textContent = 'AGENTE EXECUTANDO';
  else if (allOk)   statusEl.textContent = 'PIPELINE COMPLETO';
  else              statusEl.textContent = 'AGUARDANDO EXECUÇÃO';

  // Update pipeline steps
  ['researcher','ideator','scripter','analyst'].forEach(name => {
    const info = d[name];
    const step = document.getElementById(`pipe-${name}`);
    const state = document.getElementById(`pipe-state-${name}`);
    if (!step) return;
    step.className = 'pipeline-step';
    if (info.is_running) {
      step.classList.add('step-running');
      state.textContent = 'executando...';
    } else if (info.status === 'ok') {
      step.classList.add('step-ok');
      if (info.last_run) {
        const dt = new Date(info.last_run);
        state.textContent = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
      } else {
        state.textContent = 'completo';
      }
    } else {
      state.textContent = 'aguardando';
    }
  });

  // Update header dot
  const dot = document.getElementById('status-dot-header');
  if (dot) {
    dot.className = 'status-dot-header';
    if (anyRunning) dot.classList.add('running');
    else if (allOk) dot.classList.add('ok');
  }
}

function updateAgentCard(name, info) {
  const dot  = document.getElementById(`dot-${name}`);
  const btn  = document.getElementById(`btn-${name}`);
  const last = document.getElementById(`last-${name}`);
  if (!dot) return;

  dot.className = 'agent-status-dot ' + (
    info.is_running ? 'running' :
    info.status === 'ok' ? 'ok' : 'missing'
  );

  if (info.is_running) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Executando...';
    btn.className = 'btn btn-run running';
  } else {
    btn.disabled = false;
    btn.innerHTML = '▶ Executar';
    btn.className = 'btn btn-run';
  }

  if (info.last_run) {
    const dt = new Date(info.last_run);
    last.className = 'last-run';
    last.textContent = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  } else {
    last.textContent = 'Ainda não executado';
  }

  // Toggle is-running class on the card
  const card = document.querySelector(`#btn-${name}`)?.closest('.agent-card');
  if (card) {
    card.classList.toggle('is-running', !!info.is_running);
  }
}

// ── Run agent ─────────────────────────────────────
async function runAgent(name, metricsText = null) {
  const btn = document.getElementById(`btn-${name}`);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Executando...';
  btn.className = 'btn btn-run running';
  showTerminal(name);

  try {
    const body = metricsText ? { metrics: metricsText } : {};
    const d = await fetchJson(`${API}/run/${name}`, { method: 'POST', body: JSON.stringify(body) });
    if (!d || !d.success) {
      appendLog(`[ERRO] ${d?.error || 'Falha ao iniciar'}`, 'err');
      return;
    }
    appendLog(`Agente ${name} iniciado...`);
    appendLog(`Pasta: ${d.output_dir?.split(/[\\/]/).pop() || d.output_dir}`);
    startPolling(name);
  } catch (e) {
    appendLog(`[ERRO] Não foi possível conectar ao servidor: ${e.message}`, 'err');
    resetBtn(name);
  }
}

function resetBtn(name) {
  const btn = document.getElementById(`btn-${name}`);
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = '▶ Executar';
  btn.className = 'btn btn-run';
}

// ── Log polling ───────────────────────────────────
function startPolling(name) {
  if (pollingTimers[name]) clearInterval(pollingTimers[name]);
  let lastCount = 0;

  pollingTimers[name] = setInterval(async () => {
    const d = await fetchJson(`${API}/logs/${name}`);
    if (!d) return;

    d.logs.slice(lastCount).forEach(line => appendLog(line));
    lastCount = d.logs.length;

    if (!d.is_running) {
      clearInterval(pollingTimers[name]);
      delete pollingTimers[name];
      await Promise.all([fetchStatus(), fetchAllData()]);
      // Toast notification on completion
      const success = d.logs.some(l => l.includes('✓') || l.includes('concluído') || l.includes('salvo'));
      showToast(
        success ? `${name} concluído com sucesso` : `${name} finalizado`,
        success ? 'ok' : 'warn'
      );
    }
  }, 1500);
}

// ── Terminal ──────────────────────────────────────
function showTerminal(name) {
  document.getElementById('terminal-wrap').classList.add('visible');
  document.getElementById('terminal-title').textContent = `log — ${name}`;
}

function appendLog(line, cls = '') {
  const body = document.getElementById('terminal-body');
  const span = document.createElement('span');
  if (line.includes('✓') || line.includes('concluído')) cls = 'log-ok';
  if (line.includes('✗') || line.includes('ERRO') || line.includes('stderr')) cls = 'log-err';
  if (cls) span.className = cls;
  span.textContent = line + '\n';
  body.appendChild(span);
  body.scrollTop = body.scrollHeight;
}

function clearTerminal() {
  document.getElementById('terminal-body').innerHTML = '';
  document.getElementById('terminal-wrap').classList.remove('visible');
}

// ── Analyst modal ─────────────────────────────────
function openAnalystModal() {
  document.getElementById('modal-analyst').classList.add('open');
}
function closeAnalystModal() {
  document.getElementById('modal-analyst').classList.remove('open');
}
async function submitAnalyst() {
  const metrics = document.getElementById('analyst-metrics').value.trim();
  closeAnalystModal();
  await runAgent('analyst', metrics || null);
}

// ── Fetch all data ────────────────────────────────
async function fetchAllData() {
  await Promise.all([fetchTopics(), fetchAngulos(), fetchRoteiros()]);
}

async function fetchTopics() {
  const d = await fetchJson(`${API}/data/topics`);
  if (!d || !d.topicos) return;
  topicsData = d;
  const n = d.topicos.length;
  const alto = d.topicos.filter(t => t.confianca_do_sinal === 'alto').length;
  document.getElementById('kpi-topics').textContent = n;
  document.getElementById('kpi-topics-sub').textContent = `${alto} alto · ${n-alto} médio sinal`;
  // Update tab badge
  const badge = document.getElementById('badge-topicos');
  if (badge) badge.textContent = n;
  renderTopics('todos');
  renderSinais(d);
}

async function fetchAngulos() {
  const d = await fetchJson(`${API}/data/angles`);
  if (!d || !d.angulos) return;
  anglesData = d;
  const n = d.angulos.length;
  const alto = d.angulos.filter(a => a.potencial_estimado === 'alto').length;
  document.getElementById('kpi-angles').textContent = n;
  document.getElementById('kpi-angles-sub').textContent = `${alto} alto · ${n-alto} médio potencial`;
  // Update tab badge
  const badge = document.getElementById('badge-angulos');
  if (badge) badge.textContent = n;
  renderAngulos('all');
  renderNotas(d);
}

async function fetchRoteiros() {
  const d = await fetchJson(`${API}/data/scripts`);
  if (!d || !d.roteiros) return;
  scriptsData = d;
  const n = d.roteiros.length;
  document.getElementById('kpi-scripts').textContent = n;
  document.getElementById('kpi-scripts-sub').textContent = `Priorizados por potencial alto`;
  // Update tab badge
  const badge = document.getElementById('badge-roteiros');
  if (badge) badge.textContent = n;
  renderRoteiros('all');
}

// ── Render: Sinais (Visão Geral) ──────────────────
function renderSinais(topicsData) {
  // Gera cards de sinal a partir dos top 5 tópicos
  const grid = document.getElementById('sinais-grid');
  const section = document.getElementById('sinais-section');
  if (!topicsData.topicos?.length) return;

  const top5 = topicsData.topicos.slice(0, 4);
  // Agrupar por rede_origem
  const byRede = {};
  topicsData.topicos.forEach(t => {
    const k = t.rede_origem || 'Outros';
    if (!byRede[k]) byRede[k] = [];
    byRede[k].push(t);
  });

  grid.innerHTML = Object.entries(byRede).map(([rede, items]) => `
    <div class="sinal-card">
      <div class="sinal-fonte">${rede} · ${topicsData.data || ''}</div>
      <h3>${items.length} tópico${items.length>1?'s':''} identificado${items.length>1?'s':''}</h3>
      <ul class="sinal-list">
        ${items.slice(0,4).map(t => `
          <li><span class="highlight">#${t.rank}</span> ${esc(t.tema)} — <span style="color:var(--text-muted);font-size:11px">${esc(t.por_que_esta_em_alta)}</span></li>
        `).join('')}
        ${items.length > 4 ? `<li style="color:var(--text-muted)">+ ${items.length-4} outros</li>` : ''}
      </ul>
    </div>
  `).join('');

  document.getElementById('sinais-count').textContent = `${topicsData.topicos.length} tópicos`;
  section.style.display = 'block';
}

function renderNotas(anglesData) {
  const notasSection = document.getElementById('notas-section');
  const alto  = anglesData.angulos.filter(a => a.potencial_estimado === 'alto').length;
  const medio = anglesData.angulos.filter(a => a.potencial_estimado === 'medio').length;
  const ig    = anglesData.angulos.filter(a => a.rede_recomendada === 'Instagram').length;
  const tw    = anglesData.angulos.filter(a => a.rede_recomendada === 'Twitter/X').length;
  const carr  = anglesData.angulos.filter(a => a.formato_recomendado === 'carrossel').length;
  const thr   = anglesData.angulos.filter(a => a.formato_recomendado === 'thread').length;
  const vid   = anglesData.angulos.filter(a => a.formato_recomendado === 'video').length;

  document.getElementById('metricas-content').innerHTML = `
    <div class="metric-row">
      <span class="metric-label">Ângulos — potencial alto</span>
      <span class="metric-val green">${alto}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Ângulos — potencial médio</span>
      <span class="metric-val">${medio}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Para Instagram</span>
      <span class="metric-val">${ig}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Para Twitter/X</span>
      <span class="metric-val">${tw}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Carrossel · Thread · Vídeo</span>
      <span class="metric-val" style="font-size:14px">${carr} · ${thr} · ${vid}</span>
    </div>
  `;

  document.getElementById('notas-content').innerHTML = `
    <div class="nota-item">
      <span class="nota-icon">📅</span>
      <span>Ciclo gerado em ${anglesData.data || '—'}</span>
    </div>
    <div class="nota-item">
      <span class="nota-icon">⚡</span>
      <span>Execute o Analyst toda segunda-feira com as métricas do perfil <strong>@leonardo_ames</strong></span>
    </div>
    <div class="nota-item">
      <span class="nota-icon">💡</span>
      <span>Twitter/X Brazil trends retornando zero resultados relevantes ao nicho — RAG web browser entregou os sinais mais qualificados</span>
    </div>
  `;

  notasSection.style.display = 'block';
}

// ── Render: Topics table ──────────────────────────
function renderTopics(filter) {
  const container = document.getElementById('topics-content');
  if (!topicsData?.topicos?.length) {
    container.innerHTML = emptyState('📡', 'Execute o Researcher para ver os tópicos');
    return;
  }

  const items = topicsData.topicos.filter(t => {
    if (filter === 'todos') return true;
    if (filter === 'alto' || filter === 'medio') return t.confianca_do_sinal === filter;
    return t.rede_origem === filter;
  });

  if (!items.length) {
    container.innerHTML = emptyState('🔍', 'Nenhum tópico com esse filtro');
    return;
  }

  const rows = items.map(t => `
    <tr>
      <td class="rank-num">${t.rank}</td>
      <td>
        <div class="topic-title">${esc(t.tema)}</div>
        <div class="topic-why">${esc(t.por_que_esta_em_alta)}</div>
      </td>
      <td style="max-width:280px;font-size:12px;color:var(--text-dim);line-height:1.5">${esc(t.angulo_inicial)}</td>
      <td><span class="rede-tag">${esc(t.rede_origem)}</span></td>
      <td><span class="badge ${t.confianca_do_sinal}">${t.confianca_do_sinal}</span></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="topics-table-wrap">
      <table class="topics-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tema</th>
            <th>Ângulo inicial</th>
            <th>Rede</th>
            <th>Sinal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function filterTopics(f, el) {
  el.closest('.filter-row').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTopics(f);
}

// ── Render: Angles grid ───────────────────────────
function renderAngulos(filter) {
  const container = document.getElementById('angles-content');
  if (!anglesData?.angulos?.length) {
    container.innerHTML = emptyState('💡', 'Execute o Ideator para ver os ângulos');
    return;
  }

  const items = anglesData.angulos.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'alto' || filter === 'medio') return a.potencial_estimado === filter;
    if (['Instagram','Twitter/X','Ambos'].includes(filter)) return a.rede_recomendada === filter;
    if (['carrossel','thread','video'].includes(filter)) return a.formato_recomendado === filter;
    return true;
  });

  if (!items.length) {
    container.innerHTML = emptyState('🔍', 'Nenhum ângulo com esse filtro');
    return;
  }

  const cards = items.map((a, i) => {
    const tc = tipoColor[a.tipo] || 'var(--border-bright)';
    return `
      <div class="angulo-card" style="--tipo-color:${tc};--i:${i}">
        <div class="angulo-tipo">
          <span style="color:${tc}">${esc(a.tipo)}</span>
          <span class="num-chip">#${a.angulo_numero} · ${esc(a.topico)}</span>
        </div>
        <div class="angulo-titulo">${esc(a.titulo_provisorio)}</div>
        <div class="angulo-gancho">${esc(a.gancho)}</div>
        <div class="angulo-footer">
          <span class="badge ${a.potencial_estimado}">${a.potencial_estimado}</span>
          <span class="rede-tag">${esc(a.rede_recomendada)}</span>
          <span class="formato-tag">${esc(a.formato_recomendado)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="angulos-grid">${cards}</div>`;
}

function filterAngulos(f, el) {
  el.closest('.filter-row').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderAngulos(f);
}

// ── Render: Scripts accordion ─────────────────────
function renderRoteiros(filter) {
  const container = document.getElementById('scripts-content');
  if (!scriptsData?.roteiros?.length) {
    container.innerHTML = emptyState('📝', 'Execute o Scripter para ver os roteiros');
    return;
  }

  const items = scriptsData.roteiros.filter(r => {
    if (filter === 'all') return true;
    if (['Instagram','Twitter/X'].includes(filter)) return r.rede === filter;
    if (['carrossel','thread','video'].includes(filter)) return r.formato === filter;
    return true;
  });

  if (!items.length) {
    container.innerHTML = emptyState('🔍', 'Nenhum roteiro com esse filtro');
    return;
  }

  const html = items.map((r, idx) => {
    const redeCls = r.rede === 'Instagram' ? 'green' : 'teal';
    const slidesHtml = (r.roteiro.desenvolvimento || []).map((s, j) => `
      <div class="slide-item">
        <strong>${slideLabel(r.formato, j + 1)}</strong>
        <p>${esc(s)}</p>
      </div>
    `).join('');

    return `
      <div class="roteiro-card" id="roteiro-${idx}">
        <div class="roteiro-header" onclick="toggleRoteiro('roteiro-${idx}')">
          <div>
            <div class="roteiro-angulo">${esc(r.angulo)}</div>
            <div class="roteiro-tags">
              <span class="badge ${redeCls}">${esc(r.rede)}</span>
              <span class="formato-tag">${esc(r.formato)}</span>
              <span class="rede-tag">Padrão ${esc(r.padrao_gancho)}</span>
            </div>
          </div>
          <div class="roteiro-toggle">+</div>
        </div>
        <div class="roteiro-body">
          <div class="roteiro-body-inner">
            <div class="roteiro-body-inner-pad">
              <div class="roteiro-gancho-box">
                <div class="roteiro-gancho-label">Gancho</div>
                <div class="roteiro-gancho-text">${esc(r.roteiro.gancho)}</div>
              </div>
              <div class="slides-list">${slidesHtml}</div>
              <div class="cta-box">
                <span class="cta-label">CTA</span>
                <span class="cta-text">${esc(r.roteiro.cta)}</span>
              </div>
              <div class="visual-box">🎨 ${esc(r.roteiro.sugestao_visual)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function toggleRoteiro(id) {
  document.getElementById(id).classList.toggle('open');
}

function slideLabel(formato, num) {
  if (formato === 'thread')   return `Tweet ${num}`;
  if (formato === 'carrossel') return `Slide ${num}`;
  return `Parte ${num}`;
}

function filterRoteiros(f, el) {
  el.closest('.filter-row').querySelectorAll('.chip').forEach(c => {
    c.classList.remove('active', 'teal');
  });
  el.classList.add('active');
  if (f === 'Twitter/X') el.classList.add('teal');
  renderRoteiros(f);
}

// ── Utils ─────────────────────────────────────────
async function fetchJson(url, opts = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(opts.headers || {}),
    };
    const r = await fetch(url, { ...opts, headers });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
}

// ── Config modal ───────────────────────────────────────────────────────────────
function openConfigModal() {
  const current = localStorage.getItem('pipeline_api_url') || 'http://localhost:5050';
  document.getElementById('config-url-input').value = current;
  document.getElementById('modal-config').classList.add('open');
}
function closeConfigModal() {
  document.getElementById('modal-config').classList.remove('open');
}
function saveConfig() {
  const val = document.getElementById('config-url-input').value.trim().replace(/\/$/, '');
  if (val) {
    localStorage.setItem('pipeline_api_url', val);
    closeConfigModal();
    location.reload();
  }
}
