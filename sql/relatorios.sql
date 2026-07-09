-- ============================================================================
-- ALPHA CAPITAL — RELATÓRIOS DE BACKOFFICE / MIDDLE OFFICE
-- ============================================================================
-- 12 queries que um analista de backoffice/middle realmente roda no dia a dia.
-- Documentadas com o "porquê" cada uma serve, pra quem está estudando.
--
-- Compatível com SQLite 3.35+ (CTEs e window functions).
--
-- Como executar:
--   sqlite3 alpha_capital.db < schema.sql
--   sqlite3 alpha_capital.db < seed.sql
--   sqlite3 alpha_capital.db < relatorios.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) RANKING DE FUNDOS POR PL (visão executiva diária)
-- ----------------------------------------------------------------------------
-- Pra que serve: relatório mais visto pela diretoria. Ranking dos fundos
-- ordenado por PL, com % do PL total da casa e rentabilidade do dia.

SELECT
    f.nome                        AS fundo,
    f.classe_anbima               AS classe,
    pl.pl_total,
    ROUND(pl.pl_total * 100.0 / SUM(pl.pl_total) OVER (), 2) AS pct_total_casa,
    pl.valor_cota,
    ROUND(pl.rentabilidade_dia * 100, 4) || '%' AS rent_dia,
    ROUND(pl.rentabilidade_mtd * 100, 4) || '%' AS rent_mtd,
    ROUND(pl.rentabilidade_ytd * 100, 4) || '%' AS rent_ytd
FROM fato_pl_fundo pl
JOIN dim_fundo f ON f.fundo_id = pl.fundo_id
WHERE pl.data_referencia = (SELECT MAX(data_referencia) FROM fato_pl_fundo)
ORDER BY pl.pl_total DESC;


-- ----------------------------------------------------------------------------
-- 2) TOP 10 EXPOSIÇÕES — VISÃO CONSOLIDADA DA CASA
-- ----------------------------------------------------------------------------
-- Pra que serve: identifica concentração agregada. "Quanto a Alpha tem em
-- Petrobras somando todos os fundos?" — input crítico pra risco e compliance.

SELECT
    a.ticker,
    a.nome                       AS ativo,
    a.classe                     AS classe_ativo,
    SUM(p.quantidade)            AS qtd_total,
    SUM(p.valor_mercado)         AS exposicao_total,
    ROUND(SUM(p.valor_mercado) * 100.0
        / (SELECT SUM(valor_mercado) FROM fato_posicao
           WHERE data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)), 2)
                                 AS pct_total_casa,
    COUNT(DISTINCT p.fundo_id)   AS qtd_fundos_expostos
FROM fato_posicao p
JOIN dim_ativo a ON a.ativo_id = p.ativo_id
WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)
GROUP BY a.ticker, a.nome, a.classe
ORDER BY exposicao_total DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 3) BOLETAS COM DIVERGÊNCIA — PIPELINE DE CASAMENTO
-- ----------------------------------------------------------------------------
-- Pra que serve: lista de "pendências" do operador de backoffice. As 09h da
-- manhã, o cara abre o sistema e essa é a primeira tela que ele vê.

SELECT
    c.casamento_id,
    c.data_operacao,
    f.nome                       AS fundo,
    a.ticker                     AS ativo,
    corr.nome                    AS corretora,
    c.status,
    c.motivo,
    bm.quantidade                AS qtd_mesa,
    bc.quantidade                AS qtd_corretora,
    bm.preco                     AS preco_mesa,
    bc.preco                     AS preco_corretora,
    c.diff_qtd,
    c.diff_preco_pct
FROM fato_casamento c
LEFT JOIN fato_boleta_mesa     bm ON bm.boleta_id = c.boleta_id
LEFT JOIN fato_boleta_corretora bc ON bc.boleta_corr_id = c.boleta_corr_id
LEFT JOIN dim_fundo     f    ON f.fundo_id    = COALESCE(bm.fundo_id, bc.fundo_id)
LEFT JOIN dim_ativo     a    ON a.ativo_id    = COALESCE(bm.ativo_id, bc.ativo_id)
LEFT JOIN dim_corretora corr ON corr.corretora_id = COALESCE(bm.corretora_id, bc.corretora_id)
WHERE c.status <> 'OK'
  AND c.resolvido_em IS NULL
