/**
 * html-renderer.js
 *
 * Converte o modelo do relatório financeiro PRN (produzido por report-builder.js)
 * em uma página HTML completa, autocontida, responsiva e pronta para impressão.
 *
 * Características:
 *   - CSS 100% inline (sem CDN, sem dependências externas)
 *   - Idioma: Português do Brasil
 *   - Responsivo para dispositivos móveis
 *   - Esquema de cores profissional azul/cinza
 *   - Regras @media print para impressão limpa
 *   - Valores monetários formatados como BRL (R$ X.XXX,XX)
 *   - Datas formatadas como DD/MM/YYYY
 *   - Valores negativos exibidos em vermelho
 */

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

const APP_URL = 'https://prndiag1.app.n8n.cloud/webhook/prn/app';

/**
 * Formata um número como moeda brasileira (BRL).
 * Exemplo: 1234.56 => "R$ 1.234,56"
 *         -500.00 => <span class="negative">-R$ 500,00</span>
 *
 * @param {number} value — valor numérico
 * @param {boolean} [html=true] — se true, retorna HTML com <span> para negativos
 * @returns {string} valor formatado
 */
function _formatBRL(value, html = true) {
  const num = Number(value) || 0;
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const str = `R$ ${formatted}`;
  if (isNegative && html) {
    return `<span class="negativo">-${str}</span>`;
  }
  return isNegative ? `-${str}` : str;
}

/**
 * Formata uma data string "YYYY-MM-DD" (ou Date) como "DD/MM/YYYY".
 *
 * @param {string|Date} dateInput — data de entrada
 * @returns {string} data formatada ou texto original se não for possível converter
 */
function _formatDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formata um mês "YYYY-MM" como "MM/YYYY".
 *
 * @param {string} ym
 * @returns {string}
 */
function _formatMonth(ym) {
  if (!ym || typeof ym !== 'string') return '—';
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return `${m[2]}/${m[1]}`;
}

/**
 * Formata percentual com sinal e duas casas.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
function _formatPercent(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Escapa caracteres HTML para evitar XSS em dados dinâmicos.
 *
 * @param {string} str — texto bruto
 * @returns {string} texto escapado
 */
function _esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Retorna a classe CSS de severidade para warnings.
 *
 * @param {string} severity — nível de severidade (info, low, medium, high)
 * @returns {string} nome da classe CSS
 */
function _severityClass(severity) {
  const s = String(severity || 'info').toLowerCase();
  const map = {
    info: 'warn-info',
    low: 'warn-low',
    medium: 'warn-medium',
    high: 'warn-high',
  };
  return map[s] || 'warn-info';
}

/**
 * Gera um timestamp ISO legível em pt-BR.
 *
 * @returns {string} data e hora formatadas
 */
