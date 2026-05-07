-- ============================================================================
-- ALPHA CAPITAL — SCHEMA DE BACKOFFICE
-- ============================================================================
-- Modelagem relacional do dia a dia operacional de uma gestora.
-- Compatível com SQLite 3.35+ e PostgreSQL 12+ (com pequenos ajustes).
--
-- Convenções:
--   - Datas em formato ISO (YYYY-MM-DD)
--   - Valores monetários em DECIMAL(18,4) — 4 casas pra acomodar PU de RF
--   - Quantidades em INTEGER (ações) ou DECIMAL(18,4) (cotas, RF unitário)
--   - Chaves naturais quando estáveis (CNPJ, ticker B3) + IDs sintéticos
--
-- Autor: Raphael Monteiro Guimarães Gonçalves
-- Projeto: BO·OPS (https://github.com/raphael-mgg/bo-ops)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- DIMENSÕES
-- ----------------------------------------------------------------------------

-- Fundos sob gestão da Alpha Capital
CREATE TABLE dim_fundo (
    fundo_id        INTEGER PRIMARY KEY,
    cnpj            TEXT NOT NULL UNIQUE,
    nome            TEXT NOT NULL UNIQUE,
    classe_anbima   TEXT NOT NULL,            -- FIA, FIM, FIRF, FIDC etc
    benchmark       TEXT,                      -- CDI, IBOV, IPCA+, IMA-B
    taxa_adm_aa     DECIMAL(6,4) NOT NULL,    -- 0.0200 = 2%
    taxa_perf_aa    DECIMAL(6,4),             -- 0.2000 = 20% sobre o que exceder
    pl_inicial      DECIMAL(18,2) NOT NULL,
    data_inicio     DATE NOT NULL,
    custodiante     TEXT NOT NULL,            -- Itaú, Bradesco, BTG
    administrador   TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT 1,
    CHECK (taxa_adm_aa >= 0 AND taxa_adm_aa <= 1),
    CHECK (taxa_perf_aa IS NULL OR (taxa_perf_aa >= 0 AND taxa_perf_aa <= 1))
);

-- Ativos elegíveis pra carteira (renda variável + renda fixa + câmbio)
CREATE TABLE dim_ativo (
    ativo_id        INTEGER PRIMARY KEY,
    ticker          TEXT NOT NULL UNIQUE,     -- PETR4, LFT_2029, NTNB_2035
    nome            TEXT NOT NULL,
    classe          TEXT NOT NULL,            -- ACAO, OPCAO, FUTURO, ETF, BDR,
                                              -- LFT, LTN, NTNB, CDB, DEB, CAMBIO
    setor           TEXT,                      -- só pra ações
    isin            TEXT,
    moeda           TEXT NOT NULL DEFAULT 'BRL',
    tipo_liquidacao TEXT NOT NULL,            -- D+0, D+1, D+2
    camara          TEXT NOT NULL,            -- B3, SELIC, B3_RF, SPB
    coberto_fgc     BOOLEAN NOT NULL DEFAULT 0,
    indexador       TEXT,                     -- IPCA, SELIC, CDI, PRE, NULL
    vencimento      DATE,                     -- só pra renda fixa
    CHECK (tipo_liquidacao IN ('D+0','D+1','D+2')),
    CHECK (camara IN ('B3','SELIC','B3_RF','SPB'))
);

-- Corretoras autorizadas a operar pra Alpha
CREATE TABLE dim_corretora (
    corretora_id    INTEGER PRIMARY KEY,
    cnpj            TEXT NOT NULL UNIQUE,
    nome            TEXT NOT NULL UNIQUE,     -- XP, BTG, ITAU_BBA, BRADESCO
    layout_arquivo  TEXT NOT NULL,            -- formato do arquivo de boletas
    contato_mesa    TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT 1
);

-- Calendário de pregão (dias úteis e feriados)
CREATE TABLE dim_calendario (
    data            DATE PRIMARY KEY,
    eh_dia_util     BOOLEAN NOT NULL,
    eh_feriado      BOOLEAN NOT NULL,
    nome_feriado    TEXT,
    dia_semana      INTEGER NOT NULL          -- 0=domingo, 6=sábado
);


-- ----------------------------------------------------------------------------
-- FATOS — OPERAÇÕES
-- ----------------------------------------------------------------------------

-- Boletas registradas pela mesa de operações
CREATE TABLE fato_boleta_mesa (
    boleta_id       INTEGER PRIMARY KEY,
    data_operacao   DATE NOT NULL,
    fundo_id        INTEGER NOT NULL,
    ativo_id        INTEGER NOT NULL,
    corretora_id    INTEGER NOT NULL,
    lado            TEXT NOT NULL,            -- C (compra) ou V (venda)
    quantidade      DECIMAL(18,4) NOT NULL,
    preco           DECIMAL(18,4) NOT NULL,
    valor_bruto     DECIMAL(18,2) NOT NULL,   -- quantidade * preco
    trader          TEXT,
    horario         TIME,
    observacao      TEXT,
    FOREIGN KEY (fundo_id) REFERENCES dim_fundo(fundo_id),
    FOREIGN KEY (ativo_id) REFERENCES dim_ativo(ativo_id),
    FOREIGN KEY (corretora_id) REFERENCES dim_corretora(corretora_id),
    CHECK (lado IN ('C', 'V')),
    CHECK (quantidade > 0),
    CHECK (preco > 0)
);

-- Boletas reportadas pelas corretoras (espelho)
CREATE TABLE fato_boleta_corretora (
    boleta_corr_id  INTEGER PRIMARY KEY,
    boleta_id_ref   INTEGER,                  -- ref pra mesa, se casou
    data_operacao   DATE NOT NULL,
    fundo_id        INTEGER NOT NULL,
    ativo_id        INTEGER NOT NULL,
    corretora_id    INTEGER NOT NULL,
    lado            TEXT NOT NULL,
    quantidade      DECIMAL(18,4) NOT NULL,
    preco           DECIMAL(18,4) NOT NULL,
    valor_bruto     DECIMAL(18,2) NOT NULL,
    arquivo_origem  TEXT,                     -- nome do CSV importado
    FOREIGN KEY (fundo_id) REFERENCES dim_fundo(fundo_id),
    FOREIGN KEY (ativo_id) REFERENCES dim_ativo(ativo_id),
    FOREIGN KEY (corretora_id) REFERENCES dim_corretora(corretora_id),
    CHECK (lado IN ('C','V'))
);

-- Resultado do casamento (boleta_mesa x boleta_corretora)
CREATE TABLE fato_casamento (
    casamento_id    INTEGER PRIMARY KEY,
    data_operacao   DATE NOT NULL,
    boleta_id       INTEGER,                  -- pode ser NULL (FALTA_MESA)
    boleta_corr_id  INTEGER,                  -- pode ser NULL (FALTA_CORRETORA)
    status          TEXT NOT NULL,            -- OK / DIVERGENTE / FALTA_MESA / FALTA_CORR
    motivo          TEXT,                     -- ex: "preco_div: 0.5%"
    diff_qtd        DECIMAL(18,4),
    diff_preco_pct  DECIMAL(8,4),
    resolvido_em    TIMESTAMP,
    resolvido_por   TEXT,
    FOREIGN KEY (boleta_id) REFERENCES fato_boleta_mesa(boleta_id),
    FOREIGN KEY (boleta_corr_id) REFERENCES fato_boleta_corretora(boleta_corr_id),
    CHECK (status IN ('OK','DIVERGENTE','FALTA_MESA','FALTA_CORRETORA'))
);


-- ----------------------------------------------------------------------------
-- FATOS — POSIÇÕES E PL
-- ----------------------------------------------------------------------------

-- Posições por fundo/ativo no fechamento (snapshot diário)
CREATE TABLE fato_posicao (
    posicao_id      INTEGER PRIMARY KEY,
    data_referencia DATE NOT NULL,
    fundo_id        INTEGER NOT NULL,
    ativo_id        INTEGER NOT NULL,
    quantidade      DECIMAL(18,4) NOT NULL,
    preco_medio     DECIMAL(18,4) NOT NULL,   -- PM gerencial
    preco_mercado   DECIMAL(18,4) NOT NULL,   -- mark-to-market
    valor_mercado   DECIMAL(18,2) NOT NULL,   -- quantidade * preco_mercado
    pnl_acumulado   DECIMAL(18,2) NOT NULL,   -- (preco_mercado - PM) * qtd
    FOREIGN KEY (fundo_id) REFERENCES dim_fundo(fundo_id),
    FOREIGN KEY (ativo_id) REFERENCES dim_ativo(ativo_id),
    UNIQUE (data_referencia, fundo_id, ativo_id)
);

-- Conciliação com custódia (Alpha vs Custodiante)
CREATE TABLE fato_conciliacao (
    conciliacao_id  INTEGER PRIMARY KEY,
    data_referencia DATE NOT NULL,
    fundo_id        INTEGER NOT NULL,
    ativo_id        INTEGER NOT NULL,
    qtd_alpha       DECIMAL(18,4) NOT NULL,
    qtd_custodia    DECIMAL(18,4) NOT NULL,
    diferenca       DECIMAL(18,4) NOT NULL,
    status          TEXT NOT NULL,            -- OK / DIVERGENTE
    investigado     BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (fundo_id) REFERENCES dim_fundo(fundo_id),
    FOREIGN KEY (ativo_id) REFERENCES dim_ativo(ativo_id),
    CHECK (status IN ('OK','DIVERGENTE'))
);

-- PL e cota dos fundos (snapshot diário, gerado às 18h após fechamento)
CREATE TABLE fato_pl_fundo (
    pl_id               INTEGER PRIMARY KEY,
    data_referencia     DATE NOT NULL,
    fundo_id            INTEGER NOT NULL,
    pl_total            DECIMAL(18,2) NOT NULL,
    valor_cota          DECIMAL(18,8) NOT NULL,
    quantidade_cotas    DECIMAL(18,8) NOT NULL,
    rentabilidade_dia   DECIMAL(8,6),         -- 0.001234 = 0,1234%
    rentabilidade_mtd   DECIMAL(8,6),
    rentabilidade_ytd   DECIMAL(8,6),
    captacao_dia        DECIMAL(18,2) DEFAULT 0,
    resgate_dia         DECIMAL(18,2) DEFAULT 0,
    FOREIGN KEY (fundo_id) REFERENCES dim_fundo(fundo_id),
    UNIQUE (data_referencia, fundo_id)
);


-- ----------------------------------------------------------------------------
-- ÍNDICES PRA PERFORMANCE
-- ----------------------------------------------------------------------------

CREATE INDEX idx_boleta_data       ON fato_boleta_mesa(data_operacao);
CREATE INDEX idx_boleta_fundo      ON fato_boleta_mesa(fundo_id);
CREATE INDEX idx_boleta_corr_data  ON fato_boleta_corretora(data_operacao);
CREATE INDEX idx_casamento_status  ON fato_casamento(status);
CREATE INDEX idx_posicao_data      ON fato_posicao(data_referencia);
CREATE INDEX idx_posicao_fundo     ON fato_posicao(data_referencia, fundo_id);
CREATE INDEX idx_concil_status     ON fato_conciliacao(status);
CREATE INDEX idx_pl_data           ON fato_pl_fundo(data_referencia);


-- ----------------------------------------------------------------------------
-- VIEWS ÚTEIS
-- ----------------------------------------------------------------------------

-- Carteira atual de cada fundo (última posição por fundo/ativo)
CREATE VIEW v_carteira_atual AS
SELECT
    p.data_referencia,
    f.nome             AS fundo,
    f.classe_anbima    AS classe,
    a.ticker,
    a.nome             AS ativo,
    a.classe           AS classe_ativo,
    p.quantidade,
    p.preco_medio,
    p.preco_mercado,
    p.valor_mercado,
    p.pnl_acumulado,
    ROUND(p.valor_mercado / SUM(p.valor_mercado) OVER (PARTITION BY p.data_referencia, p.fundo_id) * 100, 2) AS pct_carteira
FROM fato_posicao p
JOIN dim_fundo  f ON f.fundo_id = p.fundo_id
JOIN dim_ativo  a ON a.ativo_id = p.ativo_id
WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao);

-- Boletas com nomes resolvidos (em vez de IDs)
CREATE VIEW v_boletas AS
SELECT
    b.boleta_id,
    b.data_operacao,
    f.nome      AS fundo,
    a.ticker    AS ativo,
    a.classe    AS classe_ativo,
    c.nome      AS corretora,
    b.lado,
    b.quantidade,
    b.preco,
    b.valor_bruto,
    b.trader,
    b.horario
FROM fato_boleta_mesa b
JOIN dim_fundo     f ON f.fundo_id = b.fundo_id
JOIN dim_ativo     a ON a.ativo_id = b.ativo_id
JOIN dim_corretora c ON c.corretora_id = b.corretora_id;