ORDER BY c.data_operacao DESC, c.status;


-- ----------------------------------------------------------------------------
-- 4) % DE CASAMENTO POR CORRETORA (qualidade do parceiro)
-- ----------------------------------------------------------------------------
-- Pra que serve: identifica corretoras que dão mais trabalho. Se XP tem 99% de
-- casamento e BTG tem 92%, pode ser sinal de problema no layout do BTG.

SELECT
    corr.nome                    AS corretora,
    COUNT(*)                     AS total_boletas,
    SUM(CASE WHEN c.status = 'OK'         THEN 1 ELSE 0 END) AS ok,
    SUM(CASE WHEN c.status = 'DIVERGENTE' THEN 1 ELSE 0 END) AS divergente,
    SUM(CASE WHEN c.status LIKE 'FALTA%'  THEN 1 ELSE 0 END) AS faltante,
    ROUND(SUM(CASE WHEN c.status = 'OK' THEN 1.0 ELSE 0 END) * 100.0 / COUNT(*), 2)
                                 AS pct_ok
FROM fato_casamento c
LEFT JOIN fato_boleta_mesa bm ON bm.boleta_id = c.boleta_id
LEFT JOIN dim_corretora corr  ON corr.corretora_id = bm.corretora_id
WHERE c.data_operacao >= DATE('now', '-30 day')
  AND corr.nome IS NOT NULL
GROUP BY corr.nome
ORDER BY pct_ok ASC;  -- pior primeiro


-- ----------------------------------------------------------------------------
-- 5) ENQUADRAMENTO — FUNDOS DE AÇÕES PRECISAM TER ≥67% EM AÇÕES
-- ----------------------------------------------------------------------------
-- Pra que serve: alerta de compliance. Fundos FIA têm regra ANBIMA de 67% em
-- renda variável. Se cair abaixo, vira FIM e tem implicações fiscais.

WITH carteira_por_classe AS (
    SELECT
        p.fundo_id,
        a.classe AS classe_ativo,
        SUM(p.valor_mercado) AS valor
    FROM fato_posicao p
    JOIN dim_ativo a ON a.ativo_id = p.ativo_id
    WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)
    GROUP BY p.fundo_id, a.classe
)
SELECT
    f.nome                       AS fundo,
    f.classe_anbima              AS classe_fundo,
    SUM(CASE WHEN c.classe_ativo IN ('ACAO','BDR','ETF') THEN c.valor ELSE 0 END)
                                 AS valor_em_acoes,
    SUM(c.valor)                 AS pl_alocado,
    ROUND(SUM(CASE WHEN c.classe_ativo IN ('ACAO','BDR','ETF') THEN c.valor ELSE 0 END)
        * 100.0 / SUM(c.valor), 2) AS pct_acoes,
    CASE
        WHEN f.classe_anbima = 'FIA'
             AND SUM(CASE WHEN c.classe_ativo IN ('ACAO','BDR','ETF') THEN c.valor ELSE 0 END)
                  / SUM(c.valor) < 0.67
        THEN 'DESENQUADRADO'
        ELSE 'OK'
    END                          AS status_enquadramento
FROM carteira_por_classe c
JOIN dim_fundo f ON f.fundo_id = c.fundo_id
GROUP BY f.fundo_id, f.nome, f.classe_anbima
ORDER BY status_enquadramento DESC, f.nome;


-- ----------------------------------------------------------------------------
-- 6) NECESSIDADE DE CAIXA POR DATA DE LIQUIDAÇÃO
-- ----------------------------------------------------------------------------
-- Pra que serve: às 10h, o gestor precisa saber quanto vai SAIR de caixa nos
-- próximos D+0, D+1, D+2 pra honrar liquidações. Compras pendentes = saída.

