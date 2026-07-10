// ============================================================
// BO.OPS — interações + ferramentas interativas
// ============================================================

(function() {
  'use strict';

  // ============================================================
  // CORE: tema, copiar código, scroll spy, smooth scroll
  // ============================================================

  const themeBtn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const THEME_KEY = 'bo-ops-theme';

  function applyTheme(t) {
    if (t === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }

  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') applyTheme('light');

  themeBtn && themeBtn.addEventListener('click', function() {
    const current = root.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });

  // copiar código
  document.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      const target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      const text = target.innerText;
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = '✓ copiado';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        btn.textContent = '✓ copiado';
        setTimeout(() => btn.textContent = 'copiar', 1800);
      }
    });
  });

  // scroll spy
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const sections = navLinks
    .map(a => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      return el ? { link: a, el: el } : null;
    })
    .filter(Boolean);

  function onScroll() {
    const y = window.scrollY + 120;
    // ignora seções de tabs ocultas (offsetParent null), senão elas
    // "roubariam" o destaque com offsetTop = 0
    const visiveis = sections.filter(s => s.el.offsetParent !== null);
    let active = visiveis[0];
    visiveis.forEach(s => { if (s.el.offsetTop <= y) active = s; });
    navLinks.forEach(a => a.classList.remove('active'));
    if (active) active.link.classList.add('active');
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  onScroll();

  // smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = window.innerWidth <= 768 ? 100 : 24;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  // ============================================================
  // FORMATADORES
  // ============================================================
  const fmtBR = (n, decimals = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const fmtMi = n => 'R$ ' + fmtBR(n / 1_000_000) + ' mi';
  const fmtPct = (n, decimals = 2) => (n >= 0 ? '+' : '') + fmtBR(n * 100, decimals) + '%';
  const fmtMoney = n => 'R$ ' + fmtBR(n);

  // ============================================================
  // TOOL 1 — CALCULADORA DE PRAZOS DE LIQUIDAÇÃO
  // ============================================================

  // Feriados nacionais 2026 + datas sem pregão na B3
  const FERIADOS_FIXOS = [
    '2026-01-01', // Confraternização Universal
    '2026-04-21', // Tiradentes
    '2026-05-01', // Dia do Trabalho
    '2026-09-07', // Independência
    '2026-10-12', // N. Sra. Aparecida
    '2026-11-02', // Finados
    '2026-11-15', // Proclamação da República
    '2026-11-20', // Consciência Negra (federal desde 2024)
    '2026-12-25', // Natal
    // móveis 2026 (Páscoa = 5/abr/2026)
    '2026-02-16', '2026-02-17', // Carnaval
    '2026-04-03', // Sexta-feira santa
    '2026-06-04', // Corpus Christi
    // sem pregão B3:
    '2026-12-24', '2026-12-31',
  ];
  const FERIADOS = new Set(FERIADOS_FIXOS);

  function isDiaUtil(d) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return !FERIADOS.has(`${yyyy}-${mm}-${dd}`);
  }

  function addDiasUteis(dataISO, n) {
    const d = new Date(dataISO + 'T12:00:00');
    let restantes = n;
    while (restantes > 0) {
      d.setDate(d.getDate() + 1);
      if (isDiaUtil(d)) restantes--;
    }
    return d;
  }

  function nomeDiaSemana(d) {
    return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
  }

  function fmtDataExt(d) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  }

  const liqAtivo = document.getElementById('liq-ativo');
  const liqData = document.getElementById('liq-data');
  const liqCalc = document.getElementById('liq-calc');
  const liqResult = document.getElementById('liq-result');

  if (liqAtivo && liqData && liqCalc) {
    liqData.value = '2026-04-28';

    function calcLiq() {
      if (!liqData.value) return;
      const dPlus = parseInt(liqAtivo.selectedOptions[0].dataset.d, 10);
      const d0 = new Date(liqData.value + 'T12:00:00');
      const dn = dPlus === 0 ? d0 : addDiasUteis(liqData.value, dPlus);

      document.getElementById('liq-d0').textContent = fmtDataExt(d0);
      document.getElementById('liq-d0-sub').textContent =
        nomeDiaSemana(d0) + (isDiaUtil(d0) ? '' : ' · ⚠ não é dia útil');
      document.getElementById('liq-dn').textContent = fmtDataExt(dn);
      document.getElementById('liq-dn-sub').textContent =
        nomeDiaSemana(dn) + ' · D+' + dPlus;

      const ativoTxt = liqAtivo.selectedOptions[0].textContent;
      const camara = {
        'acao': 'B3 (Câmara BM&FBOVESPA)',
        'opcao': 'B3', 'futuro': 'B3 — ajuste diário',
        'etf': 'B3', 'bdr': 'B3',
        'lft': 'Selic (Banco Central)', 'ltn': 'Selic (Banco Central)',
        'ntnb': 'Selic (Banco Central)',
        'cdb': 'B3 (antiga Cetip)', 'deb': 'B3 (antiga Cetip)',
        'cambio': 'B3 / SPB (STR é o trilho do dinheiro)'
      }[liqAtivo.value];

      let aviso = '';
      if (!isDiaUtil(d0)) {
        aviso = '<br><br>⚠ <strong>Atenção:</strong> a data informada não é dia útil. Operações executadas em D+0 só ocorrem em dias com pregão.';
      }

      document.getElementById('liq-info').innerHTML =
        '<strong>Câmara de liquidação:</strong> ' + camara +
        '<br><strong>Operação:</strong> ' + ativoTxt + aviso;

      liqResult.hidden = false;
    }

    liqCalc.addEventListener('click', calcLiq);
    liqAtivo.addEventListener('change', () => { if (!liqResult.hidden) calcLiq(); });
    liqData.addEventListener('change', () => { if (!liqResult.hidden) calcLiq(); });
  }

  // ============================================================
  // TOOL 2 — SIMULADOR DE CENÁRIOS (what-if no PL)
  // ============================================================

  // Cada fundo tem PL base e exposições (% do PL) por ativo.
  // O resto do PL (1 - soma das exposições) representa renda fixa, caixa, outros
  // — invariantes na simulação.
  const FUNDOS_BASE = [
    { nome: 'ALPHA_LONG_BIAS_FIM',    pl: 15_518_891.55, exp: { PETR4: 0.18, VALE3: 0.15, ITUB4: 0.08, BBDC4: 0.05, WEGE3: 0.10, MGLU3: 0.06 } },
    { nome: 'ALPHA_MULTIMERCADO_FIM', pl: 10_671_391.30, exp: { PETR4: 0.10, VALE3: 0.12, ITUB4: 0.15, BBDC4: 0.08, WEGE3: 0.05, MGLU3: 0.03 } },
    { nome: 'ALPHA_RF_FIRF',          pl:  8_648_656.70, exp: { PETR4: 0.02, VALE3: 0.02, ITUB4: 0.05, BBDC4: 0.04, WEGE3: 0.02, MGLU3: 0.01 } },
    { nome: 'ALPHA_ACOES_FIA',        pl:  8_137_548.60, exp: { PETR4: 0.22, VALE3: 0.18, ITUB4: 0.14, BBDC4: 0.10, WEGE3: 0.12, MGLU3: 0.08 } },
    { nome: 'ALPHA_DIVIDENDOS_FIA',   pl:  6_792_724.20, exp: { PETR4: 0.08, VALE3: 0.06, ITUB4: 0.20, BBDC4: 0.18, WEGE3: 0.04, MGLU3: 0.02 } },
  ];

  const ATIVOS_SIM = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'MGLU3'];

  // estado: variação % por ativo
  const simState = {};
  ATIVOS_SIM.forEach(a => simState[a] = 0);

  function simRecalc() {
    let plSimuladoTotal = 0;
    let plOriginalTotal = 0;
    const linhas = [];

    FUNDOS_BASE.forEach(f => {
      let deltaPct = 0;
      ATIVOS_SIM.forEach(a => {
        deltaPct += (f.exp[a] || 0) * (simState[a] / 100);
      });
      const plNovo = f.pl * (1 + deltaPct);
      plSimuladoTotal += plNovo;
      plOriginalTotal += f.pl;
      linhas.push({
        nome: f.nome,
        plOrig: f.pl,
        plNovo: plNovo,
        deltaR: plNovo - f.pl,
        deltaP: deltaPct,
      });
    });

    const variacao = plSimuladoTotal - plOriginalTotal;
    const variacaoPct = variacao / plOriginalTotal;

    const elPL = document.getElementById('sim-pl');
    if (!elPL) return;
    const elPLDelta = document.getElementById('sim-pl-delta');
    const elVar = document.getElementById('sim-var');
    const elVarDelta = document.getElementById('sim-var-delta');
    const elWorst = document.getElementById('sim-worst');
    const elWorstD = document.getElementById('sim-worst-delta');

    elPL.textContent = fmtMi(plSimuladoTotal);
    elPL.style.color = variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg)';
    elPLDelta.textContent = (variacao >= 0 ? '+' : '') + fmtMoney(variacao) + ' vs original';
    elPLDelta.className = 'sim-kpi__delta ' + (variacao > 0 ? 'up' : variacao < 0 ? 'dn' : '');

    elVar.textContent = (variacao >= 0 ? '+' : '') + fmtMoney(variacao);
    elVarDelta.textContent = fmtPct(variacaoPct, 4);
    elVarDelta.className = 'sim-kpi__delta ' + (variacao > 0 ? 'up' : variacao < 0 ? 'dn' : '');

    const maisImpactado = linhas.reduce((acc, l) =>
      Math.abs(l.deltaP) > Math.abs(acc.deltaP) ? l : acc, linhas[0]);
    elWorst.textContent = maisImpactado.nome.replace('ALPHA_', '');
    elWorstD.textContent = fmtPct(maisImpactado.deltaP, 3);
    elWorstD.className = 'sim-kpi__delta ' + (maisImpactado.deltaP > 0 ? 'up' : maisImpactado.deltaP < 0 ? 'dn' : '');

    document.getElementById('sim-rows').innerHTML = linhas.map(l => `
      <div class="sim-row">
        <div>${l.nome.replace('ALPHA_', '')}</div>
        <div>${fmtMi(l.plOrig)}</div>
        <div>${fmtMi(l.plNovo)}</div>
        <div class="${l.deltaR > 0 ? 'delta-pos' : l.deltaR < 0 ? 'delta-neg' : ''}">${(l.deltaR >= 0 ? '+' : '')}${fmtMoney(l.deltaR)}</div>
        <div class="${l.deltaP > 0 ? 'delta-pos' : l.deltaP < 0 ? 'delta-neg' : ''}">${fmtPct(l.deltaP, 3)}</div>
      </div>
    `).join('');
  }

  document.querySelectorAll('.sim-slider').forEach(sl => {
    const ativo = sl.dataset.asset;
    const range = sl.querySelector('.sim-range');
    const val = sl.querySelector('.sim-slider__val');
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      simState[ativo] = v;
      val.textContent = (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
      val.style.color = v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--accent)';
      simRecalc();
    });
  });

  function aplicarPreset(preset) {
    const presets = {
      bull: { PETR4: 5, VALE3: 5, ITUB4: 5, BBDC4: 5, WEGE3: 5, MGLU3: 5 },
      bear: { PETR4: -10, VALE3: -10, ITUB4: -10, BBDC4: -10, WEGE3: -10, MGLU3: -10 },
      commod: { PETR4: 8, VALE3: 12, ITUB4: -2, BBDC4: -2, WEGE3: -3, MGLU3: -5 },
      zero: { PETR4: 0, VALE3: 0, ITUB4: 0, BBDC4: 0, WEGE3: 0, MGLU3: 0 },
    };
    const p = presets[preset];
    if (!p) return;
    document.querySelectorAll('.sim-slider').forEach(sl => {
      const a = sl.dataset.asset;
      const range = sl.querySelector('.sim-range');
      const val = sl.querySelector('.sim-slider__val');
      simState[a] = p[a];
      range.value = p[a];
      val.textContent = (p[a] >= 0 ? '+' : '') + p[a].toFixed(2) + '%';
      val.style.color = p[a] > 0 ? 'var(--green)' : p[a] < 0 ? 'var(--red)' : 'var(--accent)';
    });
    simRecalc();
  }

  document.querySelectorAll('.sim-preset').forEach(b => {
    b.addEventListener('click', () => aplicarPreset(b.dataset.preset));
  });
  document.querySelectorAll('[data-reset="sim"]').forEach(b => {
    b.addEventListener('click', () => aplicarPreset('zero'));
  });

  if (document.getElementById('sim-rows')) simRecalc();

  // ============================================================
  // TOOL 3 — EDITOR DE BOLETAS COM CASAMENTO AO VIVO
  // ============================================================

  const FUNDOS_OPC = [
    'ALPHA_LONG_BIAS_FIM', 'ALPHA_MULTIMERCADO_FIM', 'ALPHA_RF_FIRF',
    'ALPHA_ACOES_FIA', 'ALPHA_DIVIDENDOS_FIA'
  ];
  const ATIVOS_OPC = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'MGLU3', 'BBAS3', 'B3SA3', 'LFT_2029', 'NTNB_2035'];

  const BOLETAS_INICIAIS = [
    { id: 10001, fundo: 'ALPHA_LONG_BIAS_FIM',    ativo: 'LFT_2029',      lado: 'V', qtdM: 10,    prM: 14462.91, qtdC: 10,    prC: 14462.91 },
    { id: 10002, fundo: 'ALPHA_LONG_BIAS_FIM',    ativo: 'DEB_VALE_2030', lado: 'C', qtdM: 5,     prM: 1120.91,  qtdC: 5,     prC: 1120.91 },
    { id: 10003, fundo: 'ALPHA_MULTIMERCADO_FIM', ativo: 'NTNB_2035',     lado: 'C', qtdM: 50,    prM: 4165.90,  qtdC: 50,    prC: 4165.90 },
    { id: 10004, fundo: 'ALPHA_LONG_BIAS_FIM',    ativo: 'MGLU3',         lado: 'C', qtdM: 5000,  prM: 9.01,     qtdC: 5100,  prC: 9.01 },
    { id: 10005, fundo: 'ALPHA_RF_FIRF',          ativo: 'BBDC4',         lado: 'V', qtdM: 1000,  prM: 16.68,    qtdC: 1000,  prC: 16.68 },
    { id: 10006, fundo: 'ALPHA_RF_FIRF',          ativo: 'WEGE3',         lado: 'C', qtdM: 5000,  prM: 41.35,    qtdC: 5000,  prC: 41.35 },
    { id: 10009, fundo: 'ALPHA_RF_FIRF',          ativo: 'B3SA3',         lado: 'C', qtdM: 200,   prM: 12.39,    qtdC: 200,   prC: 12.44 },
    { id: 10015, fundo: 'ALPHA_MULTIMERCADO_FIM', ativo: 'ITUB4',         lado: 'C', qtdM: 500,   prM: 33.66,    qtdC: 500,   prC: 33.66 },
    { id: 10017, fundo: 'ALPHA_ACOES_FIA',        ativo: 'PETR4',         lado: 'C', qtdM: 2000,  prM: 38.45,    qtdC: null,  prC: null },
    { id: 10022, fundo: 'ALPHA_DIVIDENDOS_FIA',   ativo: 'BBDC4',         lado: 'C', qtdM: 5000,  prM: 17.10,    qtdC: 5000,  prC: 17.10 },
  ];

  const TOL_PRECO = 0.001;
  let boletas = [];
  let nextId = 99000;

  function statusBoleta(b) {
    if (b.qtdC == null && b.prC == null) return 'falt';
    if (b.qtdM == null && b.prM == null) return 'falt';
    if (b.qtdM !== b.qtdC) return 'div';
    if (b.prM === 0 || b.prC === 0) return 'div';
    const diff = Math.abs((b.prC - b.prM) / b.prM);
    return diff > TOL_PRECO ? 'div' : 'ok';
  }

  function renderBoletas(flashId = null) {
    const tbody = document.getElementById('edit-rows');
    if (!tbody) return;

    let okCount = 0, divCount = 0, faltCount = 0;

    tbody.innerHTML = boletas.map(b => {
      const st = statusBoleta(b);
      if (st === 'ok') okCount++;
      else if (st === 'div') divCount++;
      else faltCount++;

      const stCls = 'is-' + st;
      const stTxt = st === 'ok' ? 'OK' : st === 'div' ? 'DIVERGENTE' : 'FALTA';
      const flashCls = (flashId === b.id) ? ' flash' : '';

      const qtdC = b.qtdC == null
        ? '<span style="color:var(--fg-3)">—</span>'
        : `<input type="number" class="edit-input" data-id="${b.id}" data-field="qtdC" value="${b.qtdC}" step="1" min="0">`;
      const prC = b.prC == null
        ? '<span style="color:var(--fg-3)">—</span>'
        : `<input type="number" class="edit-input" data-id="${b.id}" data-field="prC" value="${b.prC}" step="0.01" min="0">`;

      return `
        <div class="edit-row ${stCls}${flashCls}">
          <div>${b.id}</div>
          <div>${b.fundo.replace('ALPHA_', '')}</div>
          <div>${b.ativo}</div>
          <div>${b.lado}</div>
          <div><input type="number" class="edit-input" data-id="${b.id}" data-field="qtdM" value="${b.qtdM ?? ''}" step="1" min="0"></div>
          <div><input type="number" class="edit-input" data-id="${b.id}" data-field="prM" value="${b.prM ?? ''}" step="0.01" min="0"></div>
          <div>${qtdC}</div>
          <div>${prC}</div>
          <div class="edit-status edit-status--${st}">${stTxt}</div>
          <div><button class="edit-del" data-del="${b.id}" title="Remover">×</button></div>
        </div>
      `;
    }).join('');

    document.getElementById('edit-ok').textContent = okCount;
    document.getElementById('edit-div').textContent = divCount;
    document.getElementById('edit-falt').textContent = faltCount;
    document.getElementById('edit-total').textContent = boletas.length;

    tbody.querySelectorAll('.edit-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = parseInt(inp.dataset.id, 10);
        const field = inp.dataset.field;
        const v = inp.value === '' ? null : parseFloat(inp.value);
        const b = boletas.find(x => x.id === id);
        if (b) {
          b[field] = v;
          updateRowStatus(id);
          updateCounters();
        }
      });
    });

    tbody.querySelectorAll('.edit-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.del, 10);
        boletas = boletas.filter(b => b.id !== id);
        renderBoletas();
      });
    });
  }

  // atualização leve: muda só classe da row e o badge — preserva foco no input
  function updateRowStatus(id) {
    const b = boletas.find(x => x.id === id);
    if (!b) return;
    const st = statusBoleta(b);
    const inp = document.querySelector(`.edit-row [data-id="${id}"]`);
    if (!inp) return;
    const row = inp.closest('.edit-row');
    if (!row) return;
    row.classList.remove('is-ok', 'is-div', 'is-falt');
    row.classList.add('is-' + st);
    const badge = row.querySelector('.edit-status');
    if (badge) {
      badge.classList.remove('edit-status--ok', 'edit-status--div', 'edit-status--falt');
      badge.classList.add('edit-status--' + st);
      badge.textContent = st === 'ok' ? 'OK' : st === 'div' ? 'DIVERGENTE' : 'FALTA';
    }
  }

  function updateCounters() {
    let ok = 0, div = 0, falt = 0;
    boletas.forEach(b => {
      const s = statusBoleta(b);
      if (s === 'ok') ok++;
      else if (s === 'div') div++;
      else falt++;
    });
    const e = id => document.getElementById(id);
    if (e('edit-ok')) e('edit-ok').textContent = ok;
    if (e('edit-div')) e('edit-div').textContent = div;
    if (e('edit-falt')) e('edit-falt').textContent = falt;
    if (e('edit-total')) e('edit-total').textContent = boletas.length;
  }

  function resetBoletas() {
    boletas = JSON.parse(JSON.stringify(BOLETAS_INICIAIS));
    nextId = 99000;
    renderBoletas();
  }

  const editAdd = document.getElementById('edit-add');
  if (editAdd) {
    editAdd.addEventListener('click', () => {
      const id = nextId++;
      const fundo = FUNDOS_OPC[Math.floor(Math.random() * FUNDOS_OPC.length)];
      const ativo = ATIVOS_OPC[Math.floor(Math.random() * ATIVOS_OPC.length)];
      const lado = Math.random() > 0.5 ? 'C' : 'V';
      // boleta nova entra como FALTA — mesa registrou, corretora ainda não enviou
      boletas.push({
        id, fundo, ativo, lado,
        qtdM: 1000, prM: 10.00,
        qtdC: null, prC: null,
      });
      renderBoletas(id);
    });
  }

  document.querySelectorAll('[data-reset="edit"]').forEach(b => {
    b.addEventListener('click', resetBoletas);
  });

  if (document.getElementById('edit-rows')) resetBoletas();


  // ============================================================
  // ENGINE DE COTAÇÕES — random walk compartilhado
  // ============================================================

  const ATIVOS_MERCADO = [
    { sym: 'PETR4', nome: 'Petrobras PN',     setor: 'Petróleo',    base: 38.45, vol: 0.018 },
    { sym: 'VALE3', nome: 'Vale ON',          setor: 'Mineração',   base: 67.20, vol: 0.020 },
    { sym: 'ITUB4', nome: 'Itaú PN',          setor: 'Bancos',      base: 34.10, vol: 0.012 },
    { sym: 'BBDC4', nome: 'Bradesco PN',      setor: 'Bancos',      base: 16.85, vol: 0.014 },
    { sym: 'ABEV3', nome: 'Ambev ON',         setor: 'Bebidas',     base: 13.40, vol: 0.011 },
    { sym: 'WEGE3', nome: 'Weg ON',           setor: 'Indústria',   base: 41.55, vol: 0.013 },
    { sym: 'BBAS3', nome: 'Banco do Brasil',  setor: 'Bancos',      base: 28.70, vol: 0.013 },
    { sym: 'B3SA3', nome: 'B3 ON',            setor: 'Financeiro',  base: 12.30, vol: 0.015 },
    { sym: 'MGLU3', nome: 'Magazine Luiza',   setor: 'Varejo',      base:  8.95, vol: 0.030 },
    { sym: 'RENT3', nome: 'Localiza ON',      setor: 'Locação',     base: 56.40, vol: 0.016 },
  ];

  const market = {};
  ATIVOS_MERCADO.forEach(a => {
    market[a.sym] = {
      sym: a.sym, nome: a.nome, setor: a.setor,
      price: a.base, prevPrice: a.base, dayOpen: a.base, vol: a.vol,
      history: [a.base],
    };
  });

  const subscribers = [];
  function subscribe(fn) { subscribers.push(fn); }

  function tickPrices() {
    Object.values(market).forEach(a => {
      // Box-Muller pra ruído gaussiano
      const u = Math.random(), v = Math.random();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      const drift = 0.00005;     // drift levemente positivo
      const change = drift + a.vol * 0.12 * z;
      a.prevPrice = a.price;
      a.price = Math.max(0.5, a.price * (1 + change));
      a.history.push(a.price);
      if (a.history.length > 40) a.history.shift();
    });
    subscribers.forEach(fn => { try { fn(market); } catch(e) { console.error(e); } });
  }

  // só inicia o tick se a página tiver alguma seção que precise dele
  const needsTicks = document.getElementById('market-board-grid') ||
                     document.getElementById('bk-quotes');
  if (needsTicks) {
    setInterval(tickPrices, 4000);
  }

  // ============================================================
  // SEÇÃO MERCADO — quadro de cotações simulado
  // ============================================================

  const marketBoard = document.getElementById('market-board-grid');
  const lastBoardPrices = {};

  function renderMarketBoard(flashMap) {
    if (!marketBoard) return;
    marketBoard.innerHTML = ATIVOS_MERCADO.map(a => {
      const m = market[a.sym];
      const v = (m.price - m.dayOpen) / m.dayOpen;
      const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '·';
      const cls = v > 0 ? 'up' : v < 0 ? 'dn' : '';
      let flashCls = '';
      if (flashMap && flashMap[a.sym] != null) {
        if (m.price > flashMap[a.sym]) flashCls = 'flash-up';
        else if (m.price < flashMap[a.sym]) flashCls = 'flash-dn';
      }
      return `
        <div class="mb-cell">
          <div class="mb-cell__name">${m.sym}</div>
          <div class="mb-cell__val ${cls} ${flashCls}">${fmtBR(m.price)}</div>
          <div class="mb-cell__delta ${cls}">${arrow} ${fmtPct(v, 2)}</div>
        </div>
      `;
    }).join('');
  }

  if (marketBoard) {
    renderMarketBoard(null);
    Object.values(market).forEach(m => lastBoardPrices[m.sym] = m.price);
    subscribe(() => {
      renderMarketBoard(lastBoardPrices);
      Object.values(market).forEach(m => lastBoardPrices[m.sym] = m.price);
    });
  }

  // ============================================================
  // HOME BROKER — simulador de carteira
  // ============================================================

  const BROKER_INIT_CASH = 100_000;

  let broker = {
    cash: BROKER_INIT_CASH,
    positions: {},   // sym → { qtd, avgPrice }
    history: [],     // {ts, side, sym, qtd, price, total}
    selectedSym: null,
    orderSide: 'C',
  };

  // ----- elementos -----
  const elQuotes = document.getElementById('bk-quotes');
  const elOrder = document.getElementById('bk-order');
  const elOrderTicker = document.getElementById('bk-order-ticker');
  const elOrderPrice = document.getElementById('bk-order-price');
  const elOrderQtd = document.getElementById('bk-order-qtd');
  const elOrderFin = document.getElementById('bk-order-fin');
  const elOrderAfter = document.getElementById('bk-order-after');
  const elOrderConfirm = document.getElementById('bk-order-confirm');
  const elOrderMsg = document.getElementById('bk-order-msg');
  const elOrderClose = document.getElementById('bk-order-close');
  const elPortfolio = document.getElementById('bk-portfolio');
  const elHistory = document.getElementById('bk-history');
  const elCash = document.getElementById('bk-cash');
  const elStocks = document.getElementById('bk-stocks');
  const elTotal = document.getElementById('bk-total');
  const elPnl = document.getElementById('bk-pnl');
  const elPnlPct = document.getElementById('bk-pnl-pct');

  // ----- sparkline pra cada ativo -----
  function sparkline(history, width = 70, height = 24) {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const last = history[history.length - 1];
    const first = history[0];
    const color = last >= first ? 'var(--green)' : 'var(--red)';
    const points = history.map((p, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="bk-quote__spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" />
    </svg>`;
  }

  // ----- render do quadro do broker -----
  function renderBrokerQuotes(flashMap) {
    if (!elQuotes) return;
    elQuotes.innerHTML = ATIVOS_MERCADO.map(a => {
      const m = market[a.sym];
      const v = (m.price - m.dayOpen) / m.dayOpen;
      const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '·';
      const cls = v > 0 ? 'up' : v < 0 ? 'dn' : '';
      let priceCls = cls;
      if (flashMap && flashMap[a.sym] != null) {
        if (m.price > flashMap[a.sym]) priceCls = 'up';
        else if (m.price < flashMap[a.sym]) priceCls = 'dn';
      }
      const isSelected = broker.selectedSym === a.sym ? 'is-selected' : '';
      return `
        <div class="bk-quote ${isSelected}" data-sym="${a.sym}">
          <div class="bk-quote__ticker">${a.sym}</div>
          <div class="bk-quote__name">${a.nome}</div>
          <div class="bk-quote__price ${priceCls}">${fmtBR(m.price)}</div>
          <div class="bk-quote__delta ${cls}">${arrow}${fmtPct(v, 2)}</div>
          ${sparkline(m.history)}
        </div>
      `;
    }).join('');

    // bind cliques
    elQuotes.querySelectorAll('.bk-quote').forEach(el => {
      el.addEventListener('click', () => {
        broker.selectedSym = el.dataset.sym;
        broker.orderSide = 'C';
        showOrderPanel();
        renderBrokerQuotes(); // pra atualizar a seleção visual
      });
    });
  }

  function showOrderPanel() {
    if (!elOrder || !broker.selectedSym) return;
    const m = market[broker.selectedSym];
    elOrderTicker.textContent = broker.selectedSym;
    elOrderPrice.textContent = 'R$ ' + fmtBR(m.price);
    elOrder.hidden = false;

    // tabs
    elOrder.querySelectorAll('.bk-order__tab').forEach(t => {
      t.classList.toggle('bk-order__tab--active', t.dataset.side === broker.orderSide);
    });
    updateOrderTotals();
  }

  function updateOrderTotals() {
    if (!elOrderQtd || !broker.selectedSym) return;
    const qtd = parseInt(elOrderQtd.value, 10) || 0;
    const m = market[broker.selectedSym];
    const fin = qtd * m.price;
    elOrderFin.textContent = 'R$ ' + fmtBR(fin);

    const afterCash = broker.orderSide === 'C'
      ? broker.cash - fin
      : broker.cash + fin;
    elOrderAfter.textContent = 'R$ ' + fmtBR(afterCash);
    elOrderAfter.classList.toggle('dn', afterCash < 0);

    // botão de confirmar
    const isBuy = broker.orderSide === 'C';
    elOrderConfirm.textContent = isBuy ? 'Confirmar compra' : 'Confirmar venda';
    elOrderConfirm.classList.toggle('is-sell', !isBuy);

    // validação
    let invalid = false, msg = '';
    if (qtd <= 0) { invalid = true; msg = ''; }
    else if (isBuy && fin > broker.cash) { invalid = true; msg = '⚠ Saldo insuficiente'; }
    else if (!isBuy) {
      const pos = broker.positions[broker.selectedSym];
      if (!pos || pos.qtd < qtd) { invalid = true; msg = '⚠ Você não tem essa quantidade'; }
    }
    elOrderConfirm.disabled = invalid;
    elOrderMsg.textContent = msg;
    elOrderMsg.className = 'bk-order__msg' + (msg ? ' err' : '');
  }

  function executeOrder() {
    if (!broker.selectedSym) return;
    const qtd = parseInt(elOrderQtd.value, 10) || 0;
    const m = market[broker.selectedSym];
    const price = m.price;
    const fin = qtd * price;
    const isBuy = broker.orderSide === 'C';

    if (isBuy) {
      if (fin > broker.cash) return;
      broker.cash -= fin;
      const pos = broker.positions[broker.selectedSym];
      if (pos) {
        // preço médio ponderado
        const newQtd = pos.qtd + qtd;
        const newAvg = (pos.qtd * pos.avgPrice + fin) / newQtd;
        broker.positions[broker.selectedSym] = { qtd: newQtd, avgPrice: newAvg };
      } else {
        broker.positions[broker.selectedSym] = { qtd, avgPrice: price };
      }
    } else {
      const pos = broker.positions[broker.selectedSym];
      if (!pos || pos.qtd < qtd) return;
      broker.cash += fin;
      pos.qtd -= qtd;
      if (pos.qtd === 0) delete broker.positions[broker.selectedSym];
    }

    broker.history.unshift({
      ts: new Date(),
      side: broker.orderSide,
      sym: broker.selectedSym,
      qtd, price,
      total: fin,
    });
    if (broker.history.length > 50) broker.history.pop();

    elOrderMsg.textContent = '✓ Ordem executada com sucesso';
    elOrderMsg.className = 'bk-order__msg ok';
    setTimeout(() => { elOrderMsg.textContent = ''; elOrderMsg.className = 'bk-order__msg'; }, 2500);

    renderBrokerAll();
  }

  function renderPortfolio() {
    if (!elPortfolio) return;
    const syms = Object.keys(broker.positions);
    if (syms.length === 0) {
      elPortfolio.innerHTML = '<div class="bk-empty">Você ainda não tem ações. Clique em algum papel à esquerda pra começar.</div>';
      return;
    }
    let rows = `
      <div class="bk-pos bk-pos--head">
        <div>TICKER</div><div>QTD</div><div>PREÇO MÉDIO</div><div>PREÇO ATUAL</div><div>P&L</div>
      </div>
    `;
    syms.forEach(sym => {
      const pos = broker.positions[sym];
      const m = market[sym];
      const valor = pos.qtd * m.price;
      const custo = pos.qtd * pos.avgPrice;
      const pnl = valor - custo;
      const pnlPct = pnl / custo;
      const cls = pnl > 0 ? 'up' : pnl < 0 ? 'dn' : '';
      rows += `
        <div class="bk-pos">
          <div>${sym}</div>
          <div>${pos.qtd}</div>
          <div>${fmtBR(pos.avgPrice)}</div>
          <div>${fmtBR(m.price)}</div>
          <div class="bk-pos__pnl ${cls}">${pnl >= 0 ? '+' : ''}${fmtBR(pnl)} (${fmtPct(pnlPct, 2)})</div>
        </div>
      `;
    });
    elPortfolio.innerHTML = rows;
  }

  function renderHistory() {
    if (!elHistory) return;
    if (broker.history.length === 0) {
      elHistory.innerHTML = '<div class="bk-empty">Nenhuma ordem executada.</div>';
      return;
    }
    elHistory.innerHTML = broker.history.map(h => {
      const time = `${String(h.ts.getHours()).padStart(2,'0')}:${String(h.ts.getMinutes()).padStart(2,'0')}:${String(h.ts.getSeconds()).padStart(2,'0')}`;
      const sideCls = h.side === 'C' ? 'c' : 'v';
      const sideTxt = h.side === 'C' ? 'C' : 'V';
      return `
        <div class="bk-hrow">
          <div class="bk-hrow__time">${time}</div>
          <div class="bk-hrow__side ${sideCls}">${sideTxt}</div>
          <div class="bk-hrow__ticker">${h.sym}</div>
          <div class="bk-hrow__qtd">${h.qtd}×</div>
          <div class="bk-hrow__total">R$ ${fmtBR(h.total)}</div>
        </div>
      `;
    }).join('');
  }

  function renderHeader() {
    if (!elCash) return;
    let stocksValue = 0;
    Object.entries(broker.positions).forEach(([sym, pos]) => {
      stocksValue += pos.qtd * market[sym].price;
    });
    const total = broker.cash + stocksValue;
    const pnl = total - BROKER_INIT_CASH;
    const pnlPct = pnl / BROKER_INIT_CASH;

    elCash.textContent = 'R$ ' + fmtBR(broker.cash);
    elStocks.textContent = 'R$ ' + fmtBR(stocksValue);
    elTotal.textContent = 'R$ ' + fmtBR(total);

    elPnl.textContent = (pnl >= 0 ? '+' : '') + 'R$ ' + fmtBR(pnl);
    elPnl.classList.remove('up', 'dn');
    if (pnl > 0) elPnl.classList.add('up');
    else if (pnl < 0) elPnl.classList.add('dn');

    elPnlPct.textContent = fmtPct(pnlPct, 2);
    elPnlPct.classList.remove('up', 'dn');
    if (pnl > 0) elPnlPct.classList.add('up');
    else if (pnl < 0) elPnlPct.classList.add('dn');
  }

  function renderBrokerAll() {
    renderBrokerQuotes();
    renderPortfolio();
    renderHistory();
    renderHeader();
    if (broker.selectedSym && elOrder && !elOrder.hidden) {
      // atualizar painel de ordem com preço novo
      elOrderPrice.textContent = 'R$ ' + fmtBR(market[broker.selectedSym].price);
      updateOrderTotals();
    }
  }

  // ----- bindings do broker -----
  if (elQuotes) {
    const lastQuotePrices = {};
    Object.values(market).forEach(m => lastQuotePrices[m.sym] = m.price);

    renderBrokerAll();

    subscribe(() => {
      renderBrokerQuotes(lastQuotePrices);
      renderPortfolio();
      renderHeader();
      if (broker.selectedSym && elOrder && !elOrder.hidden) {
        elOrderPrice.textContent = 'R$ ' + fmtBR(market[broker.selectedSym].price);
        updateOrderTotals();
      }
      Object.values(market).forEach(m => lastQuotePrices[m.sym] = m.price);
    });

    // tabs compra/venda
    elOrder.querySelectorAll('.bk-order__tab').forEach(t => {
      t.addEventListener('click', () => {
        broker.orderSide = t.dataset.side;
        showOrderPanel();
      });
    });

    // input de quantidade
    elOrderQtd.addEventListener('input', updateOrderTotals);

    // shortcuts
    elOrder.querySelectorAll('.bk-shortcut').forEach(s => {
      s.addEventListener('click', () => {
        const v = s.dataset.shortcut;
        if (v === 'max') {
          if (broker.orderSide === 'C') {
            const m = market[broker.selectedSym];
            elOrderQtd.value = Math.floor(broker.cash / m.price);
          } else {
            const pos = broker.positions[broker.selectedSym];
            elOrderQtd.value = pos ? pos.qtd : 0;
          }
        } else {
          elOrderQtd.value = parseInt(v, 10);
        }
        updateOrderTotals();
      });
    });

    // confirmar ordem
    elOrderConfirm.addEventListener('click', executeOrder);

    // fechar painel
    elOrderClose.addEventListener('click', () => {
      elOrder.hidden = true;
      broker.selectedSym = null;
      renderBrokerQuotes();
    });

    // reset
    const elBkReset = document.getElementById('bk-reset');
    if (elBkReset) {
      elBkReset.addEventListener('click', () => {
        if (!confirm('Resetar conta? Você perderá todas as posições e o histórico.')) return;
        broker = {
          cash: BROKER_INIT_CASH,
          positions: {},
          history: [],
          selectedSym: null,
          orderSide: 'C',
        };
        if (elOrder) elOrder.hidden = true;
        renderBrokerAll();
      });
    }
  }

})();

// ============================================================
// TABS DO TOPO + ABA MERCADO + HOME BROKER
// ============================================================

(function() {
  'use strict';

  // ---------------------------------------------------------
  // TROCA DE TABS PRINCIPAIS
  // ---------------------------------------------------------
  const tabs = Array.from(document.querySelectorAll('.toptab'));
  const panels = {
    mercado: document.getElementById('tab-mercado'),
    diario:  document.getElementById('tab-diario'),
    broker:  document.getElementById('tab-broker'),
    dataops: document.getElementById('tab-dataops'),
  };

  // Dado um id de âncora, descobre em qual tab o alvo vive
  // (seções fora de qualquer painel, como #sobre, pertencem ao fluxo do Diário)
  function tabDoAlvo(id) {
    const el = document.getElementById(id);
    if (!el) return 'diario';
    const panel = el.closest('.tab-panel');
    if (!panel) return null; // visível em qualquer tab (ex.: #sobre, footer)
    const entry = Object.entries(panels).find(([, p]) => p === panel);
    return entry ? entry[0] : 'diario';
  }

  function setTab(name) {
    tabs.forEach(t => {
      const isActive = t.dataset.tab === name;
      t.classList.toggle('toptab--active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      const isActive = key === name;
      el.hidden = !isActive;
      el.classList.toggle('tab-panel--active', isActive);
    });
    // sobe pro topo da aba
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

  // links da sidebar superior também trocam tabs:
  // - Manchetes & Portais (#mercado) → tab Mercado
  // - Home Broker (#broker) → tab Broker
  // - demais links → tab do painel onde a âncora vive (Diário ou DATA·OPS) + scroll
  document.querySelectorAll('.sidebar a.nav-link').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      if (id === 'mercado') {
        e.preventDefault();
        setTab('mercado');
      } else if (id === 'broker') {
        e.preventDefault();
        setTab('broker');
      } else {
        const tab = tabDoAlvo(id);
        // garante que a tab dona da âncora esteja ativa antes de rolar
        if (tab && panels[tab] && panels[tab].hidden) {
          setTab(tab);
          // espera um tick pra o painel virar visível antes de rolar
          setTimeout(() => {
            const target = document.getElementById(id);
            if (target) {
              const offset = window.innerWidth <= 768 ? 100 : 24;
              const top = target.getBoundingClientRect().top + window.scrollY - offset;
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }, 50);
          e.preventDefault();
        }
      }
    });
  });

  // links de conteúdo que apontam pra outra tab (ex.: CTA no fim da DATA·OPS)
  document.querySelectorAll('a[data-tab-link]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const tab = a.getAttribute('data-tab-link');
      const id = a.getAttribute('href').slice(1);
      setTab(tab);
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          const offset = window.innerWidth <= 768 ? 100 : 24;
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 50);
    });
  });

  // ============================================================
  // FORMATADORES (já existem acima — usamos os do mesmo escopo via globals)
  // Recriamos aqui pra desacoplar do IIFE anterior
  // ============================================================
  const fmtBR = (n, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtMoney = n => 'R$ ' + fmtBR(n);
  const fmtPct = (n, d = 2) => (n >= 0 ? '+' : '') + fmtBR(n * 100, d) + '%';

  // ============================================================
  // ABA MERCADO — cotações simuladas, ticker, heatmap, movers
  // ============================================================

  // Universo de ativos com peso aproximado no Ibovespa (proxy simplificado)
  const MKT_UNIVERSE = [
    { tk: 'PETR4', nome: 'Petrobras PN',     setor: 'Petróleo',       peso: 7.2,  preco: 38.45 },
    { tk: 'VALE3', nome: 'Vale ON',          setor: 'Mineração',      peso: 8.5,  preco: 67.20 },
    { tk: 'ITUB4', nome: 'Itaú Unibanco PN', setor: 'Bancos',         peso: 6.8,  preco: 34.10 },
    { tk: 'BBDC4', nome: 'Bradesco PN',      setor: 'Bancos',         peso: 4.5,  preco: 16.85 },
    { tk: 'BBAS3', nome: 'Banco do Brasil',  setor: 'Bancos',         peso: 3.7,  preco: 28.70 },
    { tk: 'B3SA3', nome: 'B3',               setor: 'Financeiro',     peso: 3.2,  preco: 12.30 },
    { tk: 'ABEV3', nome: 'Ambev ON',         setor: 'Bebidas',        peso: 3.0,  preco: 13.40 },
    { tk: 'WEGE3', nome: 'Weg ON',           setor: 'Bens de Capital',peso: 2.8,  preco: 41.55 },
    { tk: 'RENT3', nome: 'Localiza ON',      setor: 'Locação',        peso: 2.4,  preco: 56.40 },
    { tk: 'SUZB3', nome: 'Suzano ON',        setor: 'Papel e Celulose',peso: 2.1, preco: 52.10 },
    { tk: 'ELET3', nome: 'Eletrobras ON',    setor: 'Energia',        peso: 2.5,  preco: 38.90 },
    { tk: 'MGLU3', nome: 'Magalu ON',        setor: 'Varejo',         peso: 1.6,  preco: 8.95 },
    { tk: 'PETR3', nome: 'Petrobras ON',     setor: 'Petróleo',       peso: 4.2,  preco: 39.10 },
    { tk: 'BPAC11',nome: 'BTG Pactual',      setor: 'Bancos',         peso: 2.6,  preco: 35.40 },
    { tk: 'PRIO3', nome: 'PetroRio ON',      setor: 'Petróleo',       peso: 1.4,  preco: 42.80 },
  ];

  // estado: snapshot atual das cotações (variação acumulada do "dia simulado")
  const mktState = MKT_UNIVERSE.map(a => ({
    ...a,
    precoAbertura: a.preco,
    precoAtual: a.preco,
    variacao: 0,         // % do dia
    volume: Math.floor(Math.random() * 500_000_000 + 50_000_000),
  }));

  // expõe pro bloco CNN ler quando estiver em modo simulação
  if (typeof window !== 'undefined') window.__mktState = mktState;

  // Random walk: atualiza preços a cada 3s. Variação é pequena (-0.4% a +0.4% por tick),
  // mas com leve "tendência" pra dar realismo (alguns ativos sobem, outros caem)
  function tickPrecos() {
    mktState.forEach(a => {
      // tendência pequena por ativo (constante por sessão)
      if (a._drift === undefined) a._drift = (Math.random() - 0.5) * 0.0006;
      const noise = (Math.random() - 0.5) * 0.008; // ±0.4%
      const oldPrice = a.precoAtual;
      const newPrice = a.precoAtual * (1 + a._drift + noise);
      a.precoAtual = Math.max(0.01, parseFloat(newPrice.toFixed(2)));
      a.variacao = (a.precoAtual - a.precoAbertura) / a.precoAbertura;
      // direção do tick (pra animação de flash)
      a._lastTickDir = a.precoAtual > oldPrice ? 'up' : a.precoAtual < oldPrice ? 'dn' : 'flat';
      // histórico para sparkline (últimos 30 ticks)
      if (!a.history) a.history = [a.precoAbertura];
      a.history.push(a.precoAtual);
      if (a.history.length > 30) a.history.shift();
    });
    renderMercado();
    // captura snapshot do patrimônio pro gráfico de evolução
    if (hbState) {
      const pat = patrimonioTotal();
      if (!hbState.patHistory) hbState.patHistory = [hbState.patrimonioInicial];
      hbState.patHistory.push(pat);
      if (hbState.patHistory.length > 60) hbState.patHistory.shift();
    }
    renderHomeBroker();
  }

  // ---------- STATUS DO PREGÃO ----------
  function statusPregao() {
    const now = new Date();
    // hora SP (assumindo browser já em -3, simplificação)
    const h = now.getHours();
    const m = now.getMinutes();
    const dow = now.getDay(); // 0=dom

    if (dow === 0 || dow === 6) {
      return { txt: 'FECHADO', sub: 'fim de semana', cor: 'var(--red)' };
    }
    if (h < 9 || (h === 9 && m < 30)) {
      return { txt: 'PRÉ-ABERTURA', sub: 'leilão de abertura', cor: 'var(--accent)' };
    }
    if (h < 17 || (h === 17 && m < 30)) {
      return { txt: 'ABERTO', sub: 'pregão regular', cor: 'var(--green)' };
    }
    if (h === 17 && m < 55) {
      return { txt: 'CALL', sub: 'leilão de fechamento', cor: 'var(--accent)' };
    }
    if (h < 18) {
      return { txt: 'AFTER', sub: 'mercado fracionário', cor: 'var(--accent)' };
    }
    return { txt: 'FECHADO', sub: 'pregão encerrado', cor: 'var(--red)' };
  }

  function renderStatusBar() {
    const st = statusPregao();
    const elStatus = document.getElementById('mkt-status');
    const elSub = document.getElementById('mkt-status-sub');
    if (!elStatus) return;
    elStatus.textContent = st.txt;
    elStatus.style.color = st.cor;
    elSub.textContent = st.sub;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('mkt-clock').textContent = `${hh}:${mm}:${ss}`;

    // Ibovespa simulado = média ponderada dos preços × peso
    let ibov = 0, somaPeso = 0;
    mktState.forEach(a => {
      ibov += (a.precoAtual / a.preco) * a.peso;
      somaPeso += a.peso;
    });
    const ibovIdx = (ibov / somaPeso) * 130_500; // proxy: parte de ~130k
    const ibovDelta = mktState.reduce((acc, a) => acc + a.variacao * a.peso, 0) / somaPeso;
    const elIbov = document.getElementById('mkt-ibov');
    const elIbovD = document.getElementById('mkt-ibov-delta');
    if (elIbov) {
      elIbov.textContent = fmtBR(ibovIdx, 0) + ' pts';
      elIbov.style.color = ibovDelta > 0 ? 'var(--green)' : ibovDelta < 0 ? 'var(--red)' : 'var(--fg)';
      elIbovD.textContent = fmtPct(ibovDelta, 2);
      elIbovD.style.color = ibovDelta > 0 ? 'var(--green)' : ibovDelta < 0 ? 'var(--red)' : 'var(--fg-2)';
    }

    // Dólar simulado (random walk independente)
    if (typeof renderStatusBar._usd === 'undefined') {
      renderStatusBar._usd = 5.18;
      renderStatusBar._usd0 = 5.18;
    }
    renderStatusBar._usd *= (1 + (Math.random() - 0.5) * 0.001);
    const usdDelta = (renderStatusBar._usd - renderStatusBar._usd0) / renderStatusBar._usd0;
    const elUsd = document.getElementById('mkt-usd');
    const elUsdD = document.getElementById('mkt-usd-delta');
    if (elUsd) {
      elUsd.textContent = 'R$ ' + fmtBR(renderStatusBar._usd, 4);
      elUsd.style.color = usdDelta > 0 ? 'var(--red)' : usdDelta < 0 ? 'var(--green)' : 'var(--fg)';
      elUsdD.textContent = fmtPct(usdDelta, 3);
    }
  }

  // ---------- TICKER (cards de cotações) ----------
  function renderTickerCards() {
    const grid = document.getElementById('mkt-grid');
    if (!grid) return;
    grid.innerHTML = mktState.map(a => `
      <div class="mkt-cell ${a.variacao > 0 ? 'up' : a.variacao < 0 ? 'dn' : ''}" data-tk="${a.tk}">
        <div class="mkt-cell__tk">${a.tk}</div>
        <div class="mkt-cell__px">${fmtBR(a.precoAtual, 2)}</div>
        <div class="mkt-cell__var">${fmtPct(a.variacao, 2)}</div>
      </div>
    `).join('');

    const upd = document.getElementById('mkt-ticker-update');
    if (upd) {
      const now = new Date();
      upd.textContent = 'atualizado ' + now.toLocaleTimeString('pt-BR');
    }
  }

  // ---------- HEATMAP ----------
  function renderHeatmap() {
    const wrap = document.getElementById('mkt-heatmap');
    if (!wrap) return;
    // ordena por peso desc
    const sorted = [...mktState].sort((a, b) => b.peso - a.peso);

    wrap.innerHTML = sorted.map(a => {
      // intensidade da cor = magnitude da variação (cap em ±3%)
      const intensity = Math.min(Math.abs(a.variacao) / 0.03, 1);
      const isUp = a.variacao >= 0;
      const baseColor = isUp ? 'var(--green)' : 'var(--red)';
      const opacity = 0.15 + intensity * 0.5;
      // tamanho proporcional ao peso (área visual)
      const flexBasis = Math.max(8, a.peso * 3);
      return `
        <div class="hm-cell" style="
          flex: ${flexBasis} 1 0;
          background: color-mix(in srgb, ${baseColor} ${Math.round(opacity * 100)}%, var(--bg-card));
          border-color: color-mix(in srgb, ${baseColor} ${Math.round(intensity * 60)}%, var(--line));
        ">
          <div class="hm-cell__tk">${a.tk}</div>
          <div class="hm-cell__var">${fmtPct(a.variacao, 2)}</div>
        </div>
      `;
    }).join('');
  }

  // ---------- MOVERS (top alta / top baixa) ----------
  function renderMovers() {
    const sorted = [...mktState].sort((a, b) => b.variacao - a.variacao);
    const top5 = sorted.slice(0, 5);
    const bot5 = sorted.slice(-5).reverse();

    const elUp = document.getElementById('mkt-movers-up');
    const elDn = document.getElementById('mkt-movers-dn');
    if (!elUp || !elDn) return;

    const renderMover = a => `
      <div class="mover ${a.variacao >= 0 ? 'up' : 'dn'}">
        <div class="mover__tk">${a.tk}</div>
        <div class="mover__nome">${a.nome}</div>
        <div class="mover__px">${fmtBR(a.precoAtual, 2)}</div>
        <div class="mover__var">${fmtPct(a.variacao, 2)}</div>
      </div>
    `;
    elUp.innerHTML = top5.map(renderMover).join('');
    elDn.innerHTML = bot5.map(renderMover).join('');
  }

  function renderMercado() {
    if (!document.getElementById('tab-mercado')) return;
    renderStatusBar();
    renderTickerCards();
    renderHeatmap();
    renderMovers();
  }

  // ============================================================
  // HOME BROKER
  // ============================================================

  // Carteira virtual
  const HB_INITIAL_CASH = 100_000;
  const HB_TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'BBAS3', 'B3SA3',
                       'WEGE3', 'RENT3', 'SUZB3', 'MGLU3'];

  let hbState = null; // inicializado no resetBroker

  function resetBroker() {
    hbState = {
      cash: HB_INITIAL_CASH,
      patrimonioInicial: HB_INITIAL_CASH,
      posicoes: {},        // { tk: { qtd, pmedio } }
      historico: [],       // { time, tk, op, qtd, preco, fin }
      selecionado: null,   // ticker selecionado pra ticket
      patHistory: [HB_INITIAL_CASH], // pro gráfico de evolução
      lastConfetti: 0,     // pra evitar disparo repetido
    };
    renderHomeBroker();
  }

  function getAtivo(tk) {
    return mktState.find(a => a.tk === tk);
  }

  function patrimonioTotal() {
    if (!hbState) return HB_INITIAL_CASH;
    let posVal = 0;
    Object.entries(hbState.posicoes).forEach(([tk, pos]) => {
      const a = getAtivo(tk);
      if (a) posVal += pos.qtd * a.precoAtual;
    });
    return hbState.cash + posVal;
  }

  function renderKPIs() {
    if (!hbState) return;
    const pat = patrimonioTotal();
    const variacao = pat - hbState.patrimonioInicial;
    const variacaoPct = variacao / hbState.patrimonioInicial;

    const e = id => document.getElementById(id);
    if (!e('hb-patrimonio')) return;

    e('hb-patrimonio').textContent = fmtMoney(pat);
    e('hb-patrimonio').style.color =
      variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg)';
    e('hb-patrimonio-delta').textContent =
      (variacao >= 0 ? '+' : '') + fmtMoney(variacao) + ' · ' + fmtPct(variacaoPct, 2);
    e('hb-patrimonio-delta').style.color =
      variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg-2)';

    e('hb-saldo').textContent = fmtMoney(hbState.cash);

    // Posições
    let posVal = 0, qtdAtivos = 0, qtdAcoes = 0;
    Object.values(hbState.posicoes).forEach(pos => {
      if (pos.qtd > 0) { qtdAtivos++; qtdAcoes += pos.qtd; }
    });
    Object.entries(hbState.posicoes).forEach(([tk, pos]) => {
      const a = getAtivo(tk);
      if (a) posVal += pos.qtd * a.precoAtual;
    });
    e('hb-posicoes').textContent = fmtMoney(posVal);
    e('hb-posicoes-qtd').textContent =
      `${qtdAtivos} ativo${qtdAtivos !== 1 ? 's' : ''} · ${qtdAcoes.toLocaleString('pt-BR')} ações`;

    e('hb-pnl').textContent = (variacao >= 0 ? '+' : '') + fmtMoney(variacao);
    e('hb-pnl').style.color =
      variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg)';
    e('hb-pnl-pct').textContent = fmtPct(variacaoPct, 2);
    e('hb-pnl-pct').style.color =
      variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg-2)';
  }

  // --- Helper: gera path SVG da sparkline a partir de array de preços ---
  function sparklinePath(prices, w = 80, h = 24) {
    if (!prices || prices.length < 2) return '';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const stepX = w / (prices.length - 1);
    return prices.map((p, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (h - ((p - min) / range) * h).toFixed(1);
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
  }

  function renderQuotes() {
    const rows = document.getElementById('hb-quotes-rows');
    if (!rows) return;

    // estado prévio dos elementos pra detectar mudança de preço (flash)
    const prev = {};
    rows.querySelectorAll('.hb-quote-row').forEach(r => {
      const tk = r.dataset.tk;
      const px = r.querySelector('.hb-quote__px');
      if (tk && px) prev[tk] = parseFloat(px.dataset.value || '0');
    });

    rows.innerHTML = HB_TICKERS.map(tk => {
      const a = getAtivo(tk);
      if (!a) return '';
      const ativa = hbState && hbState.selecionado === tk;
      const dir = a.variacao > 0 ? 'up' : a.variacao < 0 ? 'dn' : '';
      const sparkColor = a.variacao > 0 ? 'var(--green)'
                       : a.variacao < 0 ? 'var(--red)'
                       : 'var(--fg-2)';
      const sparkD = sparklinePath(a.history || [a.precoAtual]);
      return `
        <div class="hb-quote-row ${ativa ? 'is-active' : ''} ${dir}" data-tk="${tk}">
          <div class="hb-quote__tk">${tk}</div>
          <div class="hb-quote__spark">
            <svg viewBox="0 0 80 24" preserveAspectRatio="none">
              <path d="${sparkD}" fill="none" stroke="${sparkColor}" stroke-width="1.5"/>
            </svg>
          </div>
          <div class="hb-quote__px" data-value="${a.precoAtual}">${fmtBR(a.precoAtual, 2)}</div>
          <div class="hb-quote__var">${fmtPct(a.variacao, 2)}</div>
          <div class="hb-quote__vol">${(a.volume / 1e6).toFixed(1)}M</div>
          <div><button class="hb-quote__btn">operar</button></div>
        </div>
      `;
    }).join('');

    // Aplica animação de flash em cada linha cujo preço mudou
    rows.querySelectorAll('.hb-quote-row').forEach(r => {
      const tk = r.dataset.tk;
      const a = getAtivo(tk);
      if (!a || prev[tk] === undefined) return;
      if (a.precoAtual > prev[tk]) {
        r.classList.add('flash-up');
        setTimeout(() => r.classList.remove('flash-up'), 600);
      } else if (a.precoAtual < prev[tk]) {
        r.classList.add('flash-dn');
        setTimeout(() => r.classList.remove('flash-dn'), 600);
      }
    });

    rows.querySelectorAll('.hb-quote-row').forEach(row => {
      row.addEventListener('click', () => {
        hbState.selecionado = row.dataset.tk;
        renderTicket();
        // re-render só pra atualizar o estado "is-active"
        rows.querySelectorAll('.hb-quote-row').forEach(r => {
          r.classList.toggle('is-active', r.dataset.tk === hbState.selecionado);
        });
      });
    });
  }

  function renderTicket() {
    const empty = document.getElementById('hb-ticket-empty');
    const body = document.getElementById('hb-ticket-body');
    if (!empty || !body) return;

    if (!hbState.selecionado) {
      empty.hidden = false;
      body.hidden = true;
      return;
    }
    empty.hidden = true;
    body.hidden = false;

    const a = getAtivo(hbState.selecionado);
    if (!a) return;

    const e = id => document.getElementById(id);
    e('hb-ticket-name').textContent = a.tk + ' · ' + a.nome;
    e('hb-ticket-price').textContent = fmtMoney(a.precoAtual);
    e('hb-ticket-var').textContent = fmtPct(a.variacao, 2);
    e('hb-ticket-var').style.color =
      a.variacao > 0 ? 'var(--green)' : a.variacao < 0 ? 'var(--red)' : 'var(--fg-2)';

    // book de ofertas simulado: 3 ordens compra abaixo, 3 ordens venda acima
    const buyBook = [];
    const sellBook = [];
    for (let i = 1; i <= 3; i++) {
      buyBook.push({ p: a.precoAtual - i * 0.01, q: Math.floor(Math.random() * 1000 + 100) * 100 });
      sellBook.push({ p: a.precoAtual + i * 0.01, q: Math.floor(Math.random() * 1000 + 100) * 100 });
    }
    // barras proporcionais à quantidade
    const allQty = [...buyBook, ...sellBook].map(o => o.q);
    const maxQ = Math.max(...allQty);

    e('hb-book-buy').innerHTML = buyBook.map(b => {
      const pct = (b.q / maxQ * 100).toFixed(0);
      return `
        <div class="hb-book-row" style="--bar:${pct}%">
          <span>${fmtBR(b.p, 2)}</span>
          <span>${b.q.toLocaleString('pt-BR')}</span>
        </div>
      `;
    }).join('');
    e('hb-book-sell').innerHTML = sellBook.reverse().map(b => {
      const pct = (b.q / maxQ * 100).toFixed(0);
      return `
        <div class="hb-book-row" style="--bar:${pct}%">
          <span>${fmtBR(b.p, 2)}</span>
          <span>${b.q.toLocaleString('pt-BR')}</span>
        </div>
      `;
    }).join('');

    // financeiro com base na quantidade
    updateFinanceiro();

    // info de posição
    const pos = hbState.posicoes[a.tk];
    const info = e('hb-position-info');
    if (pos && pos.qtd > 0) {
      info.hidden = false;
      e('hb-pos-qtd').textContent = pos.qtd.toLocaleString('pt-BR');
      e('hb-pos-pm').textContent = fmtMoney(pos.pmedio);
    } else {
      info.hidden = true;
    }
  }

  function updateFinanceiro() {
    if (!hbState || !hbState.selecionado) return;
    const a = getAtivo(hbState.selecionado);
    if (!a) return;
    const qty = parseInt(document.getElementById('hb-qty').value, 10) || 0;
    document.getElementById('hb-financeiro').textContent = fmtMoney(qty * a.precoAtual);
  }

  function renderCarteira() {
    const cards = document.getElementById('hb-port-cards');
    if (!cards) return;
    const posicoes = Object.entries(hbState.posicoes).filter(([_, p]) => p.qtd > 0);

    if (posicoes.length === 0) {
      cards.innerHTML = `<div class="hb-port-empty">Nenhuma posição. Compre algo na tabela acima pra começar.</div>`;
      return;
    }

    // Total da carteira (pra calcular % de cada posição na carteira)
    const totalCart = posicoes.reduce((acc, [tk, pos]) => {
      const a = getAtivo(tk);
      return acc + (a ? pos.qtd * a.precoAtual : 0);
    }, 0);

    cards.innerHTML = posicoes.map(([tk, pos]) => {
      const a = getAtivo(tk);
      if (!a) return '';
      const fin = pos.qtd * a.precoAtual;
      const pnl = (a.precoAtual - pos.pmedio) * pos.qtd;
      const pnlPct = (a.precoAtual - pos.pmedio) / pos.pmedio;
      const pesoCart = (fin / totalCart * 100).toFixed(1);
      const dirCls = pnl > 0 ? 'up' : pnl < 0 ? 'dn' : 'flat';

      // sparkline da posição (mesma do mercado)
      const sparkColor = pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--fg-2)';
      const sparkD = sparklinePath(a.history || [a.precoAtual], 100, 28);

      // barra de P&L visual (centro = 0, ±10% nos extremos)
      const pnlBarPct = Math.min(Math.abs(pnlPct) / 0.05, 1) * 50; // 5% = barra cheia
      const barSide = pnl >= 0 ? 'right' : 'left';

      return `
        <div class="hb-port-card ${dirCls}">
          <div class="hb-port-card__head">
            <div class="hb-port-card__tk">${tk}</div>
            <div class="hb-port-card__nome">${a.nome}</div>
            <div class="hb-port-card__peso">${pesoCart}% da carteira</div>
          </div>

          <div class="hb-port-card__spark">
            <svg viewBox="0 0 100 28" preserveAspectRatio="none">
              <path d="${sparkD}" fill="none" stroke="${sparkColor}" stroke-width="1.5"/>
            </svg>
          </div>

          <div class="hb-port-card__metrics">
            <div class="hb-port-metric">
              <div class="hb-port-metric__lbl">QTD</div>
              <div class="hb-port-metric__val">${pos.qtd.toLocaleString('pt-BR')}</div>
            </div>
            <div class="hb-port-metric">
              <div class="hb-port-metric__lbl">PM</div>
              <div class="hb-port-metric__val">${fmtBR(pos.pmedio, 2)}</div>
            </div>
            <div class="hb-port-metric">
              <div class="hb-port-metric__lbl">ATUAL</div>
              <div class="hb-port-metric__val">${fmtBR(a.precoAtual, 2)}</div>
            </div>
            <div class="hb-port-metric">
              <div class="hb-port-metric__lbl">FIN.</div>
              <div class="hb-port-metric__val">${fmtMoney(fin)}</div>
            </div>
          </div>

          <div class="hb-port-card__pnl">
            <div class="hb-port-card__pnl-bar">
              <div class="hb-port-card__pnl-mid"></div>
              <div class="hb-port-card__pnl-fill ${dirCls}"
                   style="${barSide}: 50%; width: ${pnlBarPct}%;"></div>
            </div>
            <div class="hb-port-card__pnl-vals">
              <div class="hb-port-card__pnl-r ${dirCls}">
                ${(pnl >= 0 ? '+' : '') + fmtMoney(pnl)}
              </div>
              <div class="hb-port-card__pnl-p ${dirCls}">
                ${fmtPct(pnlPct, 2)}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------- GRÁFICO DE EVOLUÇÃO DO PATRIMÔNIO ----------
  function renderPatChart() {
    if (!hbState) return;
    const svg = document.getElementById('hb-chart-svg');
    const lineP = document.getElementById('hb-chart-line');
    const areaP = document.getElementById('hb-chart-area');
    const empty = document.getElementById('hb-chart-empty');
    const meta = document.getElementById('hb-chart-meta');
    if (!svg || !lineP || !areaP) return;

    const hist = hbState.patHistory || [];
    // só mostra gráfico se já operou alguma coisa
    const operou = hbState.historico.length > 0;
    if (!operou || hist.length < 2) {
      if (empty) empty.style.display = 'flex';
      lineP.setAttribute('d', '');
      areaP.setAttribute('d', '');
      if (meta) meta.textContent = 'comece a operar pra ver o gráfico';
      return;
    }
    if (empty) empty.style.display = 'none';

    const W = 800, H = 200;
    const min = Math.min(...hist, hbState.patrimonioInicial);
    const max = Math.max(...hist, hbState.patrimonioInicial);
    const range = max - min || 1;
    const stepX = W / (hist.length - 1);

    let line = '';
    hist.forEach((p, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (H - ((p - min) / range) * H * 0.85 - H * 0.075).toFixed(1);
      line += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
    });
    lineP.setAttribute('d', line.trim());

    // área
    const lastX = ((hist.length - 1) * stepX).toFixed(1);
    const area = line + `L${lastX},${H} L0,${H} Z`;
    areaP.setAttribute('d', area);

    // cor da linha conforme tendência
    const variacao = hist[hist.length - 1] - hbState.patrimonioInicial;
    const corLinha = variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--accent)';
    lineP.setAttribute('stroke', corLinha);

    // atualiza gradiente da área pra mesma cor
    const grad = svg.querySelector('#hb-chart-grad stop:first-child');
    if (grad) grad.setAttribute('stop-color', corLinha);
    const grad2 = svg.querySelector('#hb-chart-grad stop:last-child');
    if (grad2) grad2.setAttribute('stop-color', corLinha);

    // meta
    const variacaoPct = variacao / hbState.patrimonioInicial;
    if (meta) {
      meta.textContent = `${hist.length} pts · ${(hist.length * 3 / 60).toFixed(1)} min · ${fmtPct(variacaoPct, 3)}`;
      meta.style.color = variacao > 0 ? 'var(--green)' : variacao < 0 ? 'var(--red)' : 'var(--fg-2)';
    }
  }

  // ---------- CONFETTI (lucro > 1%) ----------
  function dispararConfetti() {
    const wrap = document.getElementById('hb-confetti');
    if (!wrap) return;
    const cores = ['#5eead4', '#d4a017', '#f5c542', '#22c55e', '#0ea5e9'];
    for (let i = 0; i < 36; i++) {
      const c = document.createElement('div');
      c.className = 'confetti-piece';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = cores[Math.floor(Math.random() * cores.length)];
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      c.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(c);
      setTimeout(() => c.remove(), 3500);
    }
  }

  function checarConfetti() {
    if (!hbState) return;
    const pat = patrimonioTotal();
    const variacao = (pat - hbState.patrimonioInicial) / hbState.patrimonioInicial;
    // dispara se passou de 1% acumulado e ainda não disparou nesse "patamar"
    if (variacao > 0.01 && hbState.lastConfetti < 0.01) {
      dispararConfetti();
      hbState.lastConfetti = 0.01;
    } else if (variacao > 0.025 && hbState.lastConfetti < 0.025) {
      dispararConfetti();
      hbState.lastConfetti = 0.025;
    } else if (variacao > 0.05 && hbState.lastConfetti < 0.05) {
      dispararConfetti();
      hbState.lastConfetti = 0.05;
    } else if (variacao < hbState.lastConfetti - 0.005) {
      // se caiu, "destrava" pro próximo nível
      hbState.lastConfetti = Math.max(0, variacao);
    }
  }

  function renderHistorico() {
    const rows = document.getElementById('hb-hist-rows');
    if (!rows) return;
    if (hbState.historico.length === 0) {
      rows.innerHTML = `<div class="hb-hist-empty">Nenhuma ordem executada ainda.</div>`;
      return;
    }
    rows.innerHTML = hbState.historico.slice().reverse().map(h => `
      <div class="hb-hist-row ${h.op === 'C' ? 'op-buy' : 'op-sell'}">
        <div>${h.time}</div>
        <div>${h.tk}</div>
        <div class="hb-op-badge hb-op-badge--${h.op === 'C' ? 'buy' : 'sell'}">${h.op === 'C' ? 'COMPRA' : 'VENDA'}</div>
        <div>${h.qtd.toLocaleString('pt-BR')}</div>
        <div>${fmtBR(h.preco, 2)}</div>
        <div>${fmtMoney(h.fin)}</div>
      </div>
    `).join('');
  }

  function renderHomeBroker() {
    if (!document.getElementById('tab-broker')) return;
    if (!hbState) return;
    renderKPIs();
    renderQuotes();
    renderTicket();
    renderCarteira();
    renderHistorico();
    renderPatChart();
    checarConfetti();
  }

  // ---------- COMPRAR / VENDER ----------
  function executarOrdem(op) {
    if (!hbState.selecionado) return;
    const a = getAtivo(hbState.selecionado);
    if (!a) return;
    const qty = parseInt(document.getElementById('hb-qty').value, 10) || 0;
    if (qty <= 0) {
      flashTicket('Quantidade inválida', 'err');
      return;
    }
    const fin = qty * a.precoAtual;

    if (op === 'C') {
      if (fin > hbState.cash) {
        flashTicket('Saldo insuficiente', 'err');
        return;
      }
      hbState.cash -= fin;
      const atual = hbState.posicoes[a.tk] || { qtd: 0, pmedio: 0 };
      const novoTotal = atual.qtd + qty;
      const novoPM = (atual.qtd * atual.pmedio + qty * a.precoAtual) / novoTotal;
      hbState.posicoes[a.tk] = { qtd: novoTotal, pmedio: novoPM };
    } else {
      const atual = hbState.posicoes[a.tk];
      if (!atual || atual.qtd < qty) {
        flashTicket('Quantidade maior que sua posição', 'err');
        return;
      }
      hbState.cash += fin;
      atual.qtd -= qty;
      if (atual.qtd === 0) delete hbState.posicoes[a.tk];
    }

    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' +
                 String(now.getMinutes()).padStart(2, '0') + ':' +
                 String(now.getSeconds()).padStart(2, '0');
    hbState.historico.push({
      time, tk: a.tk, op, qtd: qty, preco: a.precoAtual, fin,
    });

    flashTicket(op === 'C' ? '✓ Compra executada' : '✓ Venda executada', 'ok');
    renderHomeBroker();
  }

  function flashTicket(msg, kind) {
    const body = document.getElementById('hb-ticket-body');
    if (!body) return;
    let toast = body.querySelector('.hb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'hb-toast';
      body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'hb-toast hb-toast--' + kind + ' show';
    setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ---------- BIND ----------
  const btnBuy = document.getElementById('hb-buy');
  const btnSell = document.getElementById('hb-sell');
  const inpQty = document.getElementById('hb-qty');
  const btnReset = document.getElementById('hb-reset');

  if (btnBuy) btnBuy.addEventListener('click', () => executarOrdem('C'));
  if (btnSell) btnSell.addEventListener('click', () => executarOrdem('V'));
  if (inpQty) inpQty.addEventListener('input', updateFinanceiro);
  if (btnReset) btnReset.addEventListener('click', () => {
    if (confirm('Resetar carteira? Você vai perder todas as posições.')) resetBroker();
  });

  // ---------- INICIALIZA ----------
  resetBroker();
  renderMercado();

  // tick contínuo: preços sobem/descem a cada 3s
  setInterval(tickPrecos, 3000);
  // relógio do status atualiza a cada 1s
  setInterval(renderStatusBar, 1000);

})();

// ============================================================
// CNN-BLOCK (Agenda + Painel + Faixa Inferior + Brapi.dev)
// ============================================================

(function() {
  'use strict';

  const fmtBR = (n, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPctCnn = (n, d = 2) => (n >= 0 ? '+' : '') + fmtBR(n, d) + '%';

  // ---------- DADOS REAIS DE MERCADO ----------
  // Estratégia híbrida:
  //   1. AÇÕES E IBOVESPA via Brapi.dev (chave gratuita, 15.000 reqs/mês, 15min delay)
  //   2. DÓLAR via AwesomeAPI (CORS aberto, sem chave) com fallback de proxies
  //   3. Demais cotações simuladas (random walk realista)
  //
  // Refs:
  //   Brapi:       https://brapi.dev/docs
  //   AwesomeAPI:  https://docs.awesomeapi.com.br/api-de-moedas

  // Chave Brapi — insira sua chave gratuita (https://brapi.dev) para cotações reais.
  // Sem chave, o quadro de cotações roda em modo simulação.
  const BRAPI_TOKEN = '';
  const BRAPI_BASE  = 'https://brapi.dev/api/quote';
  const BRAPI_TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'BBAS3', '^BVSP'];

  const AWESOME_USD = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
  const CACHE_KEY  = 'bo-ops-mkt-cache';
  const CACHE_TTL  = 5 * 60 * 1000; // 5 minutos

  function getCached(suffix = '') {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY + suffix);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) return null;
      return obj.data;
    } catch (e) { return null; }
  }

  function setCached(data, suffix = '') {
    try {
      sessionStorage.setItem(CACHE_KEY + suffix, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {}
  }

  /**
   * Busca cotações de ações via Brapi.dev com chave de API.
   * Retorna {success, results} onde results é array de objetos
   * com {tk, preco, var, history}.
   */
  async function fetchBrapi() {
    // Sem chave configurada, nem tenta a API — cai direto na simulação
    if (!BRAPI_TOKEN) return { success: false };

    const cached = getCached(':brapi');
    if (cached) return { success: true, results: cached, fromCache: true };

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 6000);
      const url = `${BRAPI_BASE}/${BRAPI_TICKERS.join(',')}?range=1d&interval=15m&token=${BRAPI_TOKEN}`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        console.info('[brapi] resposta não-OK:', res.status);
        return { success: false };
      }
      const json = await res.json();
      if (!json.results || !Array.isArray(json.results)) {
        console.info('[brapi] formato inesperado');
        return { success: false };
      }

      // Normaliza pro formato do nosso estado
      const results = json.results.map(item => {
        const tk = item.symbol === '^BVSP' ? 'IBOV' : item.symbol;
        const preco = item.regularMarketPrice || 0;
        const variacao = item.regularMarketChangePercent || 0;
        // histórico: pega closes do intraday (15min)
        const histRaw = (item.historicalDataPrice || [])
          .map(h => h.close)
          .filter(p => typeof p === 'number' && p > 0);
        const history = histRaw.length >= 2 ? histRaw.slice(-20) : [preco];
        return { tk, preco, var: variacao, history, isReal: true, longName: item.longName };
      });

      setCached(results, ':brapi');
      return { success: true, results, fromCache: false };
    } catch (err) {
      console.info('[brapi] fallback simulação:', err.message);
      return { success: false };
    }
  }


  /**
   * Busca dólar real via AwesomeAPI.
   * Tenta direto primeiro. Se CORS bloquear, tenta via proxy público corsproxy.io.
   * Retorna {success, dolar} ou {success: false}.
   */
  async function fetchDolarReal() {
    const cached = getCached(':dolar');
    if (cached) return { success: true, dolar: cached, fromCache: true };

    const tryFetch = async (url) => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        clearTimeout(timeout);
        return null;
      }
    };

    // 1) tenta direto (funciona em alguns ambientes)
    let json = await tryFetch(AWESOME_USD);

    // 2) se falhou, tenta via proxy corsproxy.io (público, gratuito)
    if (!json) {
      const proxied = 'https://corsproxy.io/?' + encodeURIComponent(AWESOME_USD);
      json = await tryFetch(proxied);
    }

    // 3) se falhou de novo, tenta segundo proxy (allorigins.win)
    if (!json) {
      const allorigins = 'https://api.allorigins.win/get?url=' + encodeURIComponent(AWESOME_USD);
      const wrap = await tryFetch(allorigins);
      if (wrap && wrap.contents) {
        try { json = JSON.parse(wrap.contents); } catch (e) {}
      }
    }

    if (!json || !json.USDBRL) {
      console.info('[dolar] todas as tentativas falharam, usando simulação');
      return { success: false };
    }

    const usd = json.USDBRL;
    const dolar = {
      bid:    parseFloat(usd.bid),
      high:   parseFloat(usd.high),
      low:    parseFloat(usd.low),
      varPct: parseFloat(usd.pctChange),
      update: usd.create_date,
    };
    setCached(dolar, ':dolar');
    return { success: true, dolar, fromCache: false };
  }

  // estado: lista atual de cotações (real ou simulado)
  let cnnQuotesState = {
    isReal: false,
    tickers: [],  // [{tk, nome, preco, var, dir, history}]
    lastUpdate: null,
  };

  // Mini-gráfico com base num array de preços
  function miniSparkline(prices, w = 32, h = 28) {
    if (!prices || prices.length < 2) return '<svg viewBox="0 0 32 28"></svg>';
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const stepX = w / (prices.length - 1);
    const path = prices.map((p, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (h - ((p - min) / range) * h * 0.8 - h * 0.1).toFixed(1);
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
    const last = prices[prices.length - 1];
    const first = prices[0];
    const color = last > first ? 'var(--green)' : last < first ? 'var(--red)' : 'var(--fg-3)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }

  // ---------- RENDER PAINEL DESTAQUES ----------
  function renderCnnPanel() {
    const list = document.getElementById('cnn-panel-list');
    const status = document.getElementById('cnn-panel-status');
    if (!list) return;

    // Status visual: 3 níveis
    //   - DADOS REAIS (Brapi + Dolar OK): vermelho
    //   - DÓLAR REAL · AÇÕES SIMULADAS (só Awesome OK): laranja
    //   - DADOS SIMULADOS (tudo offline): cinza
    if (status) {
      if (cnnQuotesState.brapiOk) {
        status.innerHTML = '<span class="cnn-status-dot"></span><span class="cnn-status-text">DADOS REAIS · 15MIN DELAY</span>';
        status.style.background = '#cc0000';
      } else if (cnnQuotesState.hasReal) {
        status.innerHTML = '<span class="cnn-status-dot"></span><span class="cnn-status-text">DÓLAR REAL · AÇÕES SIMULADAS</span>';
        status.style.background = '#cc7000';
      } else {
        status.innerHTML = '<span class="cnn-status-dot"></span><span class="cnn-status-text">DADOS SIMULADOS</span>';
        status.style.background = '#666';
      }
    }

    const items = cnnQuotesState.tickers.slice(0, 7); // 1 dólar + 6 ações
    if (items.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:var(--fg-3);padding:14px 0;">aguardando...</div>';
      return;
    }

    list.innerHTML = items.map(q => {
      const dir = q.var > 0 ? 'up' : q.var < 0 ? 'dn' : 'flat';
      const arrow = q.var > 0 ? '▲' : q.var < 0 ? '▼' : '—';
      const realBadge = q.isReal
        ? '<span class="cnn-quote__real" title="Dado real"></span>'
        : '';
      // Formata preço: USD/BRL com 4 casas, IBOV em pontos sem R$, ações com R$
      let precoLabel;
      if (q.tk === 'USD/BRL') {
        precoLabel = `R$ ${fmtBR(q.preco, 4)}`;
      } else if (q.tk === 'IBOV') {
        precoLabel = `${fmtBR(q.preco, 0)} pts`;
      } else {
        precoLabel = `R$ ${fmtBR(q.preco, 2)}`;
      }
      return `
        <div class="cnn-quote ${dir}">
          <div class="cnn-quote__icon">${miniSparkline(q.history)}</div>
          <div class="cnn-quote__info">
            <div class="cnn-quote__tk">${realBadge}${q.tk}</div>
            <div class="cnn-quote__var">${arrow} ${fmtPctCnn(q.var, 2)}</div>
          </div>
          <div class="cnn-quote__price">${precoLabel}</div>
        </div>
      `;
    }).join('');
  }

  // ---------- RENDER ÍNDICES ----------
  function renderCnnIndices(items) {
    const wrap = document.getElementById('cnn-indices-list');
    if (!wrap) return;
    wrap.innerHTML = items.map(idx => `
      <div class="cnn-index">
        <div class="cnn-index__lbl">${idx.tk}</div>
        <div>
          <div class="cnn-index__val">${idx.valor}</div>
          <div class="cnn-index__var ${idx.dir}">${idx.var}</div>
        </div>
      </div>
    `).join('');
  }

  // ---------- RENDER AGENDA (lê agenda.json) ----------
  async function renderCnnAgenda() {
    const grid = document.getElementById('cnn-agenda-grid');
    const week = document.getElementById('cnn-agenda-week');
    if (!grid) return;

    let agenda;
    try {
      const res = await fetch('agenda.json?v=' + Date.now());
      if (!res.ok) throw new Error('fetch fail');
      agenda = await res.json();
    } catch (err) {
      grid.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:11px;grid-column:1/-1;text-align:center;padding:20px;">Não foi possível carregar a agenda. Verifique se o arquivo agenda.json está na mesma pasta.</div>';
      return;
    }

    // Datas calculadas a partir da semana corrente — o JSON define só os
    // eventos por dia da semana; assim a agenda nunca mostra semana passada
    const hoje = new Date();
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7)); // segunda da semana atual
    const sexta = new Date(segunda);
    sexta.setDate(segunda.getDate() + 4);
    const fmtDia = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    const fmtFull = d => fmtDia(d) + '/' + d.getFullYear();
    const offsetSemana = {
      'SEGUNDA-FEIRA': 0, 'TERÇA-FEIRA': 1, 'QUARTA-FEIRA': 2,
      'QUINTA-FEIRA': 3, 'SEXTA-FEIRA': 4,
    };
    const dataDoDia = d => {
      const off = offsetSemana[(d.dia || '').toUpperCase()];
      if (off === undefined) return d.data; // dia desconhecido: usa a data do JSON
      const dt = new Date(segunda);
      dt.setDate(segunda.getDate() + off);
      return fmtDia(dt);
    };

    if (week) week.textContent = 'Semana de ' + fmtFull(segunda) + ' a ' + fmtFull(sexta);

    grid.innerHTML = agenda.dias.map(d => `
      <div class="cnn-day">
        <div class="cnn-day__head">
          <div class="cnn-day__name">${d.dia}</div>
          <div class="cnn-day__date">(${dataDoDia(d)})</div>
        </div>
        ${d.eventos.map(e => `
          <div class="cnn-event">
            <span class="cnn-event__hora">${e.hora}</span>
            <span class="cnn-event__flag cnn-event__flag--${e.pais}"></span>
            <span class="cnn-event__nome">${e.evento}</span>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Renderiza índices secundários no painel da direita
    if (agenda.destaques_indices) {
      renderCnnIndices(agenda.destaques_indices);
    }
  }

  // ---------- FAIXA INFERIOR (notícias rolando + relógio) ----------
  function renderCnnBottom() {
    const news = document.getElementById('cnn-bottom-news');
    if (news && !news.querySelector('.cnn-bottom__news-track')) {
      // só monta uma vez; depois fica rolando sozinho
      const headlines = [
        'Ibovespa fecha em alta de 1,39% impulsionado por bancos e Petrobras',
        'Dólar recua 0,03% e fecha a R$ 4,95 com fluxo estrangeiro positivo',
        'Petróleo cai após Trump afirmar que ajudará navios retidos em Ormuz',
        'Alemanha coordenará com UE resposta às tarifas de Trump, diz governo',
        'BC mantém Selic em 10,5% e sinaliza pausa no ciclo de cortes',
        'MBRF e HPDC concluem criação da Sadia Halal, em operação de US$ 2 bi',
        'Nubank Holdings DRN sobe 0,08% após resultado do 1T26',
        'WEG ON avança 1,24% com expectativa de demanda forte de motores industriais',
      ];
      // duplicamos pra animação infinita parecer fluida
      const items = [...headlines, ...headlines]
        .map(h => `<span class="cnn-bottom__news-item">${h}</span>`)
        .join('');
      news.innerHTML = `<div class="cnn-bottom__news-track">${items}</div>`;
    }
  }

  // relógio do rodapé CNN
  function tickRelogioCnn() {
    const el = document.getElementById('cnn-bottom-time');
    if (!el) return;
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    el.textContent = `${dia} ${mes} | ${hh}:${mm}`;
  }

  // ---------- ATUALIZAÇÃO DE COTAÇÕES (real + fallback) ----------
  async function atualizarCnnQuotes() {
    // Tenta dados reais via Brapi (ações + Ibovespa) e AwesomeAPI (dólar) em paralelo
    const [brapiResult, dolarResult] = await Promise.all([
      fetchBrapi(),
      fetchDolarReal(),
    ]);

    const tickers = [];

    // Dólar (se disponível)
    if (dolarResult.success && dolarResult.dolar) {
      tickers.push({
        tk: 'USD/BRL',
        preco: dolarResult.dolar.bid,
        var: dolarResult.dolar.varPct,
        history: [dolarResult.dolar.low, dolarResult.dolar.bid, dolarResult.dolar.high],
        isReal: true,
      });
    }

    // Ações + Ibovespa via Brapi (se disponível)
    if (brapiResult.success && brapiResult.results) {
      // Coloca IBOV primeiro entre as ações, se vier
      const ibov = brapiResult.results.find(r => r.tk === 'IBOV');
      const acoes = brapiResult.results.filter(r => r.tk !== 'IBOV');

      if (ibov) tickers.push(ibov);
      acoes.forEach(a => tickers.push(a));

      cnnQuotesState.hasReal = true;
      cnnQuotesState.brapiOk = true;
    } else {
      // Fallback: ações simuladas do mktState
      cnnQuotesState.brapiOk = false;
      if (typeof window !== 'undefined' && window.__mktState) {
        const principais = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'BBAS3'];
        principais.forEach(tk => {
          const a = window.__mktState.find(x => x.tk === tk);
          if (a) {
            tickers.push({
              tk: a.tk,
              preco: a.precoAtual,
              var: a.variacao * 100,
              history: a.history || [a.precoAtual],
              isReal: false,
            });
          }
        });
      }
      cnnQuotesState.hasReal = dolarResult.success;
    }

    cnnQuotesState.tickers = tickers;
    cnnQuotesState.lastUpdate = new Date();
    renderCnnPanel();
  }

  // ---------- INIT ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderCnnAgenda();
    renderCnnBottom();
    tickRelogioCnn();
    setInterval(tickRelogioCnn, 1000 * 30); // a cada 30s
  });

  // Tenta atualizar logo + de novo a cada 5 minutos (alinhado com cache)
  setTimeout(atualizarCnnQuotes, 800);
  setInterval(atualizarCnnQuotes, 5 * 60 * 1000);

  // Re-render a cada 3s pra manter sparklines visualmente fluidas (usa estado atual)
  setInterval(() => {
    if (!cnnQuotesState.isReal && typeof window !== 'undefined' && window.__mktState) {
      // atualiza preços do estado simulado
      const principais = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'BBAS3'];
      cnnQuotesState.tickers = principais
        .map(tk => {
          const a = window.__mktState.find(x => x.tk === tk);
          if (!a) return null;
          return {
            tk: a.tk,
            preco: a.precoAtual,
            var: a.variacao * 100,
            history: a.history || [a.precoAtual],
          };
        })
        .filter(Boolean);
      renderCnnPanel();
    }
  }, 3000);

})();

