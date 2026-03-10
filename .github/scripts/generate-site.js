// generate-site.js — Status page generator (light mode, real backend data)
const fs   = require('fs');
const path = require('path');

// ── Upptime summary ────────────────────────────────────────────────────────────
let sites = [];
try {
  const raw = fs.readFileSync('history/summary.json', 'utf8');
  const data = JSON.parse(raw);
  sites = Array.isArray(data) ? data : (data.sites || []);
} catch (_) {}

// ── Real backend health data ───────────────────────────────────────────────────
let healthFull = null;   // parsed JSON from /health
try {
  const raw = fs.readFileSync('health-full.json', 'utf8');
  const obj = JSON.parse(raw);
  if (obj && obj.status) healthFull = obj;   // has real data
} catch (_) {}

// ── History parser (sparklines) ───────────────────────────────────────────────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildBars(slug, total = 60) {
  const file = `history/${slug}.yml`;
  const bars = Array(total).fill('up');
  try {
    const raw  = fs.readFileSync(file, 'utf8');
    const lines = raw.split('\n');
    let cur = {};
    for (const line of lines) {
      const m = line.match(/^\s*-?\s*(status|startTime):\s+(.+)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'status') { if (cur.status) flush(cur); cur = { status: v.trim() }; }
      else cur[k] = v.trim();
    }
    if (cur.status) flush(cur);
    function flush(e) {
      if (e.status !== 'down' || !e.startTime) return;
      try {
        const diff = Math.floor((Date.now() - new Date(e.startTime)) / 86400000);
        if (diff >= 0 && diff < total) bars[total - 1 - diff] = 'down';
      } catch (_) {}
    }
  } catch (_) {}
  return bars;
}