SELECT
    f.nome                       AS fundo,
    a.tipo_liquidacao,
    SUM(CASE WHEN b.lado = 'C' THEN b.valor_bruto ELSE -b.valor_bruto END)
                                 AS necessidade_caixa,
    COUNT(*)                     AS qtd_boletas
FROM fato_boleta_mesa b
JOIN dim_fundo f ON f.fundo_id = b.fundo_id
JOIN dim_ativo a ON a.ativo_id = b.ativo_id
WHERE b.data_operacao = (SELECT MAX(data_operacao) FROM fato_boleta_mesa)
GROUP BY f.nome, a.tipo_liquidacao
ORDER BY f.nome, a.tipo_liquidacao;


-- ----------------------------------------------------------------------------
-- 7) DIVERGÊNCIAS DE CUSTÓDIA — ALPHA vs CUSTODIANTE
-- ----------------------------------------------------------------------------
-- Pra que serve: às 14h, o operador concilia a posição interna contra a do
-- custodiante. Diferenças aqui são MUITO sérias — podem indicar fraude,
-- corretagem errada, ou bug no sistema interno.

SELECT
    co.data_referencia,
    f.nome                       AS fundo,
    a.ticker,
    co.qtd_alpha,
    co.qtd_custodia,
    co.diferenca,
    ROUND(ABS(co.diferenca) * a_preco.preco_mercado, 2) AS impacto_financeiro,
    co.status
FROM fato_conciliacao co
JOIN dim_fundo f ON f.fundo_id = co.fundo_id
JOIN dim_ativo a ON a.ativo_id = co.ativo_id
LEFT JOIN fato_posicao a_preco
       ON a_preco.fundo_id = co.fundo_id
      AND a_preco.ativo_id = co.ativo_id
      AND a_preco.data_referencia = co.data_referencia
WHERE co.status = 'DIVERGENTE'
  AND co.investigado = 0
ORDER BY ABS(co.diferenca) * COALESCE(a_preco.preco_mercado, 0) DESC;


-- ----------------------------------------------------------------------------
-- 8) RENDA FIXA — VENCIMENTOS PRÓXIMOS DOS 90 DIAS
-- ----------------------------------------------------------------------------
-- Pra que serve: planejamento de fluxo de caixa. RF que vence em 90 dias vira
-- caixa, então o gestor já planeja onde vai realocar.

SELECT
    f.nome                       AS fundo,
    a.ticker,
    a.nome                       AS papel,
    a.classe,
    a.indexador,
    a.vencimento,
    JULIANDAY(a.vencimento) - JULIANDAY('now') AS dias_ate_venc,
    p.quantidade,
    p.valor_mercado,
    a.coberto_fgc
FROM fato_posicao p
JOIN dim_ativo a ON a.ativo_id = p.ativo_id
JOIN dim_fundo f ON f.fundo_id = p.fundo_id
WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)
  AND a.vencimento IS NOT NULL
  AND a.vencimento <= DATE('now', '+90 day')
  AND a.vencimento >= DATE('now')
ORDER BY a.vencimento, f.nome;


-- ----------------------------------------------------------------------------
-- 9) DEBÊNTURES SEM COBERTURA FGC — RISCO DE CRÉDITO
-- ----------------------------------------------------------------------------
-- Pra que serve: relatório pra área de risco/crédito. Debêntures NÃO têm
-- cobertura do FGC, então a perda em default é integral. Listar exposição
-- consolidada por emissor é prática padrão de risk management.

SELECT
    SUBSTR(a.ticker, 1, INSTR(a.ticker || '_', '_') - 1) AS emissor_provavel,
    a.ticker,
    a.vencimento,
    SUM(p.quantidade)            AS qtd_total,
    SUM(p.valor_mercado)         AS exposicao,
    COUNT(DISTINCT p.fundo_id)   AS fundos_expostos,
    'NÃO COBERTO PELO FGC'       AS aviso