function _nowTimestamp() {
  return new Date().toLocaleString('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ---------------------------------------------------------------------------
// Funções de construção de seções HTML
// ---------------------------------------------------------------------------

/**
 * Seção (a): Cabeçalho com título, data, request ID e nomes de arquivo.
 */
function _buildHeader(rm) {
  return `
    <header class="header">
      <div class="header-top">
        <a href="${APP_URL}" class="btn-voltar">&larr; Voltar</a>
        <h1>Relatório Financeiro PRN</h1>
      </div>
      <div class="header-meta">
        <span><strong>Data de referência:</strong> ${_esc(_formatDate(rm.referenceDateUsed))}</span>
        <span><strong>ID da requisição:</strong> ${_esc(rm.requestId)}</span>
      </div>
      <div class="header-files">
        <span><strong>Arquivo diário:</strong> ${_esc(rm.request.dailyFilename)}</span>
        <span><strong>Arquivo histórico:</strong> ${_esc(rm.request.historyFilename)}</span>
      </div>
    </header>`;
}

/**
 * Seção (b): Cards de resumo financeiro (5 cards).
 */
function _buildSummaryCards(rm) {
  const s = rm.summary;
  const cards = [
    { label: 'Total Despesas', value: s.totalDespesas, cls: 'card-expense' },
    { label: 'Total Recebido', value: s.totalRecebido, cls: 'card-income' },
    { label: 'Saldo Bancário', value: s.saldoBancario, cls: 'card-balance' },
    { label: 'Transferência Necessária', value: s.transferenciaNecessaria, cls: 'card-transfer' },
  ];

  const cardsHtml = cards.map(c => `
      <div class="summary-card ${c.cls}">
        <div class="card-label">${c.label}</div>
        <div class="card-value">${_formatBRL(c.value)}</div>
      </div>`).join('');

  return `
    <section class="section" id="resumo">
      <h2 class="section-title">Resumo Financeiro</h2>
      <div class="cards-grid">${cardsHtml}</div>
    </section>`;
}

/**
 * Seção foco inicial: cruzamento de nomes da diária com histórico por mês.
 */
function _buildCrossAnalysisSection(rm) {
  const c = rm.crossAnalysis || {};
  const rowsData = Array.isArray(c.rows) ? c.rows : [];
  const months = Array.isArray(c.months) ? c.months : [];
  const cfg = c.config || {};
  const thresholdPct = Number(cfg.divergenceThresholdPct || 25);

  if (rowsData.length === 0) return '';

  const groups = c.groups || {};
  const getGroupRows = (groupRows, fallback) => {
    if (Array.isArray(groupRows)) return groupRows;
    return fallback;
  };

  const rowsComHistorico = getGroupRows(groups.comHistorico?.rows, rowsData.filter((r) => r.temHistorico));
  const rowsSemHistorico = getGroupRows(groups.semHistorico?.rows, rowsData.filter((r) => !r.temHistorico));
  const rowsExato = getGroupRows(
    groups.exatoTodosMeses?.rows,
    rowsData.filter((r) => r.temHistorico && r.pagamentoExatoMensal),
  );
  const rowsDiferente = getGroupRows(
    groups.diferenteEntreMeses?.rows,
    rowsData.filter((r) => r.temHistorico && !r.pagamentoExatoMensal),
  );
  const rowsAlerta = getGroupRows(
    groups.alertaAnaliseManual?.rows,
    rowsData.filter((r) => r.alertaDivergencia25),
  );

  const groupCount = (groupObj, fallbackRows) => {
    if (groupObj && Number.isFinite(Number(groupObj.totalNomes))) return Number(groupObj.totalNomes);
    return fallbackRows.length;
  };

  const grupoLabel = (row) => {
    if (!row || !row.temHistorico) return 'Sem histórico';
    if (row.grupoMensal === 'exato' || row.pagamentoExatoMensal) return 'Exato';
    if (row.grupoMensal === 'historico_insuficiente') return 'Histórico insuficiente';
    return 'Diferente';
  };

  const cardsHtml = `
    <div class="cards-grid" style="margin-bottom:1rem">
      <div class="summary-card card-info">
        <div class="card-label">Nomes no Dia</div>
        <div class="card-value">${Number(c.totalNomesDia || rowsData.length).toLocaleString('pt-BR')}</div>
      </div>
      <div class="summary-card card-expense">
        <div class="card-label">Total Pago no Dia</div>
        <div class="card-value">${_formatBRL(Number(c.totalValorDia || 0))}</div>
      </div>
      <div class="summary-card card-balance">
        <div class="card-label">Total Histórico Cruzado</div>
        <div class="card-value">${_formatBRL(Number(c.totalHistoricoCruzado || 0))}</div>
      </div>
    </div>`;

  const groupCardsHtml = `
    <div class="cards-grid" style="margin-bottom:1rem">
      <div class="summary-card card-balance">
        <div class="card-label">Com Histórico</div>
        <div class="card-value">${groupCount(groups.comHistorico, rowsComHistorico).toLocaleString('pt-BR')}</div>
      </div>
      <div class="summary-card card-info">
        <div class="card-label">Sem Histórico</div>
        <div class="card-value">${groupCount(groups.semHistorico, rowsSemHistorico).toLocaleString('pt-BR')}</div>
      </div>
      <div class="summary-card card-income">
        <div class="card-label">Exato Todos Meses</div>
        <div class="card-value">${groupCount(groups.exatoTodosMeses, rowsExato).toLocaleString('pt-BR')}</div>
      </div>
      <div class="summary-card card-expense">
        <div class="card-label">Diferente Entre Meses</div>
        <div class="card-value">${groupCount(groups.diferenteEntreMeses, rowsDiferente).toLocaleString('pt-BR')}</div>
      </div>
      <div class="summary-card card-warning">
        <div class="card-label">Alerta Manual (&gt; ${thresholdPct}%)</div>
        <div class="card-value">${groupCount(groups.alertaAnaliseManual, rowsAlerta).toLocaleString('pt-BR')}</div>
      </div>
    </div>`;

  const buildGroupTable = (title, rows, tableId) => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const headers = [
      'Nome',
      'Valor no dia',
      'Média hist./mês',
      'Divergência',
      'Total histórico',
      'Qtd histórico',
      'Grupo mensal',
      `Alerta > ${thresholdPct}%`,
    ];

    const body = rows.map((r) => [
      r.nome || '—',
      Number(r.valorDia || 0),
      r.temHistorico ? Number(r.mediaHistoricaMensal || 0) : '—',
      _formatPercent(r.divergenciaPct),
      Number(r.totalHistorico || 0),
      String(r.qtdHistorico || 0),
      grupoLabel(r),
      r.alertaDivergencia25 ? 'SIM' : 'NÃO',
    ]);

    return `<h3 style="margin-top:1rem">${_esc(title)} (${rows.length})</h3>${_buildTable(headers, body, tableId)}`;
  };

  const headers = ['Nome (dia)', 'Valor no dia', 'Média hist./mês', 'Divergência'];
  for (const m of months) headers.push(_formatMonth(m));
  headers.push('Total histórico', 'Qtd histórico', 'Último pagamento', 'Grupo mensal', `Alerta > ${thresholdPct}%`);

  const rows = rowsData.map((r) => {
    const row = [
      r.nome || '—',
      Number(r.valorDia || 0),
      r.temHistorico ? Number(r.mediaHistoricaMensal || 0) : '—',
      _formatPercent(r.divergenciaPct),
    ];

    for (const m of months) {
      row.push(Number((r.meses || {})[m] || 0));
    }

    row.push(
      Number(r.totalHistorico || 0),
      String(r.qtdHistorico || 0),
      _formatDate(r.ultimoPagamento || null),
      grupoLabel(r),
      r.alertaDivergencia25 ? 'SIM' : 'NÃO',
    );

    return row;
  });

  return `
    <section class="section" id="cruzamento">
      <h2 class="section-title">Pagamentos do Dia x Histórico</h2>
      <p style="margin:-0.25rem 0 1rem;color:#5a6178;font-size:0.9rem">
        Base de comparação: média dos meses com histórico. Grupo "Exato" exige no mínimo ${Number(cfg.minMonthsForExactAnalysis || 2)} meses.
      </p>
      ${cardsHtml}
      ${groupCardsHtml}
      ${_buildTable(headers, rows, 'tbl-cruzamento')}
      ${buildGroupTable('Grupo: Sem Histórico', rowsSemHistorico, 'tbl-grupo-sem-historico')}
      ${buildGroupTable('Grupo: Com Histórico', rowsComHistorico, 'tbl-grupo-com-historico')}
      ${buildGroupTable('Grupo: Exato Todos os Meses', rowsExato, 'tbl-grupo-exato')}
      ${buildGroupTable('Grupo: Diferente Entre Meses', rowsDiferente, 'tbl-grupo-diferente')}
      ${buildGroupTable(`Grupo: Alerta para Análise Manual (> ${thresholdPct}%)`, rowsAlerta, 'tbl-grupo-alerta')}
    </section>`;
}

/**
 * Seção (c): Cards por entidade (PRN MATRIZ, PRN LOCAÇÃO, PRN HOLDING, etc.).
 */
function _buildEntitiesSection(rm) {
  const entities = rm.entities || [];
  if (entities.length === 0) return '';

  const entityCards = entities.map(e => {
    const saldoB = _formatBRL(e.saldoBancario || 0);
    const desp = _formatBRL(e.despesas || 0);
    const rec = _formatBRL(e.recebido || 0);

    return `
      <div class="entity-card">
        <div class="entity-name">${_esc(e.label || e.name || e.entity || 'Entidade')}</div>
        <div class="entity-row"><span>Saldo Bancário:</span><span>${saldoB}</span></div>
        <div class="entity-row"><span>Despesas:</span><span>${desp}</span></div>
        <div class="entity-row"><span>Recebido:</span><span>${rec}</span></div>
      </div>`;
  }).join('');

  return `
    <section class="section" id="entidades">
      <h2 class="section-title">Entidades</h2>
      <div class="entities-grid">${entityCards}</div>
    </section>`;
}

/**
 * Constrói uma tabela HTML com cabeçalhos e linhas, com suporte a classe CSS customizada.
 */
function _buildTable(headers, rows, tableId) {
  const thHtml = headers.map(h => `<th>${_esc(h)}</th>`).join('');
  const trHtml = rows.map(row => {
    const tdHtml = headers.map((_, i) => {
      const val = row[i] !== undefined && row[i] !== null ? row[i] : '';
      if (typeof val === 'number') return `<td class="num">${_formatBRL(val)}</td>`;
      return `<td>${_esc(val)}</td>`;
    }).join('');
    return `<tr>${tdHtml}</tr>`;
  }).join('');

  return `
    <div class="table-wrapper">
      <table id="${_esc(tableId)}">
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${trHtml}</tbody>
      </table>
    </div>`;
}

/**
 * Seção (d): Tabela de Despesas.
 */
function _buildDespesasTable(rm) {
  const expenses = rm.expenses || [];
  if (expenses.length === 0) return '';

  const headers = ['Vencimento', 'Favorecido', 'Categoria', 'Departamento', 'Valor'];
  const rows = expenses.map(e => [
    _formatDate(e.vencimento || e.dataVencimento || e.date),
    e.favorecido || e.fornecedor || e.description || '',
    e.categoria || e.category || '',
    e.departamento || e.department || '',
    Number(e.valor || e.value || 0),
  ]);

  return `
    <section class="section" id="despesas">
      <h2 class="section-title">Despesas</h2>
      ${_buildTable(headers, rows, 'tbl-despesas')}
    </section>`;
}

/**
 * Seção (e): Tabela de Recebidos.
 */
function _buildRecebidosTable(rm) {
  const receipts = rm.receipts || [];
  if (receipts.length === 0) return '';

  const headers = ['Data', 'Descrição', 'Conta Corrente', 'Valor'];
  const rows = receipts.map(r => [
    _formatDate(r.data || r.date || ''),
    r.descricao || r.description || '',
    r.contaCorrente || r.conta || r.account || '',
    Number(r.valor || r.value || 0),
  ]);

  return `
    <section class="section" id="recebidos">
      <h2 class="section-title">Recebidos</h2>
      ${_buildTable(headers, rows, 'tbl-recebidos')}
    </section>`;
}

/**
 * Seção (f): Top 10 Despesas por valor.
 */
function _buildTopDespesas(rm) {
  const expenses = rm.expenses || [];
  if (expenses.length === 0) return '';

  const sorted = [...expenses]
    .map(e => ({
      favorecido: e.favorecido || e.fornecedor || e.description || '—',
      categoria: e.categoria || e.category || '—',
      vencimento: e.vencimento || e.dataVencimento || e.date || '',
      valor: Number(e.valor || e.value || 0),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  const items = sorted.map((d, i) => `
    <div class="top-item">
      <span class="top-rank">#${i + 1}</span>
      <span class="top-info">
        <strong>${_esc(d.favorecido)}</strong>
        <small>${_esc(d.categoria)} &middot; ${_esc(_formatDate(d.vencimento))}</small>
      </span>
      <span class="top-value">${_formatBRL(d.valor)}</span>
    </div>`).join('');

  return `
    <section class="section" id="top-despesas">
      <h2 class="section-title">Top 10 Despesas</h2>
      <div class="top-list">${items}</div>
    </section>`;
}

/**
 * Seção (g): Despesas por Categoria — agrupamento simples.
 */
function _buildDespesasPorCategoria(rm) {
  const expenses = rm.expenses || [];
  if (expenses.length === 0) return '';

  const catMap = {};
  for (const e of expenses) {
    const cat = e.categoria || e.category || 'Outros';
    const val = Number(e.valor || e.value || 0);
    if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
    catMap[cat].total += val;
    catMap[cat].count += 1;
  }

  const sorted = Object.entries(catMap)
    .map(([categoria, data]) => ({ categoria, ...data }))
    .sort((a, b) => b.total - a.total);

  const headers = ['Categoria', 'Qtd', 'Total'];
  const rows = sorted.map(d => [d.categoria, String(d.count), d.total]);

  return `
    <section class="section" id="despesas-categoria">
      <h2 class="section-title">Despesas por Categoria</h2>
      ${_buildTable(headers, rows, 'tbl-cat-despesas')}
    </section>`;
}

/**
 * Seção (h): Recebidos por Conta — agrupamento simples.
 */
function _buildRecebidosPorConta(rm) {
  const receipts = rm.receipts || [];
  if (receipts.length === 0) return '';

  const accMap = {};
  for (const r of receipts) {
    const acc = r.contaCorrente || r.conta || r.account || 'Outros';
    const val = Number(r.valor || r.value || 0);
    if (!accMap[acc]) accMap[acc] = { total: 0, count: 0 };
    accMap[acc].total += val;
    accMap[acc].count += 1;
  }

  const sorted = Object.entries(accMap)
    .map(([conta, data]) => ({ conta, ...data }))
    .sort((a, b) => b.total - a.total);

  const headers = ['Conta Corrente', 'Qtd', 'Total'];
  const rows = sorted.map(d => [d.conta, String(d.count), d.total]);

  return `
    <section class="section" id="recebidos-conta">
      <h2 class="section-title">Recebidos por Conta</h2>
      ${_buildTable(headers, rows, 'tbl-recebidos-conta')}
    </section>`;
}

/**
 * Seção (i): Histórico PRN — análise consolidada.
 */
function _buildHistoricoSection(rm) {
  const h = rm.history || {};
  if (!h.totalRecords && h.totalRecords !== 0) return '';

  const periodStart = _formatDate(h.periodStart || h.period?.start);
  const periodEnd = _formatDate(h.periodEnd || h.period?.end);

  // Tabela de top categorias
  const catHeaders = ['Categoria', 'Total Pago', 'Qtd'];
  const catRows = (h.topCategorias || []).map(c => [
    c.categoria || '—',
    Number(c.total || 0),
    String(c.count || 0),
  ]);

  // Tabela de top fornecedores
  const fornHeaders = ['Fornecedor', 'Total Pago', 'Qtd'];
  const fornRows = (h.topFornecedores || []).map(f => [
    f.fornecedor || '—',
    Number(f.total || 0),
    String(f.count || 0),
  ]);

  // Tabela de distribuição por conta
  const distHeaders = ['Conta', 'Total', '%'];
  const distRows = (h.distribuicaoContas || []).map(d => [
    d.conta || '—',
    Number(d.total || 0),
    `${Number(d.percentual || 0).toFixed(1)}%`,
  ]);

  return `
    <section class="section" id="historico">
      <h2 class="section-title">Histórico PRN</h2>
      <div class="cards-grid">
        <div class="summary-card card-balance">
          <div class="card-label">Total de Registros</div>
          <div class="card-value">${Number(h.totalRecords || 0).toLocaleString('pt-BR')}</div>
        </div>
        <div class="summary-card card-income">
          <div class="card-label">Total Pago</div>
          <div class="card-value">${_formatBRL(h.totalPago || 0)}</div>
        </div>
        <div class="summary-card card-expense">
          <div class="card-label">Total Atrasado</div>
          <div class="card-value">${_formatBRL(h.totalAtrasado || 0)}</div>
        </div>
        <div class="summary-card card-info">
          <div class="card-label">Período</div>
          <div class="card-value" style="font-size:1rem">${periodStart} a ${periodEnd}</div>
        </div>
      </div>
      ${catRows.length > 0 ? `<h3 style="margin-top:1.5rem">Top Categorias</h3>${_buildTable(catHeaders, catRows, 'tbl-hist-cat')}` : ''}
      ${fornRows.length > 0 ? `<h3 style="margin-top:1.5rem">Top Fornecedores</h3>${_buildTable(fornHeaders, fornRows, 'tbl-hist-forn')}` : ''}
      ${distRows.length > 0 ? `<h3 style="margin-top:1.5rem">Distribuição por Conta</h3>${_buildTable(distHeaders, distRows, 'tbl-hist-dist')}` : ''}
    </section>`;
}

/**
 * Seção (j): Warnings — caixas de alerta com cores por severidade.
 */
function _buildWarningsSection(rm) {
  const warnings = rm.warnings || [];
  if (warnings.length === 0) return '';

  const maxWarnings = 40;
  const list = warnings.slice(0, maxWarnings);

  const items = list.map(w => `
    <div class="alert ${_severityClass(w.severity)}">
      <strong>[${_esc(w.code || '')}]</strong> ${_esc(w.message)}
      ${w.context ? `<br><small>${_esc(typeof w.context === 'string' ? w.context : JSON.stringify(w.context))}</small>` : ''}
    </div>`).join('');

  const extra = warnings.length > maxWarnings
    ? `<p style="margin-top:0.8rem;color:#5a6178;font-size:0.9rem">Exibindo ${maxWarnings} de ${warnings.length} avisos.</p>`
    : '';

  return `
    <section class="section" id="avisos">
      <h2 class="section-title">Avisos</h2>
      <div class="alerts-container">${items}</div>
      ${extra}
    </section>`;
}

/**
 * Seção (k): Rodapé com ID, timestamp e link "Voltar".
 */
function _buildFooter(rm) {
  return `
    <footer class="footer">
      <a href="${APP_URL}" class="btn-voltar">&larr; Voltar</a>
      <div class="footer-meta">
        <span>Requisição: ${_esc(rm.requestId)}</span>
        <span>Processado em: ${_nowTimestamp()}</span>
      </div>
    </footer>`;
}

// ---------------------------------------------------------------------------
// CSS inline completo
// ---------------------------------------------------------------------------

const _CSS = `
  /* ---- Reset & Base ---- */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    background: #f0f2f5;
    color: #1a1a2e;
    line-height: 1.6;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  /* ---- Header ---- */
  .header {
    background: linear-gradient(135deg, #1a2a6c, #2d4a9e);
    color: #fff;
    padding: 1.5rem 2rem;
    margin-bottom: 1.5rem;
    border-radius: 8px;
  }
  .header-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
  .header-top h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .header-meta, .header-files {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2rem;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  /* ---- Voltar Button ---- */
  .btn-voltar {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    color: #fff;
    text-decoration: none;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid rgba(255,255,255,0.3);
    transition: background 0.2s;
  }
  .btn-voltar:hover {
    background: rgba(255,255,255,0.25);
  }

  /* ---- Section ---- */
  .section {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .section-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #1a2a6c;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e0e5ec;
  }

  /* ---- Summary Cards Grid ---- */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  .summary-card {
    background: #f8f9fb;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    border-left: 4px solid #ccc;
    transition: box-shadow 0.2s;
  }
  .summary-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .card-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #5a6178;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.4rem;
  }
  .card-value {
    font-size: 1.35rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  /* Card accent borders */
  .card-expense  { border-left-color: #e74c3c; }
  .card-income   { border-left-color: #27ae60; }
  .card-balance  { border-left-color: #2980b9; }
  .card-invest   { border-left-color: #8e44ad; }
  .card-transfer { border-left-color: #e67e22; }
  .card-info     { border-left-color: #5a6178; }
  .card-warning  { border-left-color: #c0392b; }

  /* ---- Entities Grid ---- */
  .entities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }
  .entity-card {
    background: #f8f9fb;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    border: 1px solid #e0e5ec;
  }
  .entity-name {
    font-size: 1rem;
    font-weight: 700;
    color: #1a2a6c;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e0e5ec;
  }
  .entity-row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    font-size: 0.88rem;
  }
  .entity-row span:first-child {
    color: #5a6178;
  }
  .entity-row span:last-child {
    font-weight: 600;
  }

  /* ---- Tables ---- */
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  thead th {
    background: #1a2a6c;
    color: #fff;
    padding: 0.65rem 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    position: relative;
  }
  thead th:hover {
    background: #2d4a9e;
  }
  thead th::after {
    content: ' \\25B2';
    opacity: 0.3;
    font-size: 0.65rem;
    margin-left: 4px;
  }
  tbody tr {
    border-bottom: 1px solid #eee;
    transition: background 0.15s;
  }
  tbody tr:hover {
    background: #f0f4fa;
  }
  tbody td {
    padding: 0.55rem 0.75rem;
    vertical-align: middle;
  }
  tbody td.num {
    text-align: right;
    font-weight: 600;
    white-space: nowrap;
  }

  /* ---- Negative Values ---- */
  .negativo {
    color: #e74c3c;
    font-weight: 600;
  }

  /* ---- Top 10 List ---- */
  .top-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .top-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: #f8f9fb;
    border-radius: 6px;
    border-left: 3px solid #e74c3c;
  }
  .top-rank {
    font-weight: 700;
    font-size: 0.85rem;
    color: #5a6178;
    min-width: 2rem;
  }
  .top-info {
    flex: 1;
  }
  .top-info strong {
    display: block;
    font-size: 0.9rem;
    color: #1a1a2e;
  }
  .top-info small {
    font-size: 0.78rem;
    color: #5a6178;
  }
  .top-value {
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
  }

  /* ---- Alerts / Warnings ---- */
  .alerts-container {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.88rem;
    line-height: 1.5;
  }
  .alert strong {
    margin-right: 0.3rem;
  }
  .alert small {
    opacity: 0.85;
  }
  .warn-info    { background: #d6eaf8; color: #1a5276; border-left: 4px solid #2980b9; }
  .warn-low     { background: #fef9e7; color: #7d6608; border-left: 4px solid #f1c40f; }
  .warn-medium  { background: #fdebd0; color: #935116; border-left: 4px solid #e67e22; }
  .warn-high    { background: #fadbd8; color: #922b21; border-left: 4px solid #e74c3c; }

  /* ---- Footer ---- */
  .footer {
    text-align: center;
    padding: 1.5rem 1rem;
    margin-top: 1rem;
    border-top: 1px solid #d0d5dd;
    color: #5a6178;
    font-size: 0.82rem;
  }
  .footer-meta {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  /* ---- Responsive ---- */
  @media (max-width: 768px) {
    .container { padding: 0.5rem; }
    .header { padding: 1rem; }
    .header-top h1 { font-size: 1.15rem; }
    .section { padding: 1rem; }
    .cards-grid { grid-template-columns: 1fr 1fr; }
    .entities-grid { grid-template-columns: 1fr; }
    table { font-size: 0.78rem; }
    thead th, tbody td { padding: 0.45rem 0.5rem; }
  }
  @media (max-width: 480px) {
    .cards-grid { grid-template-columns: 1fr; }
    .header-meta, .header-files { flex-direction: column; gap: 0.25rem; }
    .top-item { flex-wrap: wrap; }
  }

  /* ---- Print ---- */
  @media print {
    body { background: #fff; color: #000; font-size: 11pt; }
    .container { max-width: 100%; padding: 0; }
    .header {
      background: #1a2a6c !important;
      color: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section {
      box-shadow: none;
      border: 1px solid #ddd;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .btn-voltar { display: none !important; }
    .summary-card, .entity-card, .alert {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { font-size: 9pt; }
    .top-item:hover, tbody tr:hover { background: transparent; }
    .negativo { color: #000 !important; text-decoration: underline; }
    .footer { border-top: 1px solid #000; }
  }
`;

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Converte o modelo do relatório financeiro PRN em uma página HTML completa.
 *
 * @param {object} reportModel — objeto retornado por buildReportModel()
 * @returns {string} HTML completo da página
 */
function renderReportHTML(reportModel) {
  const rm = reportModel || {};

  const sections = [
    _buildHeader(rm),
    _buildSummaryCards(rm),
    _buildCrossAnalysisSection(rm),
    _buildEntitiesSection(rm),
    _buildDespesasTable(rm),
    _buildRecebidosTable(rm),
    _buildTopDespesas(rm),
    _buildDespesasPorCategoria(rm),
    _buildRecebidosPorConta(rm),
    _buildHistoricoSection(rm),
    _buildWarningsSection(rm),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Financeiro PRN — ${_esc(rm.referenceDateUsed || '')}</title>
  <style>${_CSS}</style>
</head>
<body>
  <div class="container">
    ${sections}
    ${_buildFooter(rm)}
  </div>

  <script>
  // ---- Client-side sortable tables (no dependencies) ----
  (function() {
    document.querySelectorAll('table[id]').forEach(function(table) {
      var headers = table.querySelectorAll('thead th');
      var tbody = table.querySelector('tbody');
      var rows = Array.from(tbody.querySelectorAll('tr'));
      var asc = {};

      headers.forEach(function(th, colIdx) {
        th.addEventListener('click', function() {
          asc[colIdx] = !asc[colIdx];
          var dir = asc[colIdx] ? 1 : -1;

          rows.sort(function(a, b) {
            var aVal = a.cells[colIdx].textContent.trim();
            var bVal = b.cells[colIdx].textContent.trim();

            // Attempt numeric sort for columns with R$ prefix
            var aNum = parseFloat(aVal.replace(/[^0-9\\-.,]/g, '').replace('.', '').replace(',', '.'));
            var bNum = parseFloat(bVal.replace(/[^0-9\\-.,]/g, '').replace('.', '').replace(',', '.'));

            if (!isNaN(aNum) && !isNaN(bNum)) {
              return (aNum - bNum) * dir;
            }
            // Attempt date sort (DD/MM/YYYY)
            var aDate = Date.parse(aVal.split('/').reverse().join('-'));
            var bDate = Date.parse(bVal.split('/').reverse().join('-'));
            if (!isNaN(aDate) && !isNaN(bDate)) {
              return (aDate - bDate) * dir;
            }
            // String sort
            return aVal.localeCompare(bVal, 'pt-BR') * dir;
          });

          rows.forEach(function(row) { tbody.appendChild(row); });

          // Update sort indicators
          headers.forEach(function(h) { h.style.opacity = '1'; h.style.borderBottom = ''; });
          th.style.borderBottom = dir === 1 ? '2px solid #27ae60' : '2px solid #e74c3c';
        });
      });
    });
  })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { renderReportHTML };