// ============================================================
// DATA·OPS — a mesa de dados
// ETL simulado, conferência com alertas, calculadora e dashboard.
// Todos os dados são sintéticos; o que tem aleatoriedade usa seed
// fixa (mulberry32) pra ser reprodutível a cada visita.
// ============================================================

(function() {
  'use strict';

  if (!document.getElementById('tab-dataops')) return;

  const fmtBR = (n, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (n, d = 2) => (n >= 0 ? '+' : '') + fmtBR(n * 100, d) + '%';

  // PRNG com seed fixa — mesma sequência em toda visita
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // estado compartilhado entre as etapas (o dashboard lê daqui)
  const state = {
    cargas: 0,          // 0..4 fontes carregadas pelo ETL
    confRodada: false,  // conferência das 9h já rodou?
    alertas: [],        // alertas plantados (com flag resolvido)
  };

  // ---------------------------------------------------------
  // ETAPA 1 — ETL: carga do dia com progresso + log de terminal
  // ---------------------------------------------------------
  const etlBtn = document.getElementById('dops-etl-run');
  const etlReset = document.getElementById('dops-etl-reset');
  const etlProgress = document.getElementById('dops-etl-progress');
  const etlFill = document.getElementById('dops-etl-fill');
  const etlPct = document.getElementById('dops-etl-pct');
  const etlLog = document.getElementById('dops-etl-log');

  // roteiro da carga: cada fonte emite suas linhas de log
  // (os "avisos" plantados aqui são os que a conferência vai pegar)
  const ETL_SCRIPT = [
    { pct: 4,   html: '$ python etl_diario.py --data 2026-04-28\n' },
    { pct: 10,  html: '\n[1/4] Preços B3 <span class="t-up">(precos_b3_20260428.csv)</span>\n' },
    { pct: 22,  html: '      ✓ 486 linhas → fato_preco\n' },
    { pct: 28,  html: '      <span class="t-r">[aviso] 1 ativo sem preço → log/pendencias_precos.csv</span>\n', carga: 1 },
    { pct: 36,  html: '\n[2/4] Taxas ANBIMA <span class="t-up">(taxas_anbima_20260428.csv)</span>\n' },
    { pct: 50,  html: '      ✓ 312 linhas → fato_taxa\n', carga: 2 },
    { pct: 58,  html: '\n[3/4] Indexadores CDI · IMA-B 5 · Ibovespa\n' },
    { pct: 70,  html: '      ✓ 3 séries · 126 linhas → fato_indexador\n', carga: 3 },
    { pct: 78,  html: '\n[4/4] Carteiras do Administrador (4 arquivos .xml)\n' },
    { pct: 88,  html: '      ✓ 58 posições → fato_carteira\n' },
    { pct: 94,  html: '      <span class="t-r">[aviso] cotas oficiais: 3 de 4 fundos → fato_cota_admin</span>\n', carga: 4 },
    { pct: 100, html: '\n<span class="t-up">[ok]</span> Carga do dia concluída em 4,2s — conferência liberada\n' },
  ];

  let etlTimers = [];

  function rodarEtl() {
    etlBtn.disabled = true;
    etlBtn.textContent = '… carga em andamento';
    etlProgress.hidden = false;
    etlLog.hidden = false;
    etlLog.innerHTML = '';
    etlTimers.forEach(clearTimeout);
    etlTimers = [];

    let delay = 300;
    ETL_SCRIPT.forEach(passo => {
      etlTimers.push(setTimeout(() => {
        etlLog.innerHTML += passo.html;
        etlLog.scrollTop = etlLog.scrollHeight;
        etlFill.style.width = passo.pct + '%';
        etlPct.textContent = passo.pct + '%';
        if (passo.carga) { state.cargas = passo.carga; atualizarDash(); }
        if (passo.pct === 100) {
          etlBtn.textContent = '✓ carga concluída';
          etlReset.hidden = false;
        }
      }, delay));
      delay += 280 + (passo.html.length > 60 ? 160 : 0);
    });
  }

  function resetEtl() {
    etlTimers.forEach(clearTimeout);
    etlTimers = [];
    etlBtn.disabled = false;
    etlBtn.textContent = '▶ Rodar carga do dia';
    etlProgress.hidden = true;
    etlLog.hidden = true;
    etlLog.innerHTML = '';
    etlFill.style.width = '0%';
    etlPct.textContent = '0%';
    etlReset.hidden = true;
    state.cargas = 0;
    atualizarDash();
  }

  etlBtn && etlBtn.addEventListener('click', rodarEtl);
  etlReset && etlReset.addEventListener('click', resetEtl);

  // ---------------------------------------------------------
  // ETAPA 2 — CONFERÊNCIA: 3 alertas plantados de propósito
  // ---------------------------------------------------------
  const confBtn = document.getElementById('dops-conf-run');
  const confReset = document.getElementById('dops-conf-reset');
  const confAlerts = document.getElementById('dops-alerts');
  const confStatus = document.getElementById('dops-status');
  const confStatusText = document.getElementById('dops-status-text');

  const ALERTAS = [
    {
      tipo: 'COMPLETUDE',
      titulo: 'FIA Dividendos sem cota no arquivo do administrador (3 de 4 fundos recebidos)',
      causa: 'O arquivo de cotas oficiais chegou incompleto. Quase sempre é atraso no ' +
             'fechamento do fundo no administrador — um resgate grande, um provento em ativo ' +
             'da carteira, ou simplesmente falha no envio do arquivo.',
      acao: 'Cobrar o administrador pelo canal oficial e registrar o horário do contato. ' +
            'Enquanto a cota oficial não chega, o fundo NÃO entra no dashboard nem em ' +
            'material pra mesa — número parcial é pior que número atrasado.',
    },
    {
      tipo: 'SANIDADE',
      titulo: 'TAEE11 variou +900% vs. ontem (R$ 34,51 → R$ 345,10) — acima da banda de ±10%',
      causa: 'Padrão clássico de vírgula deslocada no feed de preços (345,10 no lugar de ' +
             '34,51). Antes de concluir, confirmar numa segunda fonte e checar se não houve ' +
             'provento, grupamento ou outro evento corporativo que explique um salto real.',
      acao: 'Corrigir NA ORIGEM: reprocessar o arquivo com o preço certo — nunca editar o ' +
            'número direto no banco, senão a próxima carga reintroduz o erro. Abrir chamado ' +
            'com o provedor do feed.',
    },
    {
      tipo: 'BATIMENTO',
      titulo: 'FIRF Crédito Privado: cota do administrador diverge +8 bps do shadow NAV (tolerância: 1 bp)',
      causa: 'Divergência acima de 1 bp quase sempre é UM ativo marcado diferente nos dois ' +
             'lados. Em crédito privado, o suspeito usual é a marcação de uma debênture ' +
             '(spread de crédito atualizado num lado e não no outro) ou provento apropriado ' +
             'em datas diferentes.',
      acao: 'Abrir a carteira posição a posição e comparar a marcação de cada ativo com a do ' +
            'administrador até achar o que explica os 8 bps. Alinhar a marcação (ou contestar ' +
            'a dele) antes do fechamento do dia.',
    },
  ];

  function renderStatus() {
    if (!state.confRodada) {
      confStatus.dataset.state = 'idle';
      confStatusText.textContent = 'AGUARDANDO CONFERÊNCIA';
      return;
    }
    const abertos = state.alertas.filter(a => !a.resolvido).length;
    if (abertos > 0) {
      confStatus.dataset.state = 'fail';
      confStatusText.textContent = 'DADOS NÃO LIBERADOS — ' + abertos + ' ALERTA' + (abertos > 1 ? 'S' : '') + ' ABERTO' + (abertos > 1 ? 'S' : '');
    } else {
      confStatus.dataset.state = 'ok';
      confStatusText.textContent = 'DADOS LIBERADOS PARA A MESA ✓';
    }
  }

  function renderAlertas() {
    confAlerts.innerHTML = '';
    state.alertas.forEach((a, i) => {
      const el = document.createElement('div');
      el.className = 'dops-alert' + (a.resolvido ? ' dops-alert--resolved' : '');
      el.innerHTML =
        '<button class="dops-alert__head" type="button" aria-expanded="false">' +
          '<span class="dops-alert__badge">' + (a.resolvido ? 'BAIXADO ✓' : a.tipo) + '</span>' +
          '<span class="dops-alert__title">' + a.titulo + '</span>' +
          '<span class="dops-alert__chev">▸</span>' +
        '</button>' +
        '<div class="dops-alert__body">' +
          '<div class="dops-alert__lbl">CAUSA PROVÁVEL</div>' +
          '<div class="dops-alert__txt">' + a.causa + '</div>' +
          '<div class="dops-alert__lbl">AÇÃO</div>' +
          '<div class="dops-alert__txt">' + a.acao + '</div>' +
          (a.resolvido ? '' : '<button class="dops-alert__resolve" type="button">✓ Marcar como resolvido</button>') +
        '</div>';

      el.querySelector('.dops-alert__head').addEventListener('click', () => {
        const aberto = el.classList.toggle('dops-alert--open');
        el.querySelector('.dops-alert__head').setAttribute('aria-expanded', aberto);
      });

      const resolve = el.querySelector('.dops-alert__resolve');
      resolve && resolve.addEventListener('click', () => {
        state.alertas[i].resolvido = true;
        renderAlertas();
        renderStatus();
        atualizarDash();
      });

      confAlerts.appendChild(el);
    });
  }

  function rodarConferencia() {
    state.confRodada = true;
    state.alertas = ALERTAS.map(a => Object.assign({ resolvido: false }, a));
    confBtn.disabled = true;
    confBtn.textContent = '✓ conferência rodada — resolva os alertas';
    confReset.hidden = false;
    confAlerts.hidden = false;
    renderAlertas();
    renderStatus();
    atualizarDash();
  }

  function resetConferencia() {
    state.confRodada = false;
    state.alertas = [];
    confBtn.disabled = false;
    confBtn.textContent = '▶ Rodar conferência';
    confReset.hidden = true;
    confAlerts.hidden = true;
    confAlerts.innerHTML = '';
    renderStatus();
    atualizarDash();
  }

  confBtn && confBtn.addEventListener('click', rodarConferencia);
  confReset && confReset.addEventListener('click', resetConferencia);

  // ---------------------------------------------------------
  // ETAPA 3 — CALCULADORA fundo x benchmark
  // ---------------------------------------------------------
  const calcBtn = document.getElementById('dops-calc-btn');

  // aceita "1.234,56" (BR) e "1234.56" (US)
  function parseNumBR(s) {
    s = String(s || '').trim();
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
  }

  function calcular() {
    const ini = parseNumBR(document.getElementById('dops-calc-ini').value);
    const fim = parseNumBR(document.getElementById('dops-calc-fim').value);
    const bmk = parseNumBR(document.getElementById('dops-calc-bmk').value) / 100;
    const result = document.getElementById('dops-calc-result');
    const verdict = document.getElementById('dops-calc-verdict');

    if (!(ini > 0) || !(fim > 0) || isNaN(bmk)) {
      result.hidden = false;
      verdict.className = 'dops-verdict dops-verdict--dn';
      verdict.textContent = '✗ Preencha as cotas (maiores que zero) e o retorno do benchmark.';
      document.getElementById('dops-calc-ret').textContent = '—';
      document.getElementById('dops-calc-bmk-out').textContent = '—';
      document.getElementById('dops-calc-exc').textContent = '—';
      return;
    }

    const ret = fim / ini - 1;          // retorno da cota
    const excesso = ret - bmk;          // excesso vs. benchmark
    const excessoBps = excesso * 10000; // em basis points

    document.getElementById('dops-calc-ret').textContent = fmtPct(ret, 4);
    document.getElementById('dops-calc-bmk-out').textContent = fmtPct(bmk, 4);
    document.getElementById('dops-calc-exc').textContent =
      (excessoBps >= 0 ? '+' : '') + fmtBR(excessoBps, 1) + ' bps';

    result.hidden = false;
    if (Math.abs(excessoBps) < 0.5) {
      verdict.className = 'dops-verdict';
      verdict.textContent = '≈ Empatou com o benchmark no período.';
    } else if (excesso > 0) {
      verdict.className = 'dops-verdict dops-verdict--up';
      verdict.textContent = '✓ Bateu o benchmark por ' + fmtBR(excessoBps, 1) + ' bps no período.';
    } else {
      verdict.className = 'dops-verdict dops-verdict--dn';
      verdict.textContent = '✗ Perdeu do benchmark por ' + fmtBR(Math.abs(excessoBps), 1) + ' bps no período.';
    }
  }

  calcBtn && calcBtn.addEventListener('click', calcular);
  ['dops-calc-ini', 'dops-calc-fim', 'dops-calc-bmk'].forEach(id => {
    const el = document.getElementById(id);
    el && el.addEventListener('keydown', e => { if (e.key === 'Enter') calcular(); });
  });

  // ---------------------------------------------------------
  // ETAPA 4 — DASHBOARD: gráfico + tabela + cards de status
  // ---------------------------------------------------------

  // série de 60 pregões, seed fixa: benchmark é o "mercado";
  // o fundo segue o mercado (beta ~0,8) com alfa pequeno
  function gerarSeries() {
    const rnd = mulberry32(20260428);
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2 * 1.75; // ~N(0,1)
    const fundo = [100], bmk = [100];
    for (let i = 1; i < 60; i++) {
      const mercado = 0.0005 + 0.009 * gauss();
      const proprio = 0.0004 + 0.005 * gauss();
      bmk.push(bmk[i - 1] * (1 + mercado));
      fundo.push(fundo[i - 1] * (1 + 0.8 * mercado + proprio));
    }
    return { fundo, bmk };
  }

  function desenharGrafico() {
    const svgFund = document.getElementById('dops-chart-fund');
    const svgArea = document.getElementById('dops-chart-fund-area');
    const svgBmk = document.getElementById('dops-chart-bmk');
    if (!svgFund) return;

    const { fundo, bmk } = gerarSeries();
    const todos = fundo.concat(bmk);
    const min = Math.min.apply(null, todos);
    const max = Math.max.apply(null, todos);
    const W = 600, H = 160, PAD = 8;

    const px = i => (i / (fundo.length - 1)) * W;
    const py = v => PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD);
    const path = serie => serie.map((v, i) =>
      (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ',' + py(v).toFixed(1)).join(' ');

    svgBmk.setAttribute('d', path(bmk));
    svgFund.setAttribute('d', path(fundo));
    svgArea.setAttribute('d', path(fundo) + ' L' + W + ',' + H + ' L0,' + H + ' Z');
  }

  // rentabilidades mês/ano dos 4 fundos da mesa (valores fixos, coerentes
  // com o restante do site — Ibov YTD +8,20% aparece também na aba BI)
  const FUNDOS_DASH = [
    { fundo: 'FIRF Soberano CDI',    bmk: 'CDI',      fm: 0.0091, bm: 0.0089, fa: 0.0442, ba: 0.0437 },
    { fundo: 'FIC Inflação Curta',   bmk: 'IMA-B 5',  fm: 0.0074, bm: 0.0081, fa: 0.0395, ba: 0.0410 },
    { fundo: 'FIRF Crédito Privado', bmk: 'CDI',      fm: 0.0105, bm: 0.0089, fa: 0.0512, ba: 0.0437 },
    { fundo: 'FIA Dividendos',       bmk: 'Ibovespa', fm: 0.0231, bm: 0.0184, fa: 0.0978, ba: 0.0820 },
  ];

  function renderTabelaDash() {
    const rows = document.getElementById('dops-dash-rows');
    if (!rows) return;
    rows.innerHTML = FUNDOS_DASH.map(f => {
      const clsM = f.fm >= f.bm ? 't-up' : 't-dn';
      const clsA = f.fa >= f.ba ? 't-up' : 't-dn';
      return '<div class="bi-tab__r">' +
        '<div>' + f.fundo + '</div>' +
        '<div>' + f.bmk + '</div>' +
        '<div class="' + clsM + '">' + fmtPct(f.fm) + '</div>' +
        '<div>' + fmtPct(f.bm) + '</div>' +
        '<div class="' + clsA + '">' + fmtPct(f.fa) + '</div>' +
        '<div>' + fmtPct(f.ba) + '</div>' +
      '</div>';
    }).join('');
  }

  // cards de status do dashboard refletem o que o usuário fez nas etapas
  function atualizarDash() {
    const kCargas = document.getElementById('dops-kpi-cargas');
    const kCargasSub = document.getElementById('dops-kpi-cargas-sub');
    const kAlertas = document.getElementById('dops-kpi-alertas');
    const kAlertasSub = document.getElementById('dops-kpi-alertas-sub');
    const kCota = document.getElementById('dops-kpi-cota');
    const kCotaSub = document.getElementById('dops-kpi-cota-sub');
    if (!kCargas) return;

    kCargas.textContent = state.cargas + '/4';
    kCargasSub.textContent = state.cargas === 4
      ? 'todas as fontes no banco ✓'
      : 'aguardando ETL das 08h';

    if (!state.confRodada) {
      kAlertas.textContent = '—';
      kAlertasSub.textContent = 'conferência não rodada';
      kCota.textContent = 'pendente';
      kCotaSub.textContent = 'batimento vs administrador';
      return;
    }

    const abertos = state.alertas.filter(a => !a.resolvido).length;
    kAlertas.textContent = String(abertos);
    kAlertasSub.textContent = abertos > 0 ? 'resolva na etapa das 09h' : 'tudo tratado ✓';

    const batimento = state.alertas.find(a => a.tipo === 'BATIMENTO');
    if (batimento && !batimento.resolvido) {
      kCota.textContent = '✗ +8 bps';
      kCotaSub.textContent = 'fora da tolerância de 1 bp';
    } else {
      kCota.textContent = '✓ 1 bp';
      kCotaSub.textContent = 'dentro da tolerância';
    }
  }

  desenharGrafico();
  renderTabelaDash();
  atualizarDash();
  renderStatus();

})();