FROM fato_posicao p
JOIN dim_ativo a ON a.ativo_id = p.ativo_id
WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)
  AND a.classe = 'DEB'
  AND a.coberto_fgc = 0
GROUP BY emissor_provavel, a.ticker, a.vencimento
ORDER BY exposicao DESC;


-- ----------------------------------------------------------------------------
-- 10) HISTÓRICO DE COTA — DRAWDOWN E PICOS
-- ----------------------------------------------------------------------------
-- Pra que serve: drawdown é métrica fundamental de risco. Window function
-- calcula o pico histórico da cota e quanto o fundo está abaixo dele agora.

WITH cotas AS (
    SELECT
        pl.data_referencia,
        f.nome AS fundo,
        pl.valor_cota,
        MAX(pl.valor_cota) OVER (
            PARTITION BY pl.fundo_id
            ORDER BY pl.data_referencia
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS pico_historico
    FROM fato_pl_fundo pl
    JOIN dim_fundo f ON f.fundo_id = pl.fundo_id
)
SELECT
    fundo,
    data_referencia,
    valor_cota,
    pico_historico,
    ROUND((valor_cota - pico_historico) / pico_historico * 100, 4) || '%'
                                 AS drawdown_atual
FROM cotas
WHERE data_referencia = (SELECT MAX(data_referencia) FROM cotas)
ORDER BY (valor_cota - pico_historico) / pico_historico ASC;  -- pior primeiro


-- ----------------------------------------------------------------------------
-- 11) VOLUME DE OPERAÇÃO POR TRADER
-- ----------------------------------------------------------------------------
-- Pra que serve: gestão de mesa. Quem é o trader mais ativo? Em que ativos?
-- Útil pra revisão de performance e detecção de padrões anômalos.

SELECT
    b.trader,
    COUNT(*)                     AS qtd_boletas,
    SUM(b.valor_bruto)           AS volume_total,
    ROUND(AVG(b.valor_bruto), 2) AS ticket_medio,
    SUM(CASE WHEN b.lado = 'C' THEN b.valor_bruto ELSE 0 END) AS volume_compra,
    SUM(CASE WHEN b.lado = 'V' THEN b.valor_bruto ELSE 0 END) AS volume_venda
FROM fato_boleta_mesa b
WHERE b.data_operacao >= DATE('now', '-30 day')
  AND b.trader IS NOT NULL
GROUP BY b.trader
ORDER BY volume_total DESC;


-- ----------------------------------------------------------------------------
-- 12) P&L INTRADAY POR FUNDO — DECOMPOSIÇÃO
-- ----------------------------------------------------------------------------
-- Pra que serve: às 17h, o gestor olha quanto cada fundo ganhou/perdeu no dia
-- e pede explicação se algo estourou expectativa.

SELECT
    f.nome                       AS fundo,
    pl.pl_total,
    pl.captacao_dia,
    pl.resgate_dia,
    pl.captacao_dia - pl.resgate_dia AS captacao_liquida,
    -- aproximação: variação do PL menos o efeito de captação
    pl.pl_total - LAG(pl.pl_total) OVER (PARTITION BY pl.fundo_id ORDER BY pl.data_referencia)
                                 AS variacao_pl_total,
    (pl.pl_total - LAG(pl.pl_total) OVER (PARTITION BY pl.fundo_id ORDER BY pl.data_referencia))
        - (pl.captacao_dia - pl.resgate_dia)
                                 AS pnl_estimado,
    ROUND(pl.rentabilidade_dia * 100, 4) || '%' AS rent_dia
FROM fato_pl_fundo pl
JOIN dim_fundo f ON f.fundo_id = pl.fundo_id
WHERE pl.data_referencia >= (SELECT DATE(MAX(data_referencia), '-1 day') FROM fato_pl_fundo)
ORDER BY pl.data_referencia DESC, ABS(pl.rentabilidade_dia) DESC;
