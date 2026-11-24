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
    tesouraria: document.getElementById('tab-tesouraria'),
    dtvm:    document.getElementById('tab-dtvm'),
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

// ============================================================
// TESOURARIA·OPS — caixa, liquidação, margem, FX e cash ladder
// Terceira camada da operação. Dados simulados e fixos (mesmo
// padrão das outras abas); o que é interativo recalcula ao vivo.
// ============================================================

(function() {
  'use strict';

  if (!document.getElementById('tab-tesouraria')) return;

  const fmtBR = (n, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  // aceita "1.234,56" (BR), "1234.56" (US) e "211.500" (milhar BR sem
  // vírgula: pontos agrupando exatamente 3 dígitos são separador de milhar)
  function parseNumBR(s) {
    s = String(s || '').trim();
    if (!s) return NaN;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    return parseFloat(s);
  }

  // ---------------------------------------------------------
  // MARGEM & COLATERAL — simulador de chamada de margem
  // ---------------------------------------------------------
  // margem base requerida pela B3 por contrato (valores plausíveis
  // pra um multimercado de médio porte; a B3 recalcula todo dia)
  const MARGEM_POSICOES = [
    { contrato: 'DI1 — futuro de juros',  posicao: '180 contratos', base: 486000 },
    { contrato: 'DOL — dólar futuro',     posicao: '40 contratos',  base: 344000 },
    { contrato: 'IND — índice futuro',    posicao: '25 contratos',  base: 232500 },
  ];
  const MARGEM_DEPOSITADA = 1200000; // LFT 900k + dinheiro 300k

  const stressInput = document.getElementById('tes-stress');
  const stressVal = document.getElementById('tes-stress-val');
  const margemRows = document.getElementById('tes-margem-rows');
  const margemStatus = document.getElementById('tes-margem-status');
  const margemStatusText = document.getElementById('tes-margem-status-text');
  const margemAcao = document.getElementById('tes-margem-acao');

  function renderMargem() {
    const stress = parseFloat(stressInput.value); // % adverso
    // cada 1% contra a carteira eleva a margem requerida em ~24%
    // (aproximação didática do recálculo de risco da câmara)
    const fator = 1 + stress * 0.24;

    let reqTotal = 0;
    margemRows.innerHTML = MARGEM_POSICOES.map(p => {
      const req = p.base * fator;
      reqTotal += req;
      return '<tr><td>' + p.contrato + '</td><td>' + p.posicao + '</td>' +
             '<td>R$ ' + fmtBR(req, 0) + '</td><td>—</td><td>—</td></tr>';
    }).join('') +
    '<tr><td><strong>TOTAL</strong></td><td></td>' +
    '<td><strong>R$ ' + fmtBR(reqTotal, 0) + '</strong></td>' +
    '<td><strong>R$ ' + fmtBR(MARGEM_DEPOSITADA, 0) + '</strong></td>' +
    '<td class="' + (MARGEM_DEPOSITADA >= reqTotal ? 'tes-excesso' : 'tes-deficit') + '"><strong>' +
    (MARGEM_DEPOSITADA >= reqTotal ? '+' : '−') + 'R$ ' + fmtBR(Math.abs(MARGEM_DEPOSITADA - reqTotal), 0) +
    '</strong></td></tr>';

    stressVal.textContent = fmtBR(stress) + '%';

    const folga = MARGEM_DEPOSITADA - reqTotal;
    if (folga >= 0) {
      margemStatus.dataset.state = stress === 0 ? 'idle' : 'ok';
      margemStatusText.textContent = 'MARGEM OK — FOLGA DE R$ ' + fmtBR(folga, 0);
      margemAcao.textContent = stress === 0 ? '' :
        'O mercado andou contra, mas a folga segura. A tesouraria monitora — sem ação por enquanto.';
    } else {
      margemStatus.dataset.state = 'fail';
      margemStatusText.textContent = 'CHAMADA DE MARGEM — APORTAR R$ ' + fmtBR(-folga, 0);
      margemAcao.textContent = 'Aportar até o horário de corte da B3, em ordem de preferência: ' +
        'LFT em garantia (continua rendendo), dinheiro (para de render) ou carta de fiança ' +
        '(não consome caixa, mas custa taxa). Se não aportar, a corretora encerra posições.';
    }
  }

  stressInput && stressInput.addEventListener('input', renderMargem);

  // ---------------------------------------------------------
  // MESA DE CÂMBIO — conversão USD→AUD ao vivo
  // ---------------------------------------------------------
  const fxValor = document.getElementById('tes-fx-valor');
  const fxSpot = document.getElementById('tes-fx-spot');
  const fxSpread = document.getElementById('tes-fx-spread');
  const fxNota = document.getElementById('tes-fx-nota');

  function renderFx() {
    const aud = parseNumBR(fxValor.value);
    const spot = parseNumBR(fxSpot.value);       // 1 AUD = spot USD
    const spreadBps = parseNumBR(fxSpread.value);

    const elUsd = document.getElementById('tes-fx-usd');
    const elCusto = document.getElementById('tes-fx-custo');
    const elTotal = document.getElementById('tes-fx-total');

    if (!(aud > 0) || !(spot > 0) || isNaN(spreadBps) || spreadBps < 0) {
      elUsd.textContent = elCusto.textContent = elTotal.textContent = '—';
      fxNota.className = 'dops-verdict dops-verdict--dn';
      fxNota.textContent = '✗ Preencha valor e taxa maiores que zero (spread pode ser 0).';
      return;
    }

    const usdSpot = aud * spot;                    // sem spread
    const custo = usdSpot * (spreadBps / 10000);   // o "pedágio" embutido
    const total = usdSpot + custo;
    const allIn = total / aud;                     // taxa efetiva por AUD

    elUsd.textContent = 'USD ' + fmtBR(usdSpot);
    elCusto.textContent = 'USD ' + fmtBR(custo);
    elTotal.textContent = 'USD ' + fmtBR(total);

    fxNota.className = 'dops-verdict';
    fxNota.textContent = 'Taxa efetiva (all-in): 1 AUD = USD ' + fmtBR(allIn, 4) +
      '. Conversão liquida em D+2 (30/04) — casada de propósito com a liquidação da compra da BHP. ' +
      'A exposição AUD/USD que nasce aqui fica em carteira até a venda (ou até um NDF travar a taxa).';
  }

  [fxValor, fxSpot, fxSpread].forEach(el => el && el.addEventListener('input', renderFx));

  // ---------------------------------------------------------
  // CASH LADDER — projeção D+0 → D+5 (conta movimento BRL)
  // ---------------------------------------------------------
  const CAIXA_MINIMO = 1500000;
  // 01/05/2026 (sexta) é feriado: D+3 útil pula pra 04/05
  const LADDER = [
    { dia: 'D+0', data: '28/04', entrada: 'venda LFT +1.050.000',            saida: 'ajuste futuros −38.420',      saldo: 2804500 },
    { dia: 'D+1', data: '29/04', entrada: '—',                               saida: 'chamada de margem estimada −420.000', saldo: 2384500 },
    { dia: 'D+2', data: '30/04', entrada: 'cupom NTN-B +350.000',            saida: 'liquidação PETR4 −901.980',   saldo: 1832520 },
    { dia: 'D+3', data: '04/05', entrada: '—',                               saida: 'resgate de cotistas −1.200.000', saldo: 632520 },
    { dia: 'D+4', data: '05/05', entrada: 'venda LFT (decidida hoje) +1.050.000', saida: '—',                      saldo: 1682520 },
    { dia: 'D+5', data: '06/05', entrada: 'venda BHP convertida +897.000',   saida: '—',                           saldo: 2579520 },
  ];

  function renderLadder() {
    const svg = document.getElementById('tes-ladder-svg');
    const rows = document.getElementById('tes-ladder-rows');
    if (!svg || !rows) return;

    // ---- gráfico de barras com linha do mínimo ----
    const W = 600, H = 210, TOPO = 24, BASE = H - 30;
    const maxVal = 3000000;
    const barW = 64, gap = (W - LADDER.length * barW) / (LADDER.length + 1);
    const y = v => BASE - (v / maxVal) * (BASE - TOPO);

    let s = '';
    LADDER.forEach((d, i) => {
      const x = gap + i * (barW + gap);
      const abaixo = d.saldo < CAIXA_MINIMO;
      const h = BASE - y(d.saldo);
      s += '<rect x="' + x + '" y="' + y(d.saldo) + '" width="' + barW + '" height="' + h + '"' +
           ' fill="' + (abaixo ? 'var(--red)' : 'var(--accent)') + '" opacity="0.85"/>';
      s += '<text x="' + (x + barW / 2) + '" y="' + (y(d.saldo) - 6) + '" text-anchor="middle"' +
           ' font-family="IBM Plex Mono, monospace" font-size="10"' +
           ' fill="' + (abaixo ? 'var(--red)' : 'var(--fg)') + '">' + fmtBR(d.saldo / 1000000, 2) + '</text>';
      s += '<text x="' + (x + barW / 2) + '" y="' + (BASE + 16) + '" text-anchor="middle"' +
           ' font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--fg-2)">' + d.dia + '</text>';
      if (abaixo) {
        s += '<text x="' + (x + barW / 2) + '" y="' + (TOPO - 8) + '" text-anchor="middle"' +
             ' font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--red)">⚠ ABAIXO DO MÍNIMO</text>';
      }
    });
    // linha do caixa mínimo
    // a linha dasheada é identificada na legenda do card ("– – mínimo");
    // rótulo dentro do gráfico colidiria com as barras
    s += '<line x1="0" y1="' + y(CAIXA_MINIMO) + '" x2="' + W + '" y2="' + y(CAIXA_MINIMO) + '"' +
         ' stroke="var(--red)" stroke-width="1.5" stroke-dasharray="6,4"/>';
    svg.innerHTML = s;

    // ---- tabela de eventos ----
    rows.innerHTML = LADDER.map(d => {
      const abaixo = d.saldo < CAIXA_MINIMO;
      return '<div class="bi-tab__r">' +
        '<div>' + d.dia + '</div>' +
        '<div>' + d.data + '</div>' +
        '<div class="t-up">' + d.entrada + '</div>' +
        '<div class="t-dn">' + d.saida + '</div>' +
        '<div class="' + (abaixo ? 't-dn' : '') + '">R$ ' + fmtBR(d.saldo, 0) + (abaixo ? ' ⚠' : '') + '</div>' +
      '</div>';
    }).join('');
  }

  renderMargem();
  renderFx();
  renderLadder();

})();

// ============================================================
// DTVM·OPS — mesa de crédito privado (intermediação, mercado secundário)
// Quarta camada: a DTVM não gere carteira, intermedia. Cada negócio do
// blotter é acompanhado até a liquidação e a conciliação.
// Dados fictícios e determinísticos: o gerador usa semente fixa, então a
// tela é igual a cada carga; o que é interativo recalcula ao vivo.
// ============================================================

(function() {
  'use strict';

  if (!document.getElementById('tab-dtvm')) return;

  const fmtBR = (n, d = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtR$ = n => 'R$ ' + fmtBR(n);
  const fmtMi = n => 'R$ ' + fmtBR(n / 1e6, 2) + ' mi';
  const fmtInt = n => fmtBR(n, 0);

  // aceita "1.234,56" (BR), "1234.56" (US) e "1.000" (milhar BR)
  function parseNumBR(s) {
    s = String(s || '').trim();
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = id => document.getElementById(id);


  /* ==== MOTOR (puro, sem DOM) — início ==== */

  // ---------------------------------------------------------
  // PREMISSAS DA SIMULAÇÃO
  // ---------------------------------------------------------
  const D0 = '2026-04-28';          // mesmo pregão simulado das outras abas
  const CDI_PROJ = 0.1440;          // CDI projetado (flat, % a.a.) — premissa
  const SEMENTE = 20260428;         // semente fixa: os mesmos dados a cada carga

  // ---------------------------------------------------------
  // CALENDÁRIO — dias úteis base 252 (feriados nacionais, padrão ANBIMA)
  // Datas viram "número do dia" (dias desde 01/01/1970, em UTC) pra
  // somar e comparar sem sustos de fuso horário.
  // ---------------------------------------------------------
  const dn = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  const isoDe = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const brDe = n => { const s = isoDe(n); return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); };
  const brCurto = n => brDe(n).slice(0, 5);
  const anoDe = n => new Date(n * 86400000).getUTCFullYear();
  const diaSemana = n => (n + 4) % 7; // 0 = domingo (01/01/1970 foi uma quinta)

  // Páscoa pelo algoritmo anônimo gregoriano (Meeus/Jones/Butcher)
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(ano, mes - 1, dia) / 86400000;
  }

  // Feriados nacionais do ano: fixos + móveis (Carnaval, Sexta-feira Santa,
  // Corpus Christi). Calculados, não digitados — funciona pra qualquer ano.
  const _cacheFeriados = {};
  function feriados(ano) {
    if (!_cacheFeriados[ano]) {
      const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
      if (ano >= 2024) fixos.push('11-20'); // Consciência Negra (nacional desde 2024)
      const s = new Set(fixos.map(md => dn(ano + '-' + md)));
      const p = pascoa(ano);
      [p - 48, p - 47, p - 2, p + 60].forEach(x => s.add(x));
      _cacheFeriados[ano] = s;
    }
    return _cacheFeriados[ano];
  }

  function ehDiaUtil(n) {
    const w = diaSemana(n);
    return w !== 0 && w !== 6 && !feriados(anoDe(n)).has(n);
  }
  function proxDiaUtil(n) { while (!ehDiaUtil(n)) n++; return n; }
  function diaUtilAnterior(n) { do { n--; } while (!ehDiaUtil(n)); return n; }
  function somaDiasUteis(n, k) { while (k > 0) { n++; if (ehDiaUtil(n)) k--; } return n; }

  // dias úteis de a (inclusive) até b (exclusive) — convenção ANBIMA
  function du(a, b) {
    let c = 0;
    for (let x = a; x < b; x++) if (ehDiaUtil(x)) c++;
    return c;
  }

  // soma meses mantendo o dia (dia 31 vira o último dia do mês, se preciso)
  function somaMeses(n, meses) {
    const d = new Date(n * 86400000);
    const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d.getUTCDate(), ultimo)) / 86400000;
  }

  // ---------------------------------------------------------
  // CRONOGRAMA DE EVENTOS DE UM ATIVO
  // Datas programadas saem do vencimento pra trás, de N em N meses.
  // Evento em dia não útil é pago no dia útil seguinte. Só entram os
  // eventos DEPOIS da liquidação: quem é titular no dia útil anterior ao
  // pagamento é quem recebe, então pagamento na própria data da liquidação
  // já é do vendedor.
  // ---------------------------------------------------------
  function cronograma(a, liq) {
    const venc = dn(a.vencimento), emissao = dn(a.emissao);
    const programadas = [venc];
    if (a.periodicidade > 0) {
      for (let k = 1; ; k++) {
        const d = somaMeses(venc, -k * a.periodicidade);
        if (d <= emissao) break;
        programadas.unshift(d);
      }
    }
    const amortPorData = {};
    (a.amortizacoes || []).forEach(x => { amortPorData[dn(x.data)] = x.pct; });

    let saldo = 1;           // fração do valor nominal de emissão ainda em aberto
    let inicio = emissao;    // início do período de juros corrente
    const futuros = [];
    programadas.forEach(d => {
      const pagamento = proxDiaUtil(d);
      const pct = d === venc ? saldo : (amortPorData[d] || 0); // no vencimento, amortiza o que sobrou
      if (pagamento <= liq) { saldo -= pct; inicio = d; return; } // já pago
      futuros.push({
        data: pagamento,
        inicioPeriodo: inicio,
        saldo,                                        // saldo ANTES do pagamento
        amort: pct,
        dp: du(proxDiaUtil(inicio), pagamento),       // dias úteis do período de juros
        du: du(liq, pagamento),                       // dias úteis da liquidação ao pagamento
      });
      saldo -= pct;
      inicio = d;
    });
    return futuros;
  }

  // ---------------------------------------------------------
  // FATOR DE TAXA POR n DIAS ÚTEIS (base 252)
  //   taxa ao ano (pré, IPCA+, CDI+): (1 + taxa)^(n/252)
  //   % do CDI: (1 + p × CDI diário)^n, CDI diário = (1+CDI)^(1/252) − 1
  // ---------------------------------------------------------
  function fator(indexador, taxa, n, cdi) {
    if (indexador === 'pct_cdi') {
      const diDiario = Math.pow(1 + cdi, 1 / 252) - 1;
      return Math.pow(1 + taxa * diDiario, n);
    }
    return Math.pow(1 + taxa, n / 252);
  }

  // ---------------------------------------------------------
  // FLUXOS FUTUROS (por unidade)
  // Cada fluxo tem duas leituras:
  //   fluxoPreco → o que entra na conta do PU (convenção de mercado)
  //   fluxoCaixa → o dinheiro projetado que cai na conta no dia
  // Em pré, IPCA+ e %CDI as duas são iguais. Em CDI+ não: por convenção,
  // o CDI projetado e o desconto pelo CDI se cancelam, e o PU é calculado
  // só com o spread, sobre VNe × fator DI acumulado no período.
  // ---------------------------------------------------------
  function fluxosDoAtivo(a, liq, cdi = CDI_PROJ) {
    const idx = a.indexador;
    const base = idx === 'ipca' ? a.vna : a.vne;   // IPCA+: VNA atualizado; demais: VNe
    const R = a.fatorAcum || 1;                     // fator DI já realizado no período corrente

    return cronograma(a, liq).map((f, i) => {
      // fator de juros do período pela taxa de emissão
      const capEmissao = a.cupomFixo
        ? Math.pow(1 + a.taxaEmissao, a.periodicidade / 12)   // ex.: NTN-B, 6% a.a. → 2,9563% por semestre
        : fator(idx, a.taxaEmissao, f.dp, cdi);

      let jurosPreco, jurosCaixa, amortPreco, amortCaixa;
      if (idx === 'pre' || idx === 'ipca') {
        jurosPreco = jurosCaixa = base * f.saldo * (capEmissao - 1);
        amortPreco = amortCaixa = base * f.amort;
      } else if (idx === 'cdi_mais') {
        jurosPreco = base * R * f.saldo * (capEmissao - 1);
        amortPreco = base * R * f.amort;
        // caixa: DI realizado + projetado até o pagamento (1º período) ou o período inteiro
        const diPeriodo = i === 0 ? R * Math.pow(1 + cdi, f.du / 252) : Math.pow(1 + cdi, f.dp / 252);
        jurosCaixa = base * f.saldo * (diPeriodo * capEmissao - 1);
        amortCaixa = base * f.amort;
      } else { // pct_cdi — juros projetados com o CDI projetado
        const cap = i === 0 ? R * fator(idx, a.taxaEmissao, f.du, cdi) : capEmissao;
        jurosPreco = jurosCaixa = base * f.saldo * (cap - 1);
        amortPreco = amortCaixa = base * f.amort;
      }
      return Object.assign({}, f, {
        juros: jurosCaixa, amortValor: amortCaixa,
        fluxoPreco: jurosPreco + amortPreco,
        fluxoCaixa: jurosCaixa + amortCaixa,
      });
    });
  }

  // PU = soma dos fluxos trazidos a valor presente pela taxa de mercado.
  // PU truncado em 6 casas (padrão de mercado); duration em anos (du/252).
  const trunc6 = x => Math.floor(x * 1e6 + 1e-7) / 1e6;
  function calcularPU(a, taxa, liq, cdi = CDI_PROJ, fluxos) {
    fluxos = fluxos || fluxosDoAtivo(a, liq, cdi);
    let pu = 0, prazoPonderado = 0;
    const vps = fluxos.map(f => {
      const vp = f.fluxoPreco / fator(a.indexador, taxa, f.du, cdi);
      pu += vp;
      prazoPonderado += vp * f.du / 252;
      return vp;
    });
    return { pu: trunc6(pu), duration: pu > 0 ? prazoPonderado / pu : 0, fluxos, vps };
  }

  // ---------------------------------------------------------
  // CADASTRO — ativos, contrapartes e estoque (tudo fictício)
  // taxas em decimal: 0.0795 = 7,95% a.a.; %CDI: 1.04 = 104% do CDI
  // ---------------------------------------------------------
  const ATIVOS = {
    ENERGIA:    { nome: 'Energia ABC 2032',      classe: 'Debênture', camara: 'B3', indexador: 'ipca',
                  vne: 1000, vna: 1213.452700, taxaEmissao: 0.0685, periodicidade: 6,
                  emissao: '2022-05-15', vencimento: '2032-05-15', taxaRef: 0.0795,
                  amortizacoes: [{ data: '2031-05-15', pct: 0.5 }], lotes: [1000, 1500, 2000, 2500, 3000] },
    RODOVIAS:   { nome: 'Rodovias Leste 2030',   classe: 'Debênture', camara: 'B3', indexador: 'cdi_mais',
                  vne: 1000, fatorAcum: 1.064812, taxaEmissao: 0.0145, periodicidade: 6,
                  emissao: '2025-05-12', vencimento: '2030-05-12', taxaRef: 0.0162,
                  // 10 amortizações semestrais de 10% (a 1ª, de 12/11/2025, já foi paga)
                  amortizacoes: Array.from({ length: 9 }, (_, k) => ({ data: isoDe(somaMeses(dn('2025-11-12'), 6 * k)), pct: 0.1 })),
                  lotes: [2000, 3000, 4000, 5000] },
    CRA_AGRO:   { nome: 'CRA Agro Norte 2029',   classe: 'CRA', camara: 'B3', indexador: 'pre',
                  vne: 1000, taxaEmissao: 0.1340, periodicidade: 6,
                  emissao: '2024-05-20', vencimento: '2029-05-20', taxaRef: 0.1410, lotes: [1500, 2000, 2500, 3000] },
    CRI_LOG:    { nome: 'CRI Logística Sul 2030', classe: 'CRI', camara: 'B3', indexador: 'ipca',
                  vne: 1000, vna: 1162.091500, taxaEmissao: 0.0760, periodicidade: 1,
                  emissao: '2023-06-22', vencimento: '2030-06-22', taxaRef: 0.0835, lotes: [800, 1000, 1500, 2000] },
    NTNB_2035:  { nome: 'NTN-B 2035',            classe: 'Título público', camara: 'Selic', indexador: 'ipca',
                  vne: 1000, vna: 4612.374000, taxaEmissao: 0.06, cupomFixo: true, periodicidade: 6,
                  emissao: '2015-01-15', vencimento: '2035-05-15', taxaRef: 0.0742, lotes: [300, 500, 800, 1000] },
    LF_OMEGA:   { nome: 'LF Banco Ômega 2028',   classe: 'LF', camara: 'B3', indexador: 'pct_cdi',
                  vne: 1000, fatorAcum: 1.247031, taxaEmissao: 1.04, periodicidade: 0,
                  emissao: '2024-07-10', vencimento: '2028-07-10', taxaRef: 1.065, lotes: [1000, 1500, 2000] },
    SANEAMENTO: { nome: 'Saneamento XYZ 2029',   classe: 'Debênture', camara: 'B3', indexador: 'cdi_mais',
                  vne: 1000, fatorAcum: 1.067196, taxaEmissao: 0.0120, periodicidade: 6,
                  emissao: '2024-11-05', vencimento: '2029-11-05', taxaRef: 0.0138,
                  amortizacoes: [{ data: '2027-11-05', pct: 0.3333 }, { data: '2028-11-05', pct: 0.3333 }],
                  lotes: [1000, 1500, 2000] },
    TELECOM:    { nome: 'Telecom Sigma 2031',    classe: 'Debênture', camara: 'B3', indexador: 'ipca',
                  vne: 1000, vna: 1093.221600, taxaEmissao: 0.0710, periodicidade: 12,
                  emissao: '2024-05-25', vencimento: '2031-05-25', taxaRef: 0.0805, lotes: [1000, 1500, 2000] },
    LFT_2029:   { nome: 'LFT 2029',              classe: 'Título público', camara: 'Selic', indexador: 'cdi_mais',
                  rotuloIdx: 'Selic +', vne: 17842.336100, taxaEmissao: 0, periodicidade: 0,
                  emissao: '2023-03-01', vencimento: '2029-03-01', taxaRef: 0.0005, lotes: [100, 150, 200] },
    LF_PI:      { nome: 'LF Banco Pi 2026',      classe: 'LF', camara: 'B3', indexador: 'pct_cdi',
                  vne: 1000, fatorAcum: 1.261284, taxaEmissao: 1.02, periodicidade: 0,
                  emissao: '2024-05-18', vencimento: '2026-05-18', taxaRef: 1.02, lotes: [] },
  };

  const CONTRAPARTES = {
    ALFA:      { nome: 'Fundo Crédito Alfa FIRF CP', tipo: 'Fundo' },
    SIGMA:     { nome: 'Fundo Crédito Sigma FIRF CP', tipo: 'Fundo' },
    DELTA:     { nome: 'Fundo Agro Delta FIAGRO',     tipo: 'Fundo' },
    BETA:      { nome: 'FI-Infra Beta',               tipo: 'Fundo' },
    ATLANTICA: { nome: 'Seguradora Atlântica',        tipo: 'Seguradora' },
    BOREAL:    { nome: 'Seguradora Boreal',           tipo: 'Seguradora' },
    HORIZONTE: { nome: 'Family Office Horizonte',     tipo: 'Family office' },
    MONTE:     { nome: 'Family Office Monte Verde',   tipo: 'Family office' },
    GAMA:      { nome: 'Previdência Gama',            tipo: 'Previdência' },
    KAPPA:     { nome: 'Banco Kappa — tesouraria',    tipo: 'Banco' },
  };

  // carteira própria da DTVM no fechamento de D-1 (estoque pequeno: a mesa intermedia, não gere)
  const ESTOQUE_D1 = { SANEAMENTO: 3000, LF_OMEGA: 1500, LF_PI: 800 };

  // ---------------------------------------------------------
  // GERAÇÃO DETERMINÍSTICA DO BLOTTER
  // O ROTEIRO fixa o desenho do dia (quais pares, quem compra, quem vende,
  // onde estão os problemas). O gerador pseudoaleatório com semente fixa
  // preenche horários, quantidades, taxas e spreads — sempre os mesmos.
  // ---------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // tipo 'par': a mesa compra de um e vende a outro (operação casada)
  // tipo 'avulsa': uma perna só (aplicação de caixa, perna aberta ou venda de estoque)
  // cenarios: marcações dos problemas do dia, aplicadas por perna
  const ROTEIRO = [
    { tipo: 'par', ativo: 'ENERGIA',    compra: 'ALFA',  venda: 'ATLANTICA', dLiq: 0, janela: ['09:02', '09:30'] },
    { tipo: 'par', ativo: 'RODOVIAS',   compra: 'SIGMA', venda: 'HORIZONTE', dLiq: 0, janela: ['09:38', '10:05'] },
    { tipo: 'par', ativo: 'CRA_AGRO',   compra: 'DELTA', venda: 'BOREAL',    dLiq: 0, janela: ['10:12', '10:40'],
      cenarioVenda: { liquidacao: 'falha' } },
    { tipo: 'par', ativo: 'CRI_LOG',    compra: 'MONTE', venda: 'GAMA',      dLiq: 0, janela: ['11:01', '11:30'] },
    { tipo: 'avulsa', ativo: 'LFT_2029', lado: 'C', cp: 'KAPPA',             dLiq: 0, janela: ['12:05', '12:25'],
      nota: 'aplicação do caixa próprio' },
    { tipo: 'par', ativo: 'NTNB_2035',  compra: 'KAPPA', venda: 'GAMA',      dLiq: 0, janela: ['13:08', '13:35'] },
    { tipo: 'par', ativo: 'LF_OMEGA',   compra: 'ALFA',  venda: 'HORIZONTE', dLiq: 1, janela: ['14:30', '14:55'],
      cenarioVenda: { conf: 'qtd' } },
    { tipo: 'par', ativo: 'SANEAMENTO', compra: 'BETA',  venda: 'ATLANTICA', dLiq: 1, janela: ['15:10', '15:40'],
      cenarioCompra: { conf: 'pu' } },
    { tipo: 'avulsa', ativo: 'TELECOM',  lado: 'C', cp: 'SIGMA',             dLiq: 1, janela: ['16:02', '16:15'],
      nota: 'perna aberta — a mesa procura comprador', cenario: { conf: 'data' } },
    { tipo: 'avulsa', ativo: 'LF_OMEGA', lado: 'V', cp: 'BOREAL',            dLiq: 1, janela: ['16:30', '16:36'],
      nota: 'venda de estoque', lotes: [500, 800, 1000], cenario: { conf: 'pendente' } },
    { tipo: 'avulsa', ativo: 'CRI_LOG',  lado: 'C', cp: 'ALFA',              dLiq: 1, janela: ['16:44', '16:52'],
      nota: 'perna aberta — a mesa procura comprador', cenario: { conf: 'pendente' } },
  ];

  const minutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const hhmm = min => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  const arred = (x, casas) => Math.round(x * Math.pow(10, casas)) / Math.pow(10, casas);

  function gerarBlotter() {
    const rnd = mulberry32(SEMENTE);
    const escolhe = lista => lista[Math.floor(rnd() * lista.length)];
    const entre = (a, b) => a + rnd() * (b - a);
    const d0 = dn(D0);
    const negocios = [];
    let numPar = 0;

    ROTEIRO.forEach(r => {
      const a = ATIVOS[r.ativo];
      const ehPct = a.indexador === 'pct_cdi';
      const ehTpf = a.classe === 'Título público';
      const liq = r.dLiq === 0 ? d0 : somaDiasUteis(d0, r.dLiq);
      const qtd = escolhe(r.lotes || a.lotes);
      // taxa "do meio" do dia: referência ± ruído (pct_cdi em pontos de %CDI)
      const meio = a.taxaRef + (ehPct ? entre(-0.0025, 0.0025) : entre(-0.0003, 0.0003));
      const t1 = Math.round(entre(minutos(r.janela[0]), minutos(r.janela[1])));

      const perna = (lado, cp, taxa, min, cenario, extra) => {
        const taxaArred = arred(taxa, ehPct ? 4 : 4);   // 4 casas em decimal = 0,01% (1 bp)
        const pu = calcularPU(a, taxaArred, liq).pu;
        return Object.assign({
          ativoId: r.ativo, lado, cpId: cp, qtd, taxa: taxaArred, liq, dLiq: r.dLiq,
          min, hora: hhmm(min), pu, financeiro: arred(pu * qtd, 2),
          cenario: cenario || {}, nota: r.nota || '',
        }, extra || {});
      };

      if (r.tipo === 'par') {
        numPar++;
        // meio-spread: a mesa compra acima da taxa do meio (PU menor) e vende abaixo (PU maior)
        const meia = ehPct ? escolhe([0.0025, 0.005, 0.0075]) : (ehTpf ? escolhe([0.0001, 0.0002]) : escolhe([0.0002, 0.0003, 0.0004, 0.0005, 0.0006]));
        const t2 = t1 + 3 + Math.floor(rnd() * 16);
        negocios.push(perna('C', r.compra, meio + meia, t1, r.cenarioCompra, { par: numPar }));
        negocios.push(perna('V', r.venda, meio - meia, t2, r.cenarioVenda, { par: numPar }));
      } else {
        negocios.push(perna(r.lado, r.cp, arred(meio, 4), t1, r.cenario, { par: null }));
      }
    });

    negocios.sort((x, y) => x.min - y.min);
    negocios.forEach((n, i) => { n.id = 'DTV-0428-' + String(i + 1).padStart(3, '0'); });
    return negocios;
  }

  /* ==== MOTOR (puro, sem DOM) — fim ==== */


  // ---------------------------------------------------------
  // DADOS DO DIA
  // ---------------------------------------------------------
  const d0 = dn(D0);
  const d1 = somaDiasUteis(d0, 1);
  const NEGOCIOS = gerarBlotter();
  const ativoDe = n => ATIVOS[n.ativoId];
  const cpDe = n => CONTRAPARTES[n.cpId];

  function fmtTaxa(a, t) {
    if (a.indexador === 'pct_cdi') return fmtBR(t * 100, 2) + '% CDI';
    const prefixo = a.rotuloIdx ? a.rotuloIdx + ' ' : ({ pre: '', ipca: 'IPCA + ', cdi_mais: 'CDI + ' }[a.indexador]);
    return prefixo + fmtBR(t * 100, 2) + '%';
  }
  // diferença de taxa entre as pernas: bps (taxa ao ano) ou p.p. do CDI
  function fmtDeltaTaxa(a, dt) {
    return a.indexador === 'pct_cdi' ? fmtBR(dt * 100, 2) + ' p.p.' : fmtBR(dt * 10000, 0) + ' bps';
  }

  // pares casados: { numero: { C: negócio de compra, V: negócio de venda } }
  const PARES = {};
  NEGOCIOS.forEach(n => { if (n.par) (PARES[n.par] = PARES[n.par] || {})[n.lado] = n; });
  const spreadDoPar = p => (p.V.pu - p.C.pu) * p.C.qtd;
  const SPREAD_TOTAL = Object.values(PARES).reduce((s, p) => s + spreadDoPar(p), 0);
  const VOLUME_TOTAL = NEGOCIOS.reduce((s, n) => s + n.financeiro, 0);
  const VOLUME_CASADO = Object.values(PARES).reduce((s, p) => s + p.C.financeiro, 0);

  // ---------------------------------------------------------
  // CONFIRMAÇÕES DA CONTRAPARTE (com as divergências do roteiro)
  // ---------------------------------------------------------
  const CONFIRMACAO = {};
  NEGOCIOS.forEach(n => {
    const c = { pu: n.pu, qtd: n.qtd, liq: n.liq, tipo: n.cenario.conf || null };
    if (c.tipo === 'pu') c.pu = calcularPU(ativoDe(n), n.taxa + 0.0001, n.liq).pu; // contraparte usou +1 bp
    if (c.tipo === 'qtd') c.qtd = n.qtd + 500;
    if (c.tipo === 'data') c.liq = d0;
    if (c.tipo === 'pendente') c.pu = c.qtd = c.liq = null;
    CONFIRMACAO[n.id] = c;
  });

  // texto de cada caso: o que aconteceu, o que fazer, como se resolveu
  const CASOS_CONF = {
    pu: n => ({
      motivo: 'PU diverge: a contraparte calculou a ' + fmtTaxa(ativoDe(n), n.taxa + 0.0001) +
              ' (boleto: ' + fmtTaxa(ativoDe(n), n.taxa) + '). Um bp muda o financeiro em ' +
              fmtR$(Math.abs(n.pu - CONFIRMACAO[n.id].pu) * n.qtd) + '.',
      acao: 'Enviar memória de cálculo do PU',
      resolucao: 'A contraparte conferiu a memória de cálculo, reconheceu a taxa digitada errada e reenviou a confirmação com o PU do boleto.',
    }),
    qtd: n => ({
      motivo: 'Quantidade diverge: a contraparte confirmou ' + fmtInt(CONFIRMACAO[n.id].qtd) +
              ' (boleto: ' + fmtInt(n.qtd) + ').',
      acao: 'Confrontar com a gravação da mesa',
      resolucao: 'A gravação confirma ' + fmtInt(n.qtd) + ' unidades. A contraparte retificou a confirmação.',
    }),
    data: n => ({
      motivo: 'Data diverge: a contraparte entendeu liquidação em ' + brDe(d0) + ' (boleto: ' + brDe(n.liq) +
              '). Negócio das ' + n.hora + ', depois do horário de corte para D+0.',
      acao: 'Reconfirmar o prazo com o operador',
      resolucao: 'O operador da contraparte confirmou D+1 (' + brDe(n.liq) + '). Confirmação retificada.',
    }),
    pendente: n => ({
      motivo: 'A contraparte ainda não mandou a confirmação (negócio das ' + n.hora + ', liquida em ' + brCurto(n.liq) + ').',
      acao: 'Cobrar a confirmação',
      resolucao: 'A contraparte enviou a confirmação. PU, quantidade e data conferem com o boleto.',
    }),
  };

  // ---------------------------------------------------------
  // EVENTOS DO DIA QUE A CONCILIAÇÃO VAI ENCONTRAR
  // ---------------------------------------------------------
  const FALHA = NEGOCIOS.find(n => n.cenario.liquidacao === 'falha');
  const FALHA_PAR = PARES[FALHA.par].C;            // a perna que liquidou
  const SALDO_INICIAL = 25000000;                  // conta de liquidação no banco liquidante
  const TARIFA_B3 = -1284.37;                      // registro e custódia, debitado pela B3
  // resgate antecipado parcial por sorteio, pago hoje: VNe × fator + juros do período + prêmio de 0,30%
  const RESGATE = (() => {
    const a = ATIVOS.SANEAMENTO;
    const pu = trunc6(calcularPU(a, a.taxaEmissao, d0).pu * 1.003);
    return { ativoId: 'SANEAMENTO', qtd: 50, pu, valor: arred(pu * 50, 2) };
  })();

  // ---------------------------------------------------------
  // ESTADO — o que o usuário já resolveu
  // ---------------------------------------------------------
  const estado = {
    confResolvida: {},                                    // id → true
    falha: { contato: false, reagendado: false, incidente: false },
    resgateLancado: false,
    tarifaProvisionada: false,
  };

  function statusConf(n) {
    const c = CONFIRMACAO[n.id];
    if (!c.tipo || estado.confResolvida[n.id]) return 'confirmada';
    return c.tipo === 'pendente' ? 'pendente' : 'divergente';
  }
  function statusLiq(n) {
    if (n.liq > d0) return 'a_liquidar';
    if (n === FALHA) return estado.falha.reagendado ? 'reagendada' : 'falha';
    return 'liquidada';
  }
  // o sistema interno baixa a liquidação sozinho no horário previsto;
  // só o tratamento da falha (reagendamento) estorna essa baixa
  const liquidouNoInterno = n => statusLiq(n) === 'liquidada' || statusLiq(n) === 'falha';
  const liquidouNaCamara = n => statusLiq(n) === 'liquidada';
  const sinal = n => (n.lado === 'C' ? 1 : -1);

  // ---------------------------------------------------------
  // CONCILIAÇÃO — posição e caixa, interno × câmara/banco
  // ---------------------------------------------------------
  function conciliar() {
    const doDia = NEGOCIOS.filter(n => n.liq === d0);
    const ops = { total: doDia.length, conciliadas: doDia.filter(n => liquidouNoInterno(n) === liquidouNaCamara(n)).length };

    const ids = Object.keys(ATIVOS).filter(id => ESTOQUE_D1[id] || doDia.some(n => n.ativoId === id));
    const posicoes = ids.map(id => {
      const estoque = ESTOQUE_D1[id] || 0;
      const movInterno = doDia.filter(n => n.ativoId === id && liquidouNoInterno(n)).reduce((s, n) => s + sinal(n) * n.qtd, 0);
      const movCamara = doDia.filter(n => n.ativoId === id && liquidouNaCamara(n)).reduce((s, n) => s + sinal(n) * n.qtd, 0);
      const resgate = id === RESGATE.ativoId ? RESGATE.qtd : 0;
      const interno = estoque + movInterno - (estado.resgateLancado ? resgate : 0);
      const custodia = estoque + movCamara - resgate;
      let causa = '';
      if (interno !== custodia) causa = id === FALHA.ativoId ? 'reflexo da falha ' + FALHA.id : 'resgate antecipado não lançado';
      return { id, camara: ATIVOS[id].camara, estoque, interno, custodia, dif: interno - custodia, causa };
    });

    const liquido = (camara, filtro) => arred(doDia.filter(n => ativoDe(n).camara === camara && filtro(n))
      .reduce((s, n) => s - sinal(n) * n.financeiro, 0), 2);
    const linhas = [
      { desc: 'Saldo inicial da conta de liquidação', interno: SALDO_INICIAL, extrato: SALDO_INICIAL },
      { desc: 'Liquidações B3 balcão (líquido do dia)', interno: liquido('B3', liquidouNoInterno), extrato: liquido('B3', liquidouNaCamara),
        causa: 'reflexo da falha ' + FALHA.id },
      { desc: 'Liquidações Selic (líquido do dia)', interno: liquido('Selic', liquidouNoInterno), extrato: liquido('Selic', liquidouNaCamara) },
      { desc: 'Resgate antecipado Saneamento XYZ 2029 (' + RESGATE.qtd + ' un.)', interno: estado.resgateLancado ? RESGATE.valor : 0, extrato: RESGATE.valor,
        causa: 'resgate antecipado não lançado' },
      { desc: 'Tarifas B3 (registro e custódia)', interno: estado.tarifaProvisionada ? TARIFA_B3 : 0, extrato: TARIFA_B3,
        causa: 'tarifa não provisionada' },
    ];
    const final = {
      desc: 'Saldo final', total: true,
      interno: arred(linhas.reduce((s, l) => s + l.interno, 0), 2),
      extrato: arred(linhas.reduce((s, l) => s + l.extrato, 0), 2),
    };
    const caixa = linhas.concat([final]).map(l => Object.assign(l, { dif: arred(l.interno - l.extrato, 2) }));

    const excecoes = [];
    if (!estado.falha.reagendado) excecoes.push('falha');
    if (!estado.resgateLancado) excecoes.push('resgate');
    if (!estado.tarifaProvisionada) excecoes.push('tarifa');
    return { ops, posicoes, caixa, excecoes };
  }

  // tudo que ainda está em aberto no dia (alimenta o topo e o relatório)
  function excecoesEmAberto() {
    const lista = [];
    NEGOCIOS.forEach(n => {
      const s = statusConf(n);
      if (s === 'confirmada') return;
      const caso = CASOS_CONF[CONFIRMACAO[n.id].tipo](n);
      lista.push({ origem: 'Confirmação', item: n.id + ' · ' + ativoDe(n).nome, descricao: caso.motivo, acao: caso.acao });
    });
    if (!estado.falha.incidente) {
      const proximo = !estado.falha.contato ? 'Contatar a contraparte'
        : !estado.falha.reagendado ? 'Reagendar e estornar a baixa automática' : 'Registrar o incidente';
      lista.push({ origem: 'Liquidação', item: FALHA.id + ' · ' + ativoDe(FALHA).nome,
        descricao: estado.falha.reagendado ? 'Venda reagendada para ' + brCurto(d1) + '; incidente ainda não registrado.'
                                            : 'Venda não liquidou na B3: a contraparte não lançou a contrapartida.',
        acao: proximo });
    }
    if (!estado.resgateLancado) lista.push({ origem: 'Conciliação', item: 'Saneamento XYZ 2029',
      descricao: 'Resgate antecipado parcial de ' + RESGATE.qtd + ' unidades pago pela B3 e não lançado no sistema.', acao: 'Lançar o evento no sistema' });
    if (!estado.tarifaProvisionada) lista.push({ origem: 'Conciliação', item: 'Tarifas B3',
      descricao: 'Débito de ' + fmtR$(-TARIFA_B3) + ' no extrato sem lançamento interno.', acao: 'Provisionar a tarifa' });
    return lista;
  }

  // ---------------------------------------------------------
  // CARIMBOS DE STATUS
  // ---------------------------------------------------------
  const STATUS = {
    confirmada: ['ok', 'CONFIRMADA'], divergente: ['div', 'DIVERGENTE'], pendente: ['pend', 'PENDENTE'],
    liquidada: ['ok', 'LIQUIDADA'], a_liquidar: ['pend', 'A LIQUIDAR'], falha: ['div', 'FALHA'],
    reagendada: ['pend', 'REAGENDADA'], ok: ['ok', 'CONCILIADO'], div: ['div', 'DIFERENÇA'],
    feito: ['ok', 'FEITO'],
  };
  const carimbo = chave => '<span class="dtvm-stamp dtvm-stamp--' + STATUS[chave][0] + '">' + STATUS[chave][1] + '</span>';
  // segunda linha de uma célula, menor e apagada (ex.: hora sob o ID)
  const dois = s => '<span class="dtvm-2l">' + esc(s) + '</span>';
  const contagem = (rotulo, valor, tipo) =>
    '<span class="dtvm-stamp dtvm-stamp--' + tipo + '">' + valor + ' ' + rotulo + '</span>';

  // ---------------------------------------------------------
  // 1 · BLOTTER
  // ---------------------------------------------------------
  let filtroBlotter = 'todos';
  const FILTROS = {
    todos: () => true, casadas: n => !!n.par, avulsas: n => !n.par,
    d0: n => n.liq === d0, d1: n => n.liq > d0,
  };

  function renderBlotter() {
    $('dtvm-blotter-tbody').innerHTML = NEGOCIOS.filter(FILTROS[filtroBlotter]).map(n => {
      const a = ativoDe(n);
      // duas linhas por célula (ID + hora/par, ativo + classe) pra caber PU e financeiro na tela
      const sub = n.hora + ' · ' + (n.par ? 'par ' + n.par : 'avulsa');
      return '<tr' + (n.par ? ' data-par="' + n.par + '" class="dtvm-par dtvm-par--' + (n.par % 2 ? 'a' : 'b') + '"' : '') + '>' +
        '<td>' + n.id + dois(sub) + '</td>' +
        '<td class="wrap"' + (n.nota ? ' title="' + esc(n.nota) + '"' : '') + '>' + esc(a.nome) + dois(a.classe + (n.nota ? ' · ' + n.nota.split(' — ')[0] : '')) + '</td>' +
        '<td class="dtvm-lado dtvm-lado--' + n.lado + '">' + n.lado + '</td>' +
        '<td class="wrap">' + esc(cpDe(n).nome) + '</td>' +
        '<td class="num">' + fmtInt(n.qtd) + '</td><td class="num">' + fmtTaxa(a, n.taxa) + '</td>' +
        '<td class="num">' + fmtBR(n.pu, 6) + '</td><td class="num">' + fmtBR(n.financeiro) + '</td>' +
        '<td>D+' + n.dLiq + dois(brCurto(n.liq)) + '</td></tr>';
    }).join('');
  }

  function renderPares() {
    $('dtvm-pares-tbody').innerHTML = Object.keys(PARES).map(k => {
      const p = PARES[k], a = ativoDe(p.C);
      return '<tr data-par="' + k + '" class="dtvm-par dtvm-par--' + (k % 2 ? 'a' : 'b') + '"><td>' + esc(a.nome) + dois('par ' + k) + '</td>' +
        '<td class="wrap">' + esc(cpDe(p.C).nome) + '</td><td class="wrap">' + esc(cpDe(p.V).nome) + '</td>' +
        '<td class="num">' + fmtTaxa(a, p.C.taxa) + '</td><td class="num">' + fmtTaxa(a, p.V.taxa) + '</td>' +
        '<td class="num">' + fmtDeltaTaxa(a, p.C.taxa - p.V.taxa) + '</td>' +
        '<td class="num t-up">' + fmtBR(spreadDoPar(p)) + '</td></tr>';
    }).join('') +
      '<tr class="dtvm-total"><td colspan="6" class="wrap">SPREAD TOTAL DA MESA · ≈ ' + fmtBR(SPREAD_TOTAL / VOLUME_CASADO * 10000, 1) +
      ' bps sobre ' + fmtMi(VOLUME_CASADO) + ' casados</td><td class="num">' + fmtBR(SPREAD_TOTAL) + '</td></tr>';
  }

  // passar o mouse numa perna acende as duas (vale pras duas tabelas)
  ['dtvm-blotter-tbody', 'dtvm-pares-tbody'].forEach(id => {
    const tb = $(id);
    const acende = par => document.querySelectorAll('#tab-dtvm tr[data-par]').forEach(tr =>
      tr.classList.toggle('dtvm-par--aceso', par !== null && tr.dataset.par === par));
    tb.addEventListener('mouseover', e => { const tr = e.target.closest('tr[data-par]'); acende(tr ? tr.dataset.par : null); });
    tb.addEventListener('mouseleave', () => acende(null));
  });

  document.querySelectorAll('#tab-dtvm .dtvm-chip').forEach(b => b.addEventListener('click', () => {
    filtroBlotter = b.dataset.filtro;
    document.querySelectorAll('#tab-dtvm .dtvm-chip').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    renderBlotter();
  }));

  // ---------------------------------------------------------
  // 2 · CONFIRMAÇÃO
  // ---------------------------------------------------------
  function renderConfirmacao() {
    const cel = (valor, diverge) => '<td class="num' + (diverge ? ' dtvm-cel--div' : '') + '">' + valor + '</td>';
    const celData = (valor, diverge) => '<td' + (diverge ? ' class="dtvm-cel--div"' : '') + '>' + valor + '</td>';

    $('dtvm-conf-tbody').innerHTML = NEGOCIOS.map(n => {
      const c = CONFIRMACAO[n.id], s = statusConf(n);
      const resolvida = estado.confResolvida[n.id];
      // depois de resolvida, a contraparte mandou os mesmos dados do boleto
      const pu = resolvida ? n.pu : c.pu, qtd = resolvida ? n.qtd : c.qtd, liq = resolvida ? n.liq : c.liq;
      const vazio = '<span class="dtvm-muted">aguardando</span>';
      return '<tr><td>' + n.id + dois(ativoDe(n).nome) + '</td><td class="wrap">' + esc(cpDe(n).nome) + '</td>' +
        '<td class="num">' + fmtBR(n.pu, 6) + '</td>' + cel(pu === null ? vazio : fmtBR(pu, 6), pu !== null && pu !== n.pu) +
        '<td class="num">' + fmtInt(n.qtd) + '</td>' + cel(qtd === null ? vazio : fmtInt(qtd), qtd !== null && qtd !== n.qtd) +
        '<td>' + brCurto(n.liq) + '</td>' + celData(liq === null ? vazio : brCurto(liq), liq !== null && liq !== n.liq) +
        '<td>' + carimbo(s) + '</td></tr>';
    }).join('');

    const tot = { confirmada: 0, divergente: 0, pendente: 0 };
    NEGOCIOS.forEach(n => tot[statusConf(n)]++);
    $('dtvm-conf-resumo').innerHTML = contagem('confirmadas', tot.confirmada, 'ok') +
      contagem('divergentes', tot.divergente, 'div') + contagem('pendentes', tot.pendente, 'pend');

    const abertos = NEGOCIOS.filter(n => CONFIRMACAO[n.id].tipo);
    $('dtvm-conf-pend').innerHTML = '<div class="dtvm-sub">PENDÊNCIAS DE CONFIRMAÇÃO</div>' + abertos.map(n => {
      const caso = CASOS_CONF[CONFIRMACAO[n.id].tipo](n);
      const feito = estado.confResolvida[n.id];
      return '<div class="dtvm-item' + (feito ? ' dtvm-item--ok' : '') + '">' +
        '<div class="dtvm-item__h">' + carimbo(statusConf(n)) + ' <strong>' + n.id + '</strong> · ' + esc(ativoDe(n).nome) + ' · ' + esc(cpDe(n).nome) + '</div>' +
        '<div class="dtvm-item__b">' + esc(feito ? caso.resolucao : caso.motivo) + '</div>' +
        (feito ? '' : '<button type="button" class="dtvm-acao" data-conf="' + n.id + '">' + caso.acao + ' →</button>') +
        '</div>';
    }).join('');
  }

  $('dtvm-conf-pend').addEventListener('click', e => {
    const b = e.target.closest('[data-conf]');
    if (!b) return;
    estado.confResolvida[b.dataset.conf] = true;
    atualizarTudo();
  });
  $('dtvm-conf-reset').addEventListener('click', () => { estado.confResolvida = {}; atualizarTudo(); });

  // ---------------------------------------------------------
  // 3 · CALCULADORA DE PU
  // ---------------------------------------------------------
  const calc = { negocio: null, amortizacoes: [], cupomFixo: false };
  const campos = ['idx', 'taxa', 'emissao', 'per', 'emis', 'liq', 'venc', 'base', 'fator', 'cdi']
    .reduce((o, k) => (o[k] = $('dtvm-pu-' + k), o), {});
  const selNegocio = $('dtvm-pu-negocio');

  selNegocio.innerHTML = '<option value="">— preencher à mão —</option>' + NEGOCIOS.map(n =>
    '<option value="' + n.id + '">' + n.id + ' · ' + n.lado + ' · ' + esc(ativoDe(n).nome) + ' · ' + fmtTaxa(ativoDe(n), n.taxa) + ' · D+' + n.dLiq + '</option>').join('');

  const pct = (x, casas = 2) => fmtBR(x * 100, casas);

  function carregarNegocio(id) {
    const n = NEGOCIOS.find(x => x.id === id);
    if (!n) return;
    const a = ativoDe(n);
    calc.negocio = n;
    calc.amortizacoes = a.amortizacoes || [];
    calc.cupomFixo = !!a.cupomFixo;
    campos.idx.value = a.indexador;
    campos.taxa.value = pct(n.taxa);
    campos.emissao.value = pct(a.taxaEmissao);
    campos.per.value = String(a.periodicidade);
    campos.emis.value = a.emissao;
    campos.liq.value = isoDe(n.liq);
    campos.venc.value = a.vencimento;
    campos.base.value = fmtBR(a.indexador === 'ipca' ? a.vna : a.vne, 6);
    campos.fator.value = fmtBR(a.fatorAcum || 1, 6);
    campos.cdi.value = pct(CDI_PROJ);
    selNegocio.value = id;
    recalcularPU();
  }

  // campos que mudam a estrutura do papel desligam o vínculo com o negócio
  ['idx', 'per', 'emis', 'venc'].forEach(k => campos[k].addEventListener('input', () => {
    calc.negocio = null; calc.amortizacoes = []; calc.cupomFixo = false; selNegocio.value = '';
    recalcularPU();
  }));
  ['taxa', 'emissao', 'liq', 'base', 'fator', 'cdi'].forEach(k => campos[k].addEventListener('input', recalcularPU));
  selNegocio.addEventListener('change', () => {
    if (selNegocio.value) carregarNegocio(selNegocio.value);
    else { calc.negocio = null; recalcularPU(); }
  });

  function ajustarRotulos(idx) {
    const ehPct = idx === 'pct_cdi';
    $('dtvm-pu-taxa-lbl').textContent = ehPct ? 'Taxa de mercado (% do CDI)' : idx === 'cdi_mais' ? 'Spread de mercado (% a.a.)' : 'Taxa de mercado (% a.a.)';
    $('dtvm-pu-emissao-lbl').textContent = ehPct ? 'Taxa de emissão (% do CDI)' : idx === 'cdi_mais' ? 'Spread de emissão (% a.a.)' : 'Taxa de emissão / cupom (% a.a.)';
    $('dtvm-pu-base-lbl').textContent = idx === 'ipca' ? 'VNA atualizado pelo IPCA (R$)' : 'Valor nominal (R$)';
    $('dtvm-pu-fator-wrap').hidden = !(idx === 'cdi_mais' || ehPct);
    $('dtvm-pu-cdi-wrap').hidden = !ehPct;
  }

  function lerCalculadora() {
    const idx = campos.idx.value;
    const ehPct = idx === 'pct_cdi';
    const taxa = parseNumBR(campos.taxa.value) / 100;
    const emissao = parseNumBR(campos.emissao.value) / 100;
    const base = parseNumBR(campos.base.value);
    const fatorAcum = (idx === 'cdi_mais' || ehPct) ? parseNumBR(campos.fator.value) : 1;
    const cdi = parseNumBR(campos.cdi.value) / 100;
    const [emis, liq, venc] = [campos.emis.value, campos.liq.value, campos.venc.value];

    let erro = '';
    if (!(isFinite(taxa) && isFinite(emissao))) erro = 'Preencha a taxa de mercado e a taxa de emissão.';
    else if (ehPct && !(taxa > 0 && emissao > 0)) erro = 'Em % do CDI, as taxas precisam ser maiores que zero.';
    else if (!(base > 0)) erro = 'O valor nominal precisa ser maior que zero.';
    else if (!(fatorAcum > 0)) erro = 'O fator DI acumulado precisa ser maior que zero (1 = período começando hoje).';
    else if (ehPct && !(cdi > 0)) erro = 'Informe o CDI projetado.';
    else if (!emis || !liq || !venc) erro = 'Preencha as três datas.';
    else if (!(dn(emis) < dn(liq) && dn(liq) < dn(venc))) erro = 'As datas precisam estar em ordem: emissão < liquidação < vencimento.';
    else if (!ehDiaUtil(dn(liq))) erro = 'A data de liquidação cai em fim de semana ou feriado. Liquidação só acontece em dia útil.';

    const a = {
      indexador: idx, vne: base, vna: base, fatorAcum, taxaEmissao: emissao,
      periodicidade: Number(campos.per.value), emissao: emis, vencimento: venc,
      amortizacoes: calc.amortizacoes, cupomFixo: calc.cupomFixo,
    };
    return { a, taxa, liq: liq ? dn(liq) : null, cdi: ehPct ? cdi : CDI_PROJ, erro };
  }

  // choques: ±50 e ±100 bps em taxa ao ano; ±2,5 e ±5 p.p. em % do CDI
  const choques = idx => idx === 'pct_cdi'
    ? [-0.05, -0.025, 0, 0.025, 0.05].map(c => ({ c, rot: (c > 0 ? '+' : c < 0 ? '−' : '') + fmtBR(Math.abs(c) * 100, 1) + ' p.p.' }))
    : [-0.01, -0.005, 0, 0.005, 0.01].map(c => ({ c, rot: (c > 0 ? '+' : c < 0 ? '−' : '') + fmtBR(Math.abs(c) * 10000, 0) + ' bps' }));

  function recalcularPU() {
    const { a, taxa, liq, cdi, erro } = lerCalculadora();
    ajustarRotulos(a.indexador);
    const nota = $('dtvm-pu-nota');
    $('dtvm-pu-amort').textContent = a.amortizacoes.length
      ? 'Amortizações conforme a escritura do ativo carregado (' + a.amortizacoes.length + (a.amortizacoes.length === 1 ? ' parcela' : ' parcelas') + ' antes do vencimento' +
        (a.cupomFixo ? '; cupom semestral fixo, como na NTN-B' : '') + '). Mudar indexador, periodicidade ou datas volta para amortização no vencimento.'
      : (a.cupomFixo ? 'Cupom semestral fixo, como na NTN-B.' : 'Amortização integral no vencimento.');

    const limpar = () => {
      ['dtvm-pu-res', 'dtvm-pu-par', 'dtvm-pu-dur'].forEach(id => { $(id).textContent = '—'; });
      $('dtvm-pu-sens').innerHTML = ''; $('dtvm-pu-fluxos').innerHTML = ''; $('dtvm-pu-svg').innerHTML = '';
    };
    if (erro) { limpar(); nota.className = 'dops-verdict dops-verdict--dn'; nota.textContent = '✗ ' + erro; return; }

    const fluxos = fluxosDoAtivo(a, liq, cdi);
    if (!fluxos.length) { limpar(); nota.className = 'dops-verdict dops-verdict--dn'; nota.textContent = '✗ Não há pagamento depois da liquidação.'; return; }

    const r = calcularPU(a, taxa, liq, cdi, fluxos);
    const par = calcularPU(a, a.taxaEmissao, liq, cdi, fluxos).pu;
    const agio = r.pu / par - 1;
    const duTotal = fluxos[fluxos.length - 1].du;

    $('dtvm-pu-res').textContent = fmtBR(r.pu, 6);
    $('dtvm-pu-par').textContent = fmtBR(par, 2) + ' · ' + (agio >= 0 ? '+' : '−') + fmtBR(Math.abs(agio) * 100, 2) + '%';
    $('dtvm-pu-dur').textContent = fmtBR(r.duration, 2) + ' anos · ' + fmtInt(duTotal) + ' du';

    // veredito: confere o boleto quando há negócio carregado
    const n = calc.negocio;
    if (n && Math.abs(taxa - n.taxa) < 1e-9 && liq === n.liq) {
      const bate = Math.abs(r.pu - n.pu) < 1e-6;
      nota.className = 'dops-verdict ' + (bate ? 'dops-verdict--up' : 'dops-verdict--dn');
      nota.textContent = (bate ? '✓ Confere: ' : '✗ Não confere: ') + 'PU do boleto ' + n.id + ' = ' + fmtBR(n.pu, 6) +
        ' · recalculado = ' + fmtBR(r.pu, 6) + '. Financeiro: ' + fmtInt(n.qtd) + ' × PU = ' + fmtR$(n.financeiro) + '.';
    } else if (n) {
      const dif = (r.pu - n.pu) * n.qtd;
      nota.className = 'dops-verdict';
      nota.textContent = 'Fora do boleto: a ' + fmtTaxa(a, taxa) + ' o PU vai a ' + fmtBR(r.pu, 6) + ' (' + (dif >= 0 ? '+' : '−') +
        fmtBR(Math.abs(r.pu - n.pu), 6) + ' por unidade). No negócio ' + n.id + ', de ' + fmtInt(n.qtd) + ' unidades, o financeiro mudaria ' +
        (dif >= 0 ? '+' : '−') + fmtR$(Math.abs(dif)) + '.';
    } else {
      nota.className = 'dops-verdict';
      nota.textContent = Math.abs(agio) < 0.00005
        ? 'Taxa de mercado igual à de emissão: o papel negocia no par.'
        : taxa > a.taxaEmissao
          ? 'Taxa de mercado acima da de emissão: o papel negocia com deságio, abaixo do par.'
          : 'Taxa de mercado abaixo da de emissão: o papel negocia com ágio, acima do par.';
    }

    // sensibilidade
    $('dtvm-pu-sens').innerHTML = choques(a.indexador).map(({ c, rot }) => {
      const p = calcularPU(a, taxa + c, liq, cdi, fluxos).pu;
      const delta = p / r.pu - 1;
      return '<tr' + (c === 0 ? ' class="dtvm-total"' : '') + '><td>' + (c === 0 ? 'taxa atual' : rot) + '</td>' +
        '<td class="num">' + fmtTaxa(a, taxa + c) + '</td><td class="num">' + fmtBR(p, 2) + '</td>' +
        '<td class="num ' + (delta > 0 ? 't-up' : delta < 0 ? 't-dn' : '') + '">' + (c === 0 ? '—' : (delta > 0 ? '+' : '−') + fmtBR(Math.abs(delta) * 100, 2) + '%') + '</td></tr>';
    }).join('');

    desenharCurva(a, taxa, liq, cdi, fluxos, r.pu);

    // fluxo de pagamentos
    $('dtvm-pu-fluxos').innerHTML = fluxos.map((f, i) => {
      const fat = fator(a.indexador, taxa, f.du, cdi);
      return '<tr><td>' + brDe(f.data) + '</td><td class="num">' + fmtInt(f.du) + '</td><td class="num">' + fmtBR(f.saldo * 100, 2) + '%</td>' +
        '<td class="num">' + fmtBR(f.juros, 6) + '</td><td class="num">' + fmtBR(f.amortValor, 6) + '</td>' +
        '<td class="num">' + fmtBR(f.fluxoPreco, 6) + '</td><td class="num">' + fmtBR(fat, 8) + '</td><td class="num">' + fmtBR(r.vps[i], 6) + '</td></tr>';
    }).join('') + '<tr class="dtvm-total"><td colspan="7">PU = soma dos valores presentes (truncado em 6 casas)</td><td class="num">' + fmtBR(r.pu, 6) + '</td></tr>';
  }

  // curva PU × taxa: uma série, linha de 2px, ponto na taxa atual, leitura no hover
  function desenharCurva(a, taxa, liq, cdi, fluxos, puAtual) {
    const svg = $('dtvm-pu-svg');
    const W = 360, H = 200, E = 46, D = 12, T = 14, B = 30;
    const amplitude = a.indexador === 'pct_cdi' ? 0.10 : 0.02;   // ±10 p.p. ou ±200 bps
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = taxa - amplitude + (2 * amplitude * k) / 40;
      pts.push({ t, pu: calcularPU(a, t, liq, cdi, fluxos).pu });
    }
    const minPU = Math.min(...pts.map(p => p.pu)), maxPU = Math.max(...pts.map(p => p.pu));
    const x = t => E + ((t - (taxa - amplitude)) / (2 * amplitude)) * (W - E - D);
    const y = pu => T + (1 - (pu - minPU) / (maxPU - minPU || 1)) * (H - T - B);
    const mono = 'font-family="IBM Plex Mono, monospace" font-size="9"';

    let s = '';
    [minPU, (minPU + maxPU) / 2, maxPU].forEach(v => {
      s += '<line x1="' + E + '" x2="' + (W - D) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-width="1"/>' +
           '<text x="' + (E - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end" ' + mono + ' fill="var(--fg-3)">' + fmtBR(v, 0) + '</text>';
    });
    [taxa - amplitude, taxa, taxa + amplitude].forEach(t => {
      s += '<text x="' + x(t) + '" y="' + (H - 10) + '" text-anchor="middle" ' + mono + ' fill="var(--fg-3)">' + fmtTaxa(a, t) + '</text>';
    });
    s += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.pu).toFixed(1)).join(' ') +
         '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';
    s += '<circle cx="' + x(taxa) + '" cy="' + y(puAtual) + '" r="4.5" fill="var(--accent)" stroke="var(--bg-2)" stroke-width="2"/>';
    s += '<g id="dtvm-curva-hover" visibility="hidden"><line y1="' + T + '" y2="' + (H - B) + '" stroke="var(--fg-3)" stroke-dasharray="3,3"/>' +
         '<circle r="4" fill="var(--fg)"/><rect height="18" fill="var(--bg)" stroke="var(--line-2)"/><text ' + mono + ' fill="var(--fg)"></text></g>';
    s += '<rect x="' + E + '" y="0" width="' + (W - E - D) + '" height="' + H + '" fill="transparent" id="dtvm-curva-alvo"/>';
    svg.innerHTML = s;

    const g = $('dtvm-curva-hover'), alvo = $('dtvm-curva-alvo');
    alvo.addEventListener('mousemove', ev => {
      const caixa = svg.getBoundingClientRect();
      const px = (ev.clientX - caixa.left) * (W / caixa.width);
      const p = pts.reduce((m, q) => Math.abs(x(q.t) - px) < Math.abs(x(m.t) - px) ? q : m, pts[0]);
      const cx = x(p.t), cy = y(p.pu), texto = fmtTaxa(a, p.t) + ' → PU ' + fmtBR(p.pu, 2);
      g.setAttribute('visibility', 'visible');
      g.querySelector('line').setAttribute('x1', cx); g.querySelector('line').setAttribute('x2', cx);
      g.querySelector('circle').setAttribute('cx', cx); g.querySelector('circle').setAttribute('cy', cy);
      const larg = texto.length * 5.6 + 10, bx = Math.min(Math.max(cx - larg / 2, E), W - D - larg);
      const r = g.querySelector('rect'); r.setAttribute('x', bx); r.setAttribute('y', T - 12); r.setAttribute('width', larg);
      const t = g.querySelector('text'); t.setAttribute('x', bx + 5); t.setAttribute('y', T + 1); t.textContent = texto;
    });
    alvo.addEventListener('mouseleave', () => g.setAttribute('visibility', 'hidden'));
  }

  // ---------------------------------------------------------
  // 4 · LIQUIDAÇÃO
  // ---------------------------------------------------------
  function renderLiquidacao() {
    ['B3', 'Selic'].forEach(camara => {
      const lista = NEGOCIOS.filter(n => ativoDe(n).camara === camara);
      const id = camara === 'B3' ? 'dtvm-liq-b3' : 'dtvm-liq-selic';
      $(id).innerHTML = lista.map(n => {
        const s = statusLiq(n), sc = statusConf(n);
        const obs = s === 'a_liquidar' && sc !== 'confirmada' ? ' <span class="dtvm-muted">· confirmar antes da janela</span>' : '';
        return '<tr' + (s === 'falha' ? ' class="dtvm-linha--falha"' : '') + '><td>' + n.id + dois(ativoDe(n).nome) + '</td>' +
          '<td class="dtvm-lado dtvm-lado--' + n.lado + '">' + n.lado + '</td><td class="wrap">' + esc(cpDe(n).nome) + '</td>' +
          '<td class="num">' + fmtBR(n.financeiro) + '</td><td>' + brCurto(s === 'reagendada' ? d1 : n.liq) + '</td>' +
          '<td>' + carimbo(sc) + '</td><td class="wrap">' + carimbo(s) + obs + '</td></tr>';
      }).join('');
      const conta = k => lista.filter(n => statusLiq(n) === k);
      const soma = arr => fmtMi(arr.reduce((s, n) => s + n.financeiro, 0));
      const liq = conta('liquidada'), al = conta('a_liquidar'), fa = conta('falha').concat(conta('reagendada'));
      $(id + '-resumo').innerHTML = contagem('liquidadas · ' + soma(liq), liq.length, 'ok') +
        contagem('a liquidar · ' + soma(al), al.length, 'pend') +
        (fa.length ? contagem((estado.falha.reagendado ? 'falha tratada · ' : 'falha · ') + soma(fa), fa.length, estado.falha.reagendado ? 'pend' : 'div') : '');
    });
  }

  // ---------------------------------------------------------
  // 4b · TRATAMENTO DA FALHA — contato → reagendamento → incidente
  // ---------------------------------------------------------
  const custoOvernight = FALHA.financeiro * (Math.pow(1 + CDI_PROJ, 1 / 252) - 1);
  const PASSOS = [
    { chave: 'contato', titulo: 'Contato com a contraparte', botao: 'Ligar para o backoffice da ' + cpDe(FALHA).nome,
      log: '14:52 · Contato com a ' + cpDe(FALHA).nome + ': a contraparte não lançou a contrapartida na B3 antes do horário-limite da janela. ' +
           'Confirma o negócio e se compromete a liquidar em ' + brCurto(d1) + '.' },
    { chave: 'reagendado', titulo: 'Reagendamento', botao: 'Reagendar para ' + brCurto(d1) + ' e estornar a baixa automática',
      log: '15:05 · Liquidação reagendada para ' + brDe(d1) + ', com novo lançamento das duas partes na B3. Baixa automática estornada no sistema: ' +
           'o ' + ativoDe(FALHA).nome + ' volta para a carteira própria e o recebimento sai do caixa de hoje.' },
    { chave: 'incidente', titulo: 'Registro de incidente', botao: 'Registrar o incidente operacional',
      log: '15:20 · Incidente INC-0428-01 registrado. Causa: falta de lançamento da contraparte. Impacto: ' + fmtR$(FALHA.financeiro) +
           ' que não entraram no caixa por 1 dia útil (custo estimado de ' + fmtR$(custoOvernight) + ' a CDI) e ' + fmtInt(FALHA.qtd) +
           ' ' + ativoDe(FALHA).nome + ' em carteira própria de um dia para o outro. Responsável: backoffice. Prazo: liquidação em ' + brCurto(d1) + '.' },
  ];

  function renderFalha() {
    $('dtvm-falha-intro').innerHTML =
      '<strong>' + FALHA.id + '</strong> · venda de ' + fmtInt(FALHA.qtd) + ' ' + esc(ativoDe(FALHA).nome) + ' à ' + esc(cpDe(FALHA).nome) +
      ' · ' + fmtR$(FALHA.financeiro) + '. A compra casada (' + FALHA_PAR.id + ') liquidou: a DTVM já pagou ' + fmtR$(FALHA_PAR.financeiro) +
      ' ao ' + esc(cpDe(FALHA_PAR).nome) + '. A venda falhou. Siga o tratamento na ordem.';
    let liberado = true;
    $('dtvm-falha-passos').innerHTML = PASSOS.map((p, i) => {
      const feito = estado.falha[p.chave];
      const html = '<li class="dtvm-passo' + (feito ? ' dtvm-passo--ok' : '') + '"><div class="dtvm-passo__n">' + (i + 1) + '</div>' +
        '<div class="dtvm-passo__c"><div class="dtvm-passo__t">' + p.titulo + (feito ? ' ' + carimbo('feito') : '') + '</div>' +
        (feito ? '' : '<button type="button" class="dtvm-acao" data-passo="' + p.chave + '"' + (liberado ? '' : ' disabled') + '>' + esc(p.botao) + ' →</button>') +
        '</div></li>';
      if (!feito) liberado = false;
      return html;
    }).join('');
    const feitos = PASSOS.filter(p => estado.falha[p.chave]);
    $('dtvm-falha-log').innerHTML = '<div class="dtvm-sub">LOG DO INCIDENTE</div>' +
      (feitos.length ? feitos.map(p => '<div class="dtvm-log__l">' + esc(p.log) + '</div>').join('') : '<div class="dtvm-log__l dtvm-muted">nenhuma ação registrada</div>');
  }

  $('dtvm-falha-passos').addEventListener('click', e => {
    const b = e.target.closest('[data-passo]');
    if (!b || b.disabled) return;
    estado.falha[b.dataset.passo] = true;
    atualizarTudo();
  });
  $('dtvm-falha-reset').addEventListener('click', () => {
    estado.falha = { contato: false, reagendado: false, incidente: false };
    atualizarTudo();
  });

  // ---------------------------------------------------------
  // 5 · CONCILIAÇÃO
  // ---------------------------------------------------------
  function renderConciliacao() {
    const c = conciliar();
    $('dtvm-conc-resumo').innerHTML =
      contagem('operações liquidando hoje', c.ops.total, 'pend') +
      contagem('conciliadas', c.ops.conciliadas, 'ok') +
      contagem(c.excecoes.length === 1 ? 'exceção' : 'exceções', c.excecoes.length, c.excecoes.length ? 'div' : 'ok');

    $('dtvm-conc-pos').innerHTML = c.posicoes.map(p =>
      '<tr' + (p.dif ? ' class="dtvm-linha--falha"' : '') + '><td>' + esc(ATIVOS[p.id].nome) + '</td><td>' + p.camara + '</td>' +
      '<td class="num">' + fmtInt(p.estoque) + '</td><td class="num">' + fmtInt(p.interno) + '</td><td class="num">' + fmtInt(p.custodia) + '</td>' +
      '<td class="num' + (p.dif ? ' dtvm-cel--div' : '') + '">' + (p.dif ? (p.dif > 0 ? '+' : '−') + fmtInt(Math.abs(p.dif)) : '0') + '</td>' +
      '<td class="wrap">' + carimbo(p.dif ? 'div' : 'ok') + (p.dif ? ' <span class="dtvm-muted">' + esc(p.causa) + '</span>' : '') + '</td></tr>').join('');

    $('dtvm-conc-caixa').innerHTML = c.caixa.map(l =>
      '<tr class="' + (l.total ? 'dtvm-total' : '') + (l.dif ? ' dtvm-linha--falha' : '') + '"><td class="wrap">' + esc(l.desc) + '</td>' +
      '<td class="num">' + fmtBR(l.interno) + '</td><td class="num">' + fmtBR(l.extrato) + '</td>' +
      '<td class="num' + (l.dif ? ' dtvm-cel--div' : '') + '">' + fmtBR(l.dif) + '</td>' +
      '<td class="wrap">' + carimbo(l.dif ? 'div' : 'ok') + (l.dif && l.causa ? ' <span class="dtvm-muted">' + esc(l.causa) + '</span>' : '') + '</td></tr>').join('');

    const itens = [
      { chave: 'falha', aberto: !estado.falha.reagendado, titulo: 'Venda ' + FALHA.id + ' baixada como liquidada, mas a B3 não liquidou',
        b: 'Aparece duas vezes: sobra ' + fmtInt(FALHA.qtd) + ' ' + ativoDe(FALHA).nome + ' na custódia e faltam ' + fmtR$(FALHA.financeiro) + ' no extrato. É a falha das 14:00, ainda sem tratamento.',
        ok: 'A falha foi reagendada e a baixa automática estornada: interno, custódia e extrato voltaram a concordar.',
        botao: 'Ir para o tratamento da falha', acao: 'ir-falha' },
      { chave: 'resgate', aberto: !estado.resgateLancado, titulo: 'Resgate antecipado parcial da Saneamento XYZ 2029 não lançado',
        b: 'A B3 baixou ' + RESGATE.qtd + ' unidades sorteadas da custódia e o banco creditou ' + fmtR$(RESGATE.valor) +
           ' (PU de resgate ' + fmtBR(RESGATE.pu, 6) + ', com prêmio de 0,30%). O sistema interno não registrou o evento.',
        ok: 'Evento lançado: ' + RESGATE.qtd + ' unidades baixadas e ' + fmtR$(RESGATE.valor) + ' creditados no caixa interno.',
        botao: 'Lançar o evento no sistema', acao: 'resgate' },
      { chave: 'tarifa', aberto: !estado.tarifaProvisionada, titulo: 'Débito de tarifa da B3 sem lançamento interno',
        b: 'O extrato tem um débito de ' + fmtR$(-TARIFA_B3) + ' (registro e custódia) que ninguém provisionou.',
        ok: 'Tarifa provisionada e lançada. O caixa interno bate com o extrato.',
        botao: 'Provisionar a tarifa', acao: 'tarifa' },
    ];
    $('dtvm-conc-exc').innerHTML = '<div class="dtvm-sub">EXCEÇÕES</div>' + itens.map(it =>
      '<div class="dtvm-item' + (it.aberto ? '' : ' dtvm-item--ok') + '"><div class="dtvm-item__h">' + carimbo(it.aberto ? 'div' : 'ok') +
      ' <strong>' + esc(it.titulo) + '</strong></div><div class="dtvm-item__b">' + esc(it.aberto ? it.b : it.ok) + '</div>' +
      (it.aberto ? '<button type="button" class="dtvm-acao" data-conc="' + it.acao + '">' + it.botao + ' →</button>' : '') + '</div>').join('');
  }

  $('dtvm-conc-exc').addEventListener('click', e => {
    const b = e.target.closest('[data-conc]');
    if (!b) return;
    if (b.dataset.conc === 'ir-falha') {
      $('tool-dtvm-falha').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (b.dataset.conc === 'resgate') estado.resgateLancado = true;
    if (b.dataset.conc === 'tarifa') estado.tarifaProvisionada = true;
    atualizarTudo();
  });
  $('dtvm-conc-reset').addEventListener('click', () => {
    estado.resgateLancado = false; estado.tarifaProvisionada = false;
    atualizarTudo();
  });

  // ---------------------------------------------------------
  // 6 · AGENDA DE EVENTOS (próximos 30 dias corridos)
  // ---------------------------------------------------------
  function renderAgenda() {
    const c = conciliar();
    const custodia = id => { const p = c.posicoes.find(x => x.id === id); return p ? p.custodia : 0; };
    // posição depois das liquidações de D+1 (e da venda reagendada, se a falha foi tratada)
    const aposD1 = id => custodia(id) +
      NEGOCIOS.filter(n => n.ativoId === id && n.liq === d1).reduce((s, n) => s + sinal(n) * n.qtd, 0) -
      (id === FALHA.ativoId && estado.falha.reagendado ? FALHA.qtd : 0);

    const linhas = [{
      data: d0, ativoId: RESGATE.ativoId, evento: 'Resgate antecipado parcial (sorteio)', porUnidade: RESGATE.pu,
      hoje: RESGATE.qtd + ' sorteadas', apos: '—', receber: RESGATE.valor, pago: true,
    }];
    Object.keys(ATIVOS).forEach(id => {
      const a = ATIVOS[id];
      fluxosDoAtivo(a, d0).filter(f => f.data <= d0 + 30).forEach(f => {
        const ultimo = f.amort > 0 && Math.abs(f.saldo - f.amort) < 1e-9;
        const evento = ultimo ? 'Vencimento (principal + juros)'
          : f.amort > 0 ? 'Juros + amortização de ' + fmtBR(f.amort * 100, 2) + '%' : 'Juros';
        const pos = aposD1(id);
        linhas.push({ data: f.data, ativoId: id, evento, porUnidade: f.fluxoCaixa,
          hoje: fmtInt(custodia(id)), apos: fmtInt(pos), receber: pos * f.fluxoCaixa });
      });
    });
    linhas.sort((x, y) => x.data - y.data || ATIVOS[x.ativoId].nome.localeCompare(ATIVOS[y.ativoId].nome));

    $('dtvm-agenda-tbody').innerHTML = linhas.map(l =>
      '<tr' + (l.pago ? ' class="dtvm-total"' : '') + '><td>' + brCurto(l.data) + (l.pago ? ' · hoje' : '') + '</td>' +
      '<td>' + (l.pago ? '—' : brCurto(diaUtilAnterior(l.data))) + '</td>' +
      '<td class="wrap">' + esc(ATIVOS[l.ativoId].nome) + '</td><td class="wrap">' + l.evento + '</td>' +
      '<td class="num">' + fmtBR(l.porUnidade, 6) + '</td><td class="num">' + l.hoje + '</td><td class="num">' + l.apos + '</td>' +
      '<td class="num">' + (l.receber > 0 ? fmtBR(l.receber) + (l.pago ? ' <span class="dtvm-muted">creditado</span>' : '') : '<span class="dtvm-muted">—</span>') + '</td></tr>').join('');

    $('dtvm-agenda-nota').textContent = 'Premissas: CDI projetado de ' + pct(CDI_PROJ) + '% a.a.; em IPCA+, VNA de hoje, sem projetar a inflação até o pagamento. ' +
      '"Após D+1" já inclui as liquidações de ' + brCurto(d1) + (estado.falha.reagendado
        ? ' e a venda reagendada do ' + ativoDe(FALHA).nome + '.'
        : '. Enquanto a falha não for tratada, o ' + ativoDe(FALHA).nome + ' continua na carteira da DTVM.');
  }

  // ---------------------------------------------------------
  // 7 · RELATÓRIO GERENCIAL
  // ---------------------------------------------------------
  function agrupar(chave) {
    const g = {};
    NEGOCIOS.forEach(n => {
      const k = chave(n);
      const x = g[k] = g[k] || { k, n: 0, volume: 0, compras: 0, vendas: 0 };
      x.n++; x.volume += n.financeiro;
      if (n.lado === 'V') x.compras += n.financeiro; else x.vendas += n.financeiro; // do ponto de vista da contraparte
    });
    return Object.values(g).sort((a, b) => b.volume - a.volume);
  }
  const porProduto = () => agrupar(n => ativoDe(n).classe);
  const porTipo = () => agrupar(n => cpDe(n).tipo);
  const porContraparte = () => agrupar(n => n.cpId);

  function barras(grupos) {
    const max = Math.max(...grupos.map(g => g.volume));
    return grupos.map(g =>
      '<div class="bi-bar" title="' + esc(g.k) + ': ' + fmtR$(g.volume) + ' em ' + g.n + ' negócio(s)">' +
      '<span class="bi-bar__lbl">' + esc(g.k) + '</span>' +
      '<span class="bi-bar__fill" style="width:' + (g.volume / max * 100).toFixed(1) + '%"></span>' +
      '<span class="bi-bar__v">' + fmtBR(g.volume / 1e6, 1) + '</span></div>').join('');
  }

  function renderRelatorio() {
    const exc = excecoesEmAberto();
    $('dtvm-rel-volume').textContent = fmtMi(VOLUME_TOTAL);
    $('dtvm-rel-volume-d').textContent = NEGOCIOS.length + ' negócios · ' + Object.keys(PARES).length + ' pares casados';
    $('dtvm-rel-spread').textContent = fmtR$(SPREAD_TOTAL);
    $('dtvm-rel-spread-d').textContent = '≈ ' + fmtBR(SPREAD_TOTAL / VOLUME_CASADO * 10000, 1) + ' bps sobre o volume casado';
    $('dtvm-rel-exc').textContent = exc.length;
    $('dtvm-rel-exc').className = 'bi-kpi__val ' + (exc.length ? 't-dn' : 't-up');
    $('dtvm-rel-exc-d').textContent = exc.length ? 'resolva nas seções 02, 04 e 05' : 'dia fechado sem pendências';
    $('dtvm-rel-produto').innerHTML = barras(porProduto());
    $('dtvm-rel-tipo').innerHTML = barras(porTipo());
    $('dtvm-rel-cp').innerHTML = porContraparte().map(g =>
      '<tr><td class="wrap">' + esc(CONTRAPARTES[g.k].nome) + '</td><td>' + CONTRAPARTES[g.k].tipo + '</td><td class="num">' + g.n + '</td>' +
      '<td class="num">' + fmtBR(g.compras) + '</td><td class="num">' + fmtBR(g.vendas) + '</td><td class="num">' + fmtBR(g.volume) + '</td></tr>').join('');
    $('dtvm-rel-exc-tbody').innerHTML = exc.length ? exc.map(x =>
      '<tr><td>' + x.origem + '</td><td class="wrap">' + esc(x.item) + '</td><td class="wrap">' + esc(x.descricao) + '</td><td class="wrap">' + esc(x.acao) + '</td></tr>').join('')
      : '<tr><td colspan="4">' + carimbo('ok') + ' nenhuma exceção em aberto</td></tr>';
  }

  // painel do topo
  function renderKPIs() {
    const exc = excecoesEmAberto();
    const casadas = NEGOCIOS.filter(n => n.par).length;
    $('dtvm-kpi-negocios').textContent = NEGOCIOS.length;
    $('dtvm-kpi-negocios-d').textContent = casadas + ' em pares casados · ' + (NEGOCIOS.length - casadas) + ' avulsos';
    $('dtvm-kpi-volume').textContent = fmtMi(VOLUME_TOTAL);
    $('dtvm-kpi-volume-d').textContent = NEGOCIOS.filter(n => n.liq === d0).length + ' liquidam hoje · ' + NEGOCIOS.filter(n => n.liq > d0).length + ' em ' + brCurto(d1);
    $('dtvm-kpi-spread').textContent = fmtR$(SPREAD_TOTAL);
    $('dtvm-kpi-spread-d').textContent = 'soma dos ' + Object.keys(PARES).length + ' pares casados';
    $('dtvm-kpi-exc').textContent = exc.length;
    $('dtvm-kpi-exc').className = 'bi-kpi__val ' + (exc.length ? 't-dn' : 't-up');
    const porOrigem = o => exc.filter(x => x.origem === o).length;
    $('dtvm-kpi-exc-d').textContent = exc.length
      ? porOrigem('Confirmação') + ' confirmação · ' + porOrigem('Liquidação') + ' liquidação · ' + porOrigem('Conciliação') + ' conciliação'
      : 'tudo confirmado, liquidado e conciliado';
  }

  // ---------------------------------------------------------
  // EXPORTAÇÃO — .xlsx de verdade (zip + XML do Office) e .csv
  // Sem biblioteca externa, mantendo o site 100% estático.
  // ---------------------------------------------------------
  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // zip sem compressão ("store"): cabeçalho local + dados, depois o diretório central
  function zipar(arquivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let offset = 0;
    arquivos.forEach(({ nome, conteudo }) => {
      const nomeB = enc.encode(nome), dados = enc.encode(conteudo), crc = crc32(dados), n = dados.length;
      const local = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2],
       [14, crc, 4], [18, n, 4], [22, n, 4], [26, nomeB.length, 2], [28, 0, 2]]
        .forEach(([p, v, t]) => t === 4 ? local.setUint32(p, v, true) : local.setUint16(p, v, true));
      partes.push(new Uint8Array(local.buffer), nomeB, dados);
      const cd = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2],
       [16, crc, 4], [20, n, 4], [24, n, 4], [28, nomeB.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2],
       [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([p, v, t]) => t === 4 ? cd.setUint32(p, v, true) : cd.setUint16(p, v, true));
      central.push(new Uint8Array(cd.buffer), nomeB);
      offset += 30 + nomeB.length + n;
    });
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, arquivos.length, 2], [10, arquivos.length, 2],
     [12, tamCentral, 4], [16, offset, 4], [20, 0, 2]]
      .forEach(([p, v, t]) => t === 4 ? fim.setUint32(p, v, true) : fim.setUint16(p, v, true));
    const todas = partes.concat(central, [new Uint8Array(fim.buffer)]);
    const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    todas.forEach(p => { saida.set(p, pos); pos += p.length; });
    return saida;
  }

  const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const colunaLetra = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  // estilos: 0 padrão · 1 cabeçalho em negrito · 2 dinheiro · 3 PU (6 casas) · 4 inteiro · 5 taxa (4 casas)
  const ESTILO = { cab: 1, rs: 2, pu: 3, int: 4, taxa: 5 };

  // cada planilha: { nome, larguras: [..], linhas: [[célula, ...]] }
  // célula: texto, número, ou { v: número, f: 'rs'|'pu'|'int'|'taxa' }, ou { t: texto, f: 'cab' }
  function planilhaXml(p) {
    const linhas = p.linhas.map((l, r) => '<row r="' + (r + 1) + '">' + l.map((c, i) => {
      const ref = colunaLetra(i) + (r + 1);
      if (c === null || c === undefined || c === '') return '';
      if (typeof c === 'number') return '<c r="' + ref + '"><v>' + c + '</v></c>';
      if (typeof c === 'object' && 'v' in c) return '<c r="' + ref + '" s="' + ESTILO[c.f] + '"><v>' + c.v + '</v></c>';
      const texto = typeof c === 'object' ? c.t : c, s = typeof c === 'object' ? ' s="' + ESTILO[c.f] + '"' : '';
      return '<c r="' + ref + '" t="inlineStr"' + s + '><is><t xml:space="preserve">' + xml(texto) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const cols = '<cols>' + p.larguras.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + linhas + '</sheetData></worksheet>';
  }

  function montarXlsx(planilhas) {
    const ns = 'http://schemas.openxmlformats.org';
    const arquivos = [
      { nome: '[Content_Types].xml', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="' + ns + '/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        planilhas.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { nome: '_rels/.rels', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + '/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + ns + '/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nome: 'xl/workbook.xml', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + ns + '/spreadsheetml/2006/main" xmlns:r="' + ns + '/officeDocument/2006/relationships"><sheets>' +
        planilhas.map((p, i) => '<sheet name="' + xml(p.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { nome: 'xl/_rels/workbook.xml.rels', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + ns + '/package/2006/relationships">' +
        planilhas.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + ns + '/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (planilhas.length + 1) + '" Type="' + ns + '/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nome: 'xl/styles.xml', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + ns + '/spreadsheetml/2006/main">' +
        '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.000000"/><numFmt numFmtId="165" formatCode="0.0000"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ].concat(planilhas.map((p, i) => ({ nome: 'xl/worksheets/sheet' + (i + 1) + '.xml', conteudo: planilhaXml(p) })));
    return zipar(arquivos);
  }

  const cab = lista => lista.map(t => ({ t, f: 'cab' }));
  const rs = v => ({ v: arred(v, 2), f: 'rs' });

  function linhasBlotter() {
    return NEGOCIOS.map(n => {
      const a = ativoDe(n);
      return [n.id, n.hora, a.nome, a.classe, a.indexador === 'pct_cdi' ? '% CDI' : (a.rotuloIdx || { pre: 'Prefixado', ipca: 'IPCA +', cdi_mais: 'CDI +' }[a.indexador]),
        n.lado === 'C' ? 'Compra' : 'Venda', cpDe(n).nome, cpDe(n).tipo, { v: n.qtd, f: 'int' }, { v: arred(n.taxa * 100, 4), f: 'taxa' },
        { v: n.pu, f: 'pu' }, rs(n.financeiro), brDe(n.liq), n.par ? 'par ' + n.par : 'avulsa',
        STATUS[statusConf(n)][1], STATUS[statusLiq(n)][1]];
    });
  }
  const CAB_BLOTTER = ['ID', 'Hora', 'Ativo', 'Classe', 'Indexador', 'Lado (DTVM)', 'Contraparte', 'Tipo de contraparte',
    'Quantidade', 'Taxa (% a.a. ou % CDI)', 'PU', 'Financeiro (R$)', 'Liquidação', 'Par', 'Confirmação', 'Status de liquidação'];

  function baixar(bytes, nome, tipo) {
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('dtvm-exp-xlsx').addEventListener('click', () => {
    const exc = excecoesEmAberto();
    const resumo = {
      nome: 'Resumo', larguras: [46, 22], linhas: [
        [{ t: 'Relatório gerencial — Ponte DTVM (fictícia) · mesa de crédito privado', f: 'cab' }],
        ['Data de referência', brDe(d0)],
        ['Negócios', NEGOCIOS.length],
        ['Pares casados', Object.keys(PARES).length],
        ['Volume do dia, as duas pontas (R$)', rs(VOLUME_TOTAL)],
        ['Spread total da mesa (R$)', rs(SPREAD_TOTAL)],
        ['Spread sobre o volume casado (bps)', { v: arred(SPREAD_TOTAL / VOLUME_CASADO * 10000, 2), f: 'taxa' }],
        ['Exceções em aberto', exc.length],
        [],
        ['Dados simulados e determinísticos (semente ' + SEMENTE + '). CDI projetado: ' + pct(CDI_PROJ) + '% a.a.'],
      ] };
    const blotter = { nome: 'Blotter', larguras: [14, 7, 24, 15, 11, 12, 30, 16, 11, 12, 16, 17, 12, 8, 13, 18],
      linhas: [cab(CAB_BLOTTER)].concat(linhasBlotter()) };
    const produto = { nome: 'Por produto', larguras: [18, 11, 20],
      linhas: [cab(['Produto', 'Negócios', 'Volume (R$)'])].concat(porProduto().map(g => [g.k, g.n, rs(g.volume)])) };
    const contraparte = { nome: 'Por contraparte', larguras: [30, 15, 11, 20, 20, 20],
      linhas: [cab(['Contraparte', 'Tipo', 'Negócios', 'Comprou da DTVM (R$)', 'Vendeu à DTVM (R$)', 'Volume (R$)'])]
        .concat(porContraparte().map(g => [CONTRAPARTES[g.k].nome, CONTRAPARTES[g.k].tipo, g.n, rs(g.compras), rs(g.vendas), rs(g.volume)])) };
    const excecoes = { nome: 'Exceções', larguras: [14, 34, 80, 38],
      linhas: [cab(['Origem', 'Negócio / item', 'Descrição', 'Próxima ação'])]
        .concat(exc.length ? exc.map(x => [x.origem, x.item, x.descricao, x.acao]) : [['—', 'Nenhuma exceção em aberto']]) };
    baixar(montarXlsx([resumo, blotter, produto, contraparte, excecoes]), 'dtvm-relatorio-' + D0 + '.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  // CSV no padrão do Excel em português: ";" separa colunas, "," decimal, BOM pra acentos
  $('dtvm-exp-csv').addEventListener('click', () => {
    const celula = c => {
      const v = c && typeof c === 'object' ? ('v' in c ? c.v : c.t) : c;
      const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const texto = [CAB_BLOTTER].concat(linhasBlotter()).map(l => l.map(celula).join(';')).join('\r\n');
    baixar('﻿' + texto, 'dtvm-blotter-' + D0 + '.csv', 'text/csv;charset=utf-8');
  });

  // ---------------------------------------------------------
  // INICIALIZAÇÃO
  // ---------------------------------------------------------
  function atualizarTudo() {
    renderConfirmacao();
    renderLiquidacao();
    renderFalha();
    renderConciliacao();
    renderAgenda();
    renderRelatorio();
    renderKPIs();
  }

  renderBlotter();
  renderPares();
  carregarNegocio(NEGOCIOS[0].id);
  atualizarTudo();

})();
