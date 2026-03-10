// generate-site.js — Gera a página de status a partir do history/summary.json
const fs = require('fs');

let sites = [];
try {
  const raw = fs.readFileSync('history/summary.json', 'utf8');
  const data = JSON.parse(raw);
  sites = Array.isArray(data) ? data : (data.sites || []);
} catch (e) {
  console.log('history/summary.json not found, generating empty page');
}

function statusLabel(s) {
  if (s === 'up') return 'Operacional';
  if (s === 'down') return 'Fora do ar';
  return 'Degradado';
}

const allUp = sites.length > 0 && sites.every(s => s.status === 'up');
const anyDown = sites.some(s => s.status === 'down');
const overallMsg = allUp
  ? 'Todos os sistemas operaci&oacute;nais'
  : anyDown
  ? 'Alguns sistemas fora do ar'
  : sites.length === 0
  ? 'Aguardando primeira verifica&ccedil;&atilde;o&hellip;'
  : 'Sistemas com degrada&ccedil;&atilde;o';
const overallCls = allUp ? 'up' : anyDown ? 'down' : 'degraded';

const rows = sites.map(site => {
  const cls = site.status === 'up' ? 'up' : site.status === 'down' ? 'down' : 'degraded';
  const uptime = site.uptimeDay || site.uptime || '—';
  const ms = site.timeDay || site.time;
  const msHtml = ms ? '<span class="meta">' + ms + ' ms</span>' : '';
  return (
    '<div class="service">' +
    '  <div class="service-info">' +
    '    <div class="service-name">' + (site.name || site.url) + '</div>' +
    '    <div class="service-url">' + site.url + '</div>' +
    '  </div>' +
    '  <div class="service-right">' +
    '    ' + msHtml +
    '    <span class="meta">' + uptime + ' uptime</span>' +
    '    <span class="badge badge-' + cls + '"><span class="dot dot-' + cls + '"></span>' + statusLabel(site.status) + '</span>' +
    '  </div>' +
    '</div>'
  );
}).join('\n');

const servicesSection = sites.length > 0
  ? '<div class="services">\n' + rows + '\n</div>'
  : '<div class="services empty"><p>Nenhum dado ainda. Aguardando a primeira verifica&ccedil;&atilde;o autom&aacute;tica (at&eacute; 5 minutos).</p></div>';

const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="300">
  <title>Ícone Status</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;min-height:100vh}
    header{background:#fff;border-bottom:1px solid #e2e8f0;padding:18px 0}
    .container{max-width:780px;margin:0 auto;padding:0 24px}
    .logo{font-size:20px;font-weight:700;letter-spacing:-.02em}
    .hero{padding:40px 0 48px}
    .overall{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:28px}
    .overall-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
    .overall-dot.up{background:#22c55e;box-shadow:0 0 0 3px #dcfce7}
    .overall-dot.down{background:#ef4444;box-shadow:0 0 0 3px #fee2e2}
    .overall-dot.degraded{background:#f59e0b;box-shadow:0 0 0 3px #fef3c7}
    .overall-text{font-size:17px;font-weight:600}
    .section-title{font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
    .services{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:32px}
    .services.empty{padding:32px 24px;color:#94a3b8;font-size:14px}
    .service{display:flex;align-items:center;justify-content:space-between;padding:15px 24px;border-bottom:1px solid #f1f5f9}
    .service:last-child{border-bottom:none}
    .service-name{font-weight:500;font-size:15px}
    .service-url{font-size:12px;color:#94a3b8;margin-top:2px}
    .service-right{display:flex;align-items:center;gap:12px;flex-shrink:0}
    .meta{font-size:13px;color:#94a3b8;white-space:nowrap}
    .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:99px;font-size:13px;font-weight:500;white-space:nowrap}
    .badge-up{background:#f0fdf4;color:#15803d}
    .badge-down{background:#fef2f2;color:#b91c1c}
    .badge-degraded{background:#fffbeb;color:#b45309}
    .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .dot-up{background:#22c55e}
    .dot-down{background:#ef4444}
    .dot-degraded{background:#f59e0b}
    footer{padding:32px 0;text-align:center;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;background:#fff;margin-top:8px}
    footer a{color:#64748b;text-decoration:none}
    footer a:hover{text-decoration:underline}
    @media(max-width:580px){.service{flex-direction:column;align-items:flex-start;gap:10px}.service-right{flex-wrap:wrap}}
  </style>
</head>
<body>
<header>
  <div class="container">
    <span class="logo">Ícone Status</span>
  </div>
</header>
<main>
  <div class="container">
    <div class="hero">
      <div class="overall">
        <div class="overall-dot ${overallCls}"></div>
        <span class="overall-text">${overallMsg}</span>
      </div>
      <p class="section-title">Serviços</p>
      ${servicesSection}
    </div>
  </div>
</main>
<footer>
  Atualizado em ${now} (BRT) ·
  Monitorado por <a href="https://upptime.js.org" target="_blank" rel="noopener">Upptime</a> ·
  <a href="https://icone.academy" target="_blank" rel="noopener">Ícone Academy</a>
</footer>
</body>
</html>`;

fs.mkdirSync('_site', { recursive: true });
fs.writeFileSync('_site/index.html', html);
fs.writeFileSync('_site/CNAME', 'status.icone.academy');

console.log('✅ Site gerado em _site/index.html');
console.log('Serviços:', sites.length > 0 ? sites.map(s => s.name + ': ' + s.status).join(', ') : 'nenhum');
