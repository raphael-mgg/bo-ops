-- ============================================================================
-- ALPHA CAPITAL — CONSULTAS DA MESA DE DADOS (DATA·OPS)
-- ============================================================================
-- 3 queries que o time de dados roda TODO dia antes de liberar número pra mesa,
-- na ordem da rotina: completude → atualidade → batimento.
-- Companheiras da aba DATA·OPS do site; documentadas com o "porquê".
--
-- Compatível com SQLite 3.35+ (mesmo banco de schema.sql + seed.sql).
--
-- Como executar:
--   sqlite3 alpha_capital.db < schema.sql
--   sqlite3 alpha_capital.db < seed.sql
--   sqlite3 alpha_capital.db < relatorios_dataops.sql
-- ============================================================================


-- ============================================================================
-- 1) COMPLETUDE — todo fundo tem cota na última data? todo ativo tem preço?
-- ----------------------------------------------------------------------------
-- Por quê: linha que falta é o erro mais silencioso que existe — nenhum número
-- fica "errado", ele simplesmente não está lá. O LEFT JOIN + IS NULL acha
-- exatamente o que NÃO chegou. Fundo sem cota = cobrar o administrador;
-- posição sem preço de mercado = cobrar o feed de preços.
-- ============================================================================

-- 1a. Fundos sem snapshot de PL/cota na data mais recente da base
SELECT f.nome,
       f.classe_anbima,
       CASE WHEN pl.fundo_id IS NULL
            THEN '✗ SEM COTA — cobrar administrador'
            ELSE '✓ OK' END                       AS status_cota
FROM dim_fundo f
LEFT JOIN fato_pl_fundo pl
       ON pl.fundo_id = f.fundo_id
      AND pl.data_referencia = (SELECT MAX(data_referencia) FROM fato_pl_fundo)
ORDER BY status_cota DESC, f.nome;

-- 1b. Posições da última data sem preço de mercado (ou com preço zerado)
SELECT f.nome                                     AS fundo,
       a.ticker                                   AS ativo,
       p.quantidade,
       p.preco_mercado
FROM fato_posicao p
JOIN dim_fundo f  ON f.fundo_id = p.fundo_id
JOIN dim_ativo a  ON a.ativo_id = p.ativo_id
WHERE p.data_referencia = (SELECT MAX(data_referencia) FROM fato_posicao)
  AND (p.preco_mercado IS NULL OR p.preco_mercado <= 0);


-- ============================================================================
-- 2) ATUALIDADE — qual a última data carregada em cada tabela de fatos?
-- ----------------------------------------------------------------------------
-- Por quê: é o "painel de freshness" do pipeline. Se fato_posicao parou em
-- D-1 e fato_pl_fundo está em D0, alguma carga não rodou — melhor descobrir
-- às 8h da manhã do que às 18h com a mesa esperando. O UNION ALL monta uma
-- linha por tabela, imitando o que ferramentas de observabilidade fazem.
-- ============================================================================

SELECT 'fato_boleta_mesa'   AS tabela, MAX(data_operacao)    AS ultima_data, COUNT(*) AS linhas FROM fato_boleta_mesa
UNION ALL
SELECT 'fato_posicao',                 MAX(data_referencia),                 COUNT(*)           FROM fato_posicao
UNION ALL
SELECT 'fato_conciliacao',             MAX(data_referencia),                 COUNT(*)           FROM fato_conciliacao
UNION ALL
SELECT 'fato_pl_fundo',                MAX(data_referencia),                 COUNT(*)           FROM fato_pl_fundo
ORDER BY ultima_data;


-- ============================================================================
-- 3) BATIMENTO — a cota recalculada bate com a cota gravada? (tolerância 1 bp)
-- ----------------------------------------------------------------------------
-- Por quê: é o "shadow NAV" da aba DATA·OPS. Recalculamos a cota por baixo
-- (PL ÷ quantidade de cotas) e comparamos com o valor_cota gravado na tabela.
-- Numa gestora real, o mesmo SELECT compara o cálculo interno com o arquivo
-- do ADMINISTRADOR — basta trocar um dos lados pela tabela de cotas oficiais.
-- Diferença acima de 1 bp (0,01%) = abrir a carteira e achar o ativo culpado.
--
-- Nota didática: no seed.sql alguns fundos têm valor_cota gravado com menos
-- casas decimais do que o cálculo exato — e a query marca esses fundos como
-- divergentes (~1,3 bp). Não é bug: é o batimento pegando arredondamento,
-- exatamente o tipo de diferença silenciosa que ele existe pra pegar.
-- ============================================================================

SELECT f.nome,
       pl.data_referencia,
       pl.valor_cota                                        AS cota_gravada,
       ROUND(pl.pl_total / pl.quantidade_cotas, 8)          AS cota_recalculada,
       ROUND((pl.valor_cota / (pl.pl_total / pl.quantidade_cotas) - 1) * 10000, 2)
                                                            AS diferenca_bps,
       CASE WHEN ABS(pl.valor_cota / (pl.pl_total / pl.quantidade_cotas) - 1) <= 0.0001
            THEN '✓ OK (≤ 1 bp)'
            ELSE '✗ DIVERGENTE — investigar carteira' END   AS status_batimento
FROM fato_pl_fundo pl
JOIN dim_fundo f ON f.fundo_id = pl.fundo_id
WHERE pl.data_referencia = (SELECT MAX(data_referencia) FROM fato_pl_fundo)
ORDER BY ABS(pl.valor_cota / (pl.pl_total / pl.quantidade_cotas) - 1) DESC;