function sparkline(bars) {
  return bars.map((s, i) => {
    const age = bars.length - 1 - i;
    const lbl = age === 0 ? 'Hoje' : `${age}d atras`;
    const cls = s === 'down' ? 'bar-down' : s === 'degraded' ? 'bar-deg' : 'bar-up';
    return `<div class="bar ${cls}" title="${lbl}"></div>`;
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pct(v) { return (v !== undefined && v !== null && v !== '') ? (String(v).endsWith('%') ? v : v + '%') : null; }
function ms(v)  {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return n >= 1000 ? (n/1000).toFixed(2) + 's' : n + 'ms';
}

const LABEL = { up: 'Operacional', down: 'Indisponivel', degraded: 'Degradado' };
function badge(status) {
  const lbl = LABEL[status] || LABEL.up;
  return `<span class="badge badge-${status || 'up'}">${lbl}</span>`;
}

// ── Overall ────────────────────────────────────────────────────────────────────
const anyDown     = sites.some(s => s.status === 'down');
const anyDegraded = sites.some(s => s.status !== 'up' && s.status !== 'down');
const allUp       = sites.length > 0 && !anyDown && !anyDegraded;

const overall = allUp
  ? { cls: 'ov-up',   icon: '&#10003;', title: 'Todos os sistemas operacionais',             sub: 'Todos os servicos estao funcionando normalmente.' }
  : anyDown
  ? { cls: 'ov-down', icon: '!',        title: 'Instabilidade detectada',                   sub: 'Estamos investigando. Atualizaremos em breve.' }
  : sites.length === 0
  ? { cls: 'ov-unk',  icon: '&middot;', title: 'Aguardando primeira verificacao',            sub: 'O monitoramento inicia automaticamente.' }
  : { cls: 'ov-deg',  icon: '~',        title: 'Alguns sistemas com desempenho reduzido',    sub: 'Servicos podem estar lentos.' };

// ── Logo ───────────────────────────────────────────────────────────────────────
let logoDataUrl = '';
try {
  const buf = fs.readFileSync(path.join(__dirname, 'logo.png'));
  logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
} catch (_) {}

const logoHtml = logoDataUrl
  ? `<img src="${logoDataUrl}" alt="ICone Academy" width="28" height="28" style="border-radius:6px;object-fit:contain;">`
  : '';

// ── Health checks section (real data from /health) ────────────────────────────
function healthSection() {
  if (!healthFull) return '';

  const overallStatus = (healthFull.status || '').toLowerCase();
  const isHealthy = overallStatus === 'healthy';

  const checkRows = (healthFull.checks || []).map(c => {
    const st    = (c.status || '').toLowerCase();
    const isOk  = st === 'healthy';
    const isDeg = st === 'degraded';
    const dotCls  = isOk ? 'dot-up' : isDeg ? 'dot-deg' : 'dot-down';
    const txt     = isOk ? 'Operacional' : isDeg ? 'Degradado' : 'Problema';
    const stCls   = isOk ? 'check-ok' : isDeg ? 'check-deg' : 'check-err';
    const descHtml = c.description ? `<span class="check-desc">${c.description}</span>` : '';
    return `
    <div class="check-row">
      <div class="check-left">
        <span class="dot ${dotCls}"></span>
        <span class="check-name">${c.name}</span>
        ${descHtml}
      </div>
      <span class="check-status ${stCls}">${txt}</span>
    </div>`;
  }).join('');

  const hasChecks = checkRows.trim().length > 0;

  return `
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">Diagnostico do Backend</h2>
      <span class="badge badge-${isHealthy ? 'up' : 'down'} badge-sm">${isHealthy ? 'Healthy' : overallStatus}</span>
    </div>
    <div class="checks-card">
      ${hasChecks ? checkRows : '<p class="no-checks">Sem dados de checks retornados pelo /health.</p>'}
    </div>
  </section>`;
}

// ── Service cards ──────────────────────────────────────────────────────────────
function serviceCard(site) {
  const st    = site.status || 'up';
  const slug  = slugify(site.name || site.url);
  const bars  = buildBars(slug, 60);

  const d1  = pct(site.uptimeDay   ?? site.uptime);
  const d7  = pct(site.uptimeWeek);
  const d30 = pct(site.uptimeMonth);
  const t   = ms(site.timeDay ?? site.time);

  const stats = [
    d1  ? `<div class="stat"><div class="sv">${d1}</div><div class="sk">Hoje</div></div>` : '',
    d7  ? `<div class="stat"><div class="sv">${d7}</div><div class="sk">7 dias</div></div>` : '',
    d30 ? `<div class="stat"><div class="sv">${d30}</div><div class="sk">30 dias</div></div>` : '',
    t   ? `<div class="stat"><div class="sv">${t}</div><div class="sk">Resposta</div></div>` : '',
  ].filter(Boolean).join('');

  return `
  <div class="card">
    <div class="card-top">
      <div>
        <div class="card-name">${site.name || site.url}</div>
        <a class="card-url" href="${site.url}" target="_blank" rel="noopener">${site.url}</a>
      </div>
      ${badge(st)}
    </div>
    ${stats ? `<div class="stats">${stats}</div>` : ''}
    <div class="spark-wrap">
      <div class="spark">${sparkline(bars)}</div>
      <div class="spark-leg"><span>60 dias atras</span><span>Hoje</span></div>
    </div>
  </div>`;
}

// ── Incidents ──────────────────────────────────────────────────────────────────
const downServices = sites.filter(s => s.status === 'down');
const incidentHtml = downServices.length > 0 ? `
<section class="section">
  <h2 class="section-title">Incidente Ativo</h2>
  ${downServices.map(s => `
  <div class="incident-card">
    <div class="incident-row">
      <span class="incident-pulse"></span>
      <strong>${s.name}</strong>
      <span class="incident-tag">Em investigacao</span>
    </div>
    <p class="incident-sub">Nosso time foi notificado e esta trabalhando na resolucao.</p>
  </div>`).join('')}
</section>` : '';

const now = new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

// ── HTML ──────────────────────────────────────────────────────────────────────
const cardsHtml = sites.length > 0
  ? sites.map(serviceCard).join('\n')
  : `<div class="card card-empty">Aguardando dados de monitoramento...</div>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="300">
  <title>Status &mdash; ICone Academy</title>
  <meta name="description" content="Status em tempo real dos servicos da ICone Academy.">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#f7f8fa;
      --surface:#fff;
      --border:#e4e7ec;
      --text:#101828;
      --muted:#667085;
      --dim:#98a2b3;
      --up:#027a48;--up-bg:#ecfdf3;--up-bd:#abefc6;
      --down:#b42318;--down-bg:#fef3f2;--down-bd:#fecdca;
      --deg:#b54708;--deg-bg:#fffaeb;--deg-bd:#fedf89;
      --r:10px;
    }
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:15px;line-height:1.6;min-height:100vh}

    header{background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
    .hdr{max-width:860px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between}
    .brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--text)}
    .brand-name{font-size:15px;font-weight:700;letter-spacing:-.02em}
    .brand-sep{color:var(--dim);margin:0 2px}
    .brand-sub{font-size:14px;color:var(--muted);font-weight:400}
    .hdr-link{font-size:13px;color:var(--muted);text-decoration:none}
    .hdr-link:hover{color:var(--text)}

    .page{max-width:860px;margin:0 auto;padding:36px 24px 72px}

    .overall{border-radius:var(--r);padding:18px 22px;display:flex;align-items:center;gap:14px;margin-bottom:36px;border:1px solid}
    .ov-up  {background:#ecfdf3;border-color:#abefc6}
    .ov-down{background:#fef3f2;border-color:#fecdca}
    .ov-deg {background:#fffaeb;border-color:#fedf89}
    .ov-unk {background:var(--surface);border-color:var(--border)}
    .ov-icon{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;flex-shrink:0}
    .ov-up  .ov-icon{background:#dcfce7;color:#16a34a}
    .ov-down.ov-icon{background:#fee2e2;color:#dc2626}
    .ov-deg .ov-icon{background:#fef9c3;color:#ca8a04}
    .ov-unk .ov-icon{background:var(--border);color:var(--muted)}
    .ov-body{flex:1}
    .ov-title{font-size:16px;font-weight:700;margin-bottom:1px}
    .ov-sub{font-size:13px;color:var(--muted)}
    .pulse{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .ov-up   .pulse{background:#16a34a;animation:p 2s infinite}
    .ov-down .pulse{background:#dc2626}
    .ov-deg  .pulse{background:#ca8a04}
    .ov-unk  .pulse{background:var(--dim)}
    @keyframes p{0%{box-shadow:0 0 0 0 rgba(22,163,74,.4)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}

    .section{margin-bottom:36px}
    .section-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .section-title{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}

    .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:500;white-space:nowrap;border:1px solid transparent}
    .badge::before{content:'';width:6px;height:6px;border-radius:50%}
    .badge-up      {background:var(--up-bg);  color:var(--up);  border-color:var(--up-bd)}
    .badge-up::before{background:var(--up)}
    .badge-down    {background:var(--down-bg);color:var(--down);border-color:var(--down-bd)}
    .badge-down::before{background:var(--down)}
    .badge-degraded{background:var(--deg-bg); color:var(--deg); border-color:var(--deg-bd)}
    .badge-degraded::before{background:var(--deg)}
    .badge-sm{font-size:11px;padding:1px 7px}

    .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;margin-bottom:8px;transition:box-shadow .15s}
    .card:hover{box-shadow:0 2px 10px rgba(0,0,0,.07)}
    .card-empty{color:var(--muted);font-size:14px;text-align:center;padding:28px}
    .card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .card-name{font-weight:600;font-size:15px;margin-bottom:2px}
    .card-url{font-size:12px;color:var(--dim);text-decoration:none}
    .card-url:hover{text-decoration:underline}

    .stats{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)}
    .stat{display:flex;flex-direction:column}
    .sv{font-size:14px;font-weight:700}
    .sk{font-size:11px;color:var(--dim);margin-top:1px}

    .spark{display:flex;gap:2px;height:26px;align-items:flex-end}
    .bar{flex:1;height:100%;border-radius:2px;min-width:2px;cursor:default}
    .bar:hover{opacity:.6}
    .bar-up  {background:#bbf7d0}
    .bar-down{background:#fca5a5}
    .bar-deg {background:#fde68a}
    .spark-leg{display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--dim)}

    .checks-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
    .check-row{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid var(--border);gap:12px}
    .check-row:last-child{border-bottom:none}
    .check-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
    .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .dot-up  {background:#16a34a}
    .dot-down{background:#dc2626}
    .dot-deg {background:#ca8a04}
    .check-name{font-size:14px;font-weight:500;text-transform:capitalize}
    .check-desc{font-size:12px;color:var(--muted);margin-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .check-status{font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0}
    .check-ok {color:var(--up)}
    .check-deg{color:var(--deg)}
    .check-err{color:var(--down)}
    .no-checks{padding:16px 20px;font-size:13px;color:var(--muted)}

    .incident-card{background:#fef3f2;border:1px solid #fecdca;border-radius:var(--r);padding:14px 18px;margin-bottom:8px}
    .incident-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:14px}
    .incident-pulse{width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0;animation:pr 1.5s infinite}
    @keyframes pr{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.4)}50%{box-shadow:0 0 0 6px transparent}}
    .incident-tag{margin-left:auto;font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;background:#fee2e2;color:#b91c1c}
    .incident-sub{font-size:13px;color:#991b1b;padding-left:18px}

    footer{border-top:1px solid var(--border);padding:24px;text-align:center;font-size:12px;color:var(--dim)}
    footer a{color:var(--muted);text-decoration:none}
    footer a:hover{text-decoration:underline}
    .fdot{margin:0 7px;opacity:.5}

    @media(max-width:560px){.page{padding:20px 14px 56px}.hdr{padding:0 14px}.card-top{flex-wrap:wrap}.stats{gap:12px}}
  </style>
</head>
<body>
<header>
  <div class="hdr">
    <a class="brand" href="https://icone.academy" target="_blank" rel="noopener">
      ${logoHtml}
      <span class="brand-name">ICone Academy</span>
      <span class="brand-sep">&middot;</span>
      <span class="brand-sub">Status</span>
    </a>
    <a class="hdr-link" href="https://icone.academy" target="_blank" rel="noopener">Ir para a plataforma &rarr;</a>
  </div>
</header>
<main>
<div class="page">

  <div class="overall ${overall.cls}">
    <div class="ov-icon">${overall.icon}</div>
    <div class="ov-body">
      <div class="ov-title">${overall.title}</div>
      <div class="ov-sub">${overall.sub}</div>
    </div>
    <div class="pulse"></div>
  </div>

  ${incidentHtml}

  <section class="section">
    <p class="section-title">Servicos</p>
    ${cardsHtml}
  </section>

  ${healthSection()}

</div>
</main>
<footer>
  Atualizado em ${now} (BRT)
  <span class="fdot">&middot;</span>
  Monitorado com <a href="https://upptime.js.org" target="_blank" rel="noopener">Upptime</a>
  <span class="fdot">&middot;</span>
  <a href="https://icone.academy" target="_blank" rel="noopener">ICone Academy</a>
</footer>
</body>
</html>`;

fs.mkdirSync('_site', { recursive: true });
fs.writeFileSync('_site/index.html', html);
fs.writeFileSync('_site/CNAME', 'status.icone.academy');

console.log('Site gerado. Servicos:', sites.map(s => `${s.name}:${s.status}`).join(', ') || 'nenhum');
if (healthFull) console.log('Health checks:', (healthFull.checks || []).map(c => `${c.name}:${c.status}`).join(', '));
else console.log('health-full.json nao encontrado — secao backend omitida');
