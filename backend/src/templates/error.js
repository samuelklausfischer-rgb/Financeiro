function renderErrorPage(errorCode, errorMessage, details, requestId) {
  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'long',
    timeStyle: 'medium',
  });

  const detailsHtml = details
    ? `<div class="details-card">
        <h3>Detalhes</h3>
        <ul class="details-list">
          ${Object.entries(details)
            .map(
              ([key, value]) =>
                `<li><span class="detail-key">${escapeHtml(key)}</span><span class="detail-value">${escapeHtml(String(value ?? ''))}</span></li>`
            )
            .join('')}
        </ul>
      </div>`
    : '';

  const requestIdHtml = requestId
    ? `<div class="request-id-card">
        <span class="label">ID da Requisição:</span>
        <code>${escapeHtml(requestId)}</code>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro ${escapeHtml(errorCode)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f0f4f8;
      color: #1e293b;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .container {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      max-width: 560px;
      width: 100%;
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      padding: 2rem 2rem 1.75rem;
      text-align: center;
    }

    .header .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      margin-bottom: 1rem;
    }

    .header .icon svg {
      width: 36px;
      height: 36px;
      stroke: #ffffff;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .header h1 {
      color: #ffffff;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .header .subtitle {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9rem;
    }

    .body { padding: 2rem; }

    .error-code-badge {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      letter-spacing: 0.025em;
      margin-bottom: 0.75rem;
    }

    .error-message {
      font-size: 1.1rem;
      color: #334155;
      margin-bottom: 1.5rem;
    }

    .details-card,
    .request-id-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .details-card h3 {
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .details-list {
      list-style: none;
    }

    .details-list li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.9rem;
    }

    .details-list li:last-child { border-bottom: none; }

    .detail-key {
      color: #64748b;
      font-weight: 500;
      margin-right: 1rem;
      flex-shrink: 0;
    }

    .detail-value {
      color: #1e293b;
      text-align: right;
      word-break: break-word;
    }

    .request-id-card .label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: block;
      margin-bottom: 0.35rem;
    }

    .request-id-card code {
      display: block;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.85rem;
      color: #475569;
      background: #e2e8f0;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      word-break: break-all;
    }

    .footer {
      padding: 1.25rem 2rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .timestamp {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .btn-voltar {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #2563eb;
      color: #ffffff;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.55rem 1.25rem;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .btn-voltar:hover { background: #1d4ed8; }

    .btn-voltar svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 480px) {
      .header { padding: 1.5rem 1.25rem 1.25rem; }
      .header h1 { font-size: 1.25rem; }
      .body { padding: 1.25rem; }
      .footer {
        flex-direction: column-reverse;
        text-align: center;
        padding: 1.25rem;
      }
      .btn-voltar { width: 100%; justify-content: center; }
      .details-list li { flex-direction: column; align-items: flex-start; gap: 0.15rem; }
      .detail-value { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <h1>Erro no Processamento</h1>
      <p class="subtitle">Ocorreu um erro ao processar sua solicitação</p>
    </div>

    <div class="body">
      <span class="error-code-badge">${escapeHtml(errorCode)}</span>
      <p class="error-message">${escapeHtml(errorMessage)}</p>

      ${detailsHtml}
      ${requestIdHtml}
    </div>

    <div class="footer">
      <span class="timestamp">${escapeHtml(timestamp)}</span>
      <a href="https://prndiag1.app.n8n.cloud/webhook/prn/app" class="btn-voltar">
        <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Voltar
      </a>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { renderErrorPage };
