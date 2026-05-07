-- ============================================================================
-- ALPHA CAPITAL — SEED DE DADOS SINTÉTICOS
-- ============================================================================
-- Popula o schema com dados coerentes pra demonstração e testes.
-- Mesmo universo do projeto principal (BO·OPS): 5 fundos, 4 corretoras,
-- 15 ativos diversos, ~30 boletas com mistura proposital de status.
--
-- Como usar:
--   sqlite3 alpha_capital.db < schema.sql
--   sqlite3 alpha_capital.db < seed.sql
--   sqlite3 alpha_capital.db < relatorios.sql
--
-- Todos os dados são SINTÉTICOS. Nenhuma referência real.
-- ============================================================================

-- limpa antes (idempotente)
DELETE FROM fato_pl_fundo;
DELETE FROM fato_conciliacao;
DELETE FROM fato_posicao;
DELETE FROM fato_casamento;
DELETE FROM fato_boleta_corretora;
DELETE FROM fato_boleta_mesa;
DELETE FROM dim_calendario;
DELETE FROM dim_corretora;
DELETE FROM dim_ativo;
DELETE FROM dim_fundo;


-- ----------------------------------------------------------------------------
-- DIMENSÕES
-- ----------------------------------------------------------------------------

-- Fundos
INSERT INTO dim_fundo (fundo_id, cnpj, nome, classe_anbima, benchmark, taxa_adm_aa, taxa_perf_aa, pl_inicial, data_inicio, custodiante, administrador) VALUES
(1, '12.345.678/0001-01', 'ALPHA_LONG_BIAS_FIM',    'FIM',  'CDI+2%',     0.0200, 0.20, 15000000.00, '2022-03-01', 'Itaú',      'BNY Mellon'),
(2, '12.345.678/0001-02', 'ALPHA_MULTIMERCADO_FIM', 'FIM',  '110% CDI',   0.0150, 0.20, 10000000.00, '2021-08-15', 'Bradesco',  'BNY Mellon'),
(3, '12.345.678/0001-03', 'ALPHA_RF_FIRF',          'FIRF', 'CDI',        0.0080, NULL,  8000000.00, '2020-01-10', 'Itaú',      'BNY Mellon'),
(4, '12.345.678/0001-04', 'ALPHA_ACOES_FIA',        'FIA',  'IBOV',       0.0200, 0.20,  8000000.00, '2022-06-20', 'BTG',       'BTG Adm'),
(5, '12.345.678/0001-05', 'ALPHA_DIVIDENDOS_FIA',   'FIA',  'IDIV',       0.0150, 0.15,  7000000.00, '2023-02-10', 'Itaú',      'BNY Mellon');


-- Ativos (15 instrumentos cobrindo RV, RF e câmbio)
INSERT INTO dim_ativo (ativo_id, ticker, nome, classe, setor, moeda, tipo_liquidacao, camara, coberto_fgc, indexador, vencimento) VALUES
-- Ações
( 1, 'PETR4',  'Petrobras PN',     'ACAO', 'Petróleo',         'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 2, 'VALE3',  'Vale ON',          'ACAO', 'Mineração',        'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 3, 'ITUB4',  'Itaú Unibanco PN', 'ACAO', 'Bancos',           'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 4, 'BBDC4',  'Bradesco PN',      'ACAO', 'Bancos',           'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 5, 'BBAS3',  'Banco do Brasil',  'ACAO', 'Bancos',           'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 6, 'WEGE3',  'WEG ON',           'ACAO', 'Bens de Capital',  'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 7, 'B3SA3',  'B3',               'ACAO', 'Financeiro',       'BRL', 'D+2', 'B3',     0, NULL, NULL),
( 8, 'MGLU3',  'Magalu',           'ACAO', 'Varejo',           'BRL', 'D+2', 'B3',     0, NULL, NULL),
-- Renda fixa pública
( 9, 'LFT_2029',  'Tesouro Selic 2029',     'LFT',  NULL, 'BRL', 'D+1', 'SELIC',  0, 'SELIC', '2029-03-01'),
(10, 'LTN_2027',  'Tesouro Prefixado 2027', 'LTN',  NULL, 'BRL', 'D+1', 'SELIC',  0, 'PRE',   '2027-07-01'),
(11, 'NTNB_2035', 'Tesouro IPCA+ 2035',     'NTNB', NULL, 'BRL', 'D+1', 'SELIC',  0, 'IPCA',  '2035-08-15'),
-- Renda fixa privada
(12, 'CDB_BTG_2027',   'CDB BTG Pactual 2027',    'CDB', NULL, 'BRL', 'D+0', 'B3_RF', 1, 'CDI',   '2027-12-15'),
(13, 'DEB_VALE_2030',  'Debênture Vale 2030',     'DEB', NULL, 'BRL', 'D+0', 'B3_RF', 0, 'IPCA',  '2030-06-15'),
(14, 'DEB_BRASKEM_28', 'Debênture Braskem 2028',  'DEB', NULL, 'BRL', 'D+0', 'B3_RF', 0, 'CDI+',  '2028-09-30'),
-- Câmbio
(15, 'USD_PRONTO', 'Dólar pronto', 'CAMBIO', NULL, 'USD', 'D+2', 'SPB', 0, NULL, NULL);


-- Corretoras
INSERT INTO dim_corretora (corretora_id, cnpj, nome, layout_arquivo, contato_mesa) VALUES
(1, '00.000.000/0001-01', 'XP',         'CSV padrão (8 colunas)',           'mesa.alpha@xp.com.br'),
(2, '00.000.000/0001-02', 'BTG',        'CSV com header diferente',          'alpha.bo@btg.com.br'),
(3, '00.000.000/0001-03', 'ITAU_BBA',   'XLSX com 12 colunas',               'mesa.fundos@itaubba.com.br'),
(4, '00.000.000/0001-04', 'BRADESCO',   'TXT delimitado por pipe',           'fundos.alpha@bradesco.com.br');


-- Calendário (últimos 30 dias úteis e feriados nacionais)
-- Em produção, geraríamos via script. Aqui inserimos o suficiente pras queries.
INSERT INTO dim_calendario (data, eh_dia_util, eh_feriado, nome_feriado, dia_semana) VALUES
('2026-04-21', 0, 1, 'Tiradentes',          2),
('2026-04-22', 1, 0, NULL,                   3),
('2026-04-23', 1, 0, NULL,                   4),
('2026-04-24', 1, 0, NULL,                   5),
('2026-04-25', 0, 0, NULL,                   6),
('2026-04-26', 0, 0, NULL,                   0),
('2026-04-27', 1, 0, NULL,                   1),
('2026-04-28', 1, 0, NULL,                   2),
('2026-04-29', 1, 0, NULL,                   3),
('2026-04-30', 1, 0, NULL,                   4),
('2026-05-01', 0, 1, 'Dia do Trabalho',     5),
('2026-05-02', 0, 0, NULL,                   6),
('2026-05-03', 0, 0, NULL,                   0),
('2026-05-04', 1, 0, NULL,                   1);


-- ----------------------------------------------------------------------------
-- BOLETAS DA MESA (operações registradas pela Alpha)
-- ----------------------------------------------------------------------------
-- Data de referência: 28/04/2026 (terça)
INSERT INTO fato_boleta_mesa
  (boleta_id, data_operacao, fundo_id, ativo_id, corretora_id, lado, quantidade, preco, valor_bruto, trader, horario) VALUES
-- ALPHA_LONG_BIAS_FIM (fundo 1)
(10001, '2026-04-28', 1,  9, 3, 'V',     10, 14462.91,  144629.10, 'João',    '10:15'),
(10002, '2026-04-28', 1, 13, 1, 'C',      5,  1120.91,    5604.55, 'João',    '10:42'),
(10003, '2026-04-28', 1,  1, 1, 'C',   3000,    38.45,  115350.00, 'João',    '11:08'),
(10004, '2026-04-28', 1,  8, 2, 'C',   5000,     9.01,   45050.00, 'Mariana', '11:33'),
-- ALPHA_MULTIMERCADO_FIM (fundo 2)
(10005, '2026-04-28', 2, 11, 3, 'C',     50,  4165.90,  208295.00, 'João',    '09:45'),
(10006, '2026-04-28', 2,  3, 1, 'C',    500,    33.66,   16830.00, 'Pedro',   '14:12'),
(10007, '2026-04-28', 2,  2, 4, 'C',    800,    67.20,   53760.00, 'Pedro',   '14:50'),
-- ALPHA_RF_FIRF (fundo 3)
(10008, '2026-04-28', 3,  4, 4, 'V',   1000,    16.68,   16680.00, 'Mariana', '15:02'),
(10009, '2026-04-28', 3,  6, 3, 'C',   5000,    41.35,  206750.00, 'Pedro',   '15:30'),
(10010, '2026-04-28', 3,  7, 1, 'C',    200,    12.39,    2478.00, 'Mariana', '16:01'),
(10011, '2026-04-28', 3, 12, 2, 'C',    100,  1050.00,  105000.00, 'João',    '16:30'),
-- ALPHA_ACOES_FIA (fundo 4)
(10012, '2026-04-28', 4,  1, 1, 'C',   2000,    38.45,   76900.00, 'Pedro',   '10:25'),
(10013, '2026-04-28', 4,  2, 2, 'C',   1500,    67.20,  100800.00, 'Pedro',   '10:55'),
(10014, '2026-04-28', 4,  6, 3, 'C',   1200,    41.35,   49620.00, 'Mariana', '11:20'),
(10015, '2026-04-28', 4,  3, 4, 'C',   1000,    33.66,   33660.00, 'João',    '13:45'),
-- ALPHA_DIVIDENDOS_FIA (fundo 5)
(10016, '2026-04-28', 5,  4, 4, 'C',   5000,    17.10,   85500.00, 'Mariana', '14:00'),
(10017, '2026-04-28', 5,  3, 3, 'C',   3000,    33.66,  100980.00, 'Pedro',   '14:25'),
(10018, '2026-04-28', 5,  5, 1, 'C',   2000,    28.70,   57400.00, 'João',    '15:10'),
-- Boleta com divergência proposital (10004 já tem div, esta é outra)
(10019, '2026-04-28', 1,  6, 2, 'V',    500,    41.40,   20700.00, 'João',    '16:45');


-- ----------------------------------------------------------------------------
-- BOLETAS DAS CORRETORAS (espelhos — alguns com divergências propositais)
-- ----------------------------------------------------------------------------
INSERT INTO fato_boleta_corretora
  (boleta_corr_id, boleta_id_ref, data_operacao, fundo_id, ativo_id, corretora_id, lado, quantidade, preco, valor_bruto, arquivo_origem) VALUES
-- Espelhos OK
(20001, 10001, '2026-04-28', 1,  9, 3, 'V',     10, 14462.91,  144629.10, 'itau_bba_28-04.xlsx'),
(20002, 10002, '2026-04-28', 1, 13, 1, 'C',      5,  1120.91,    5604.55, 'xp_28-04.csv'),
(20003, 10003, '2026-04-28', 1,  1, 1, 'C',   3000,    38.45,  115350.00, 'xp_28-04.csv'),
-- DIVERGENTE: corretora reportou qtd diferente (5100 em vez de 5000)
(20004, 10004, '2026-04-28', 1,  8, 2, 'C',   5100,     9.01,   45951.00, 'btg_28-04.csv'),
-- mais OKs
(20005, 10005, '2026-04-28', 2, 11, 3, 'C',     50,  4165.90,  208295.00, 'itau_bba_28-04.xlsx'),
(20006, 10006, '2026-04-28', 2,  3, 1, 'C',    500,    33.66,   16830.00, 'xp_28-04.csv'),
(20007, 10007, '2026-04-28', 2,  2, 4, 'C',    800,    67.20,   53760.00, 'bradesco_28-04.txt'),
(20008, 10008, '2026-04-28', 3,  4, 4, 'V',   1000,    16.68,   16680.00, 'bradesco_28-04.txt'),
(20009, 10009, '2026-04-28', 3,  6, 3, 'C',   5000,    41.35,  206750.00, 'itau_bba_28-04.xlsx'),
-- DIVERGENTE: preço reportado pela corretora é R$ 12,44 (Alpha registrou 12,39)
(20010, 10010, '2026-04-28', 3,  7, 1, 'C',    200,    12.44,    2488.00, 'xp_28-04.csv'),
(20011, 10011, '2026-04-28', 3, 12, 2, 'C',    100,  1050.00,  105000.00, 'btg_28-04.csv'),
-- Boleta 10012 NÃO veio da XP (FALTA_CORRETORA)
(20013, 10013, '2026-04-28', 4,  2, 2, 'C',   1500,    67.20,  100800.00, 'btg_28-04.csv'),
(20014, 10014, '2026-04-28', 4,  6, 3, 'C',   1200,    41.35,   49620.00, 'itau_bba_28-04.xlsx'),
(20015, 10015, '2026-04-28', 4,  3, 4, 'C',   1000,    33.66,   33660.00, 'bradesco_28-04.txt'),
(20016, 10016, '2026-04-28', 5,  4, 4, 'C',   5000,    17.10,   85500.00, 'bradesco_28-04.txt'),
(20017, 10017, '2026-04-28', 5,  3, 3, 'C',   3000,    33.66,  100980.00, 'itau_bba_28-04.xlsx'),
(20018, 10018, '2026-04-28', 5,  5, 1, 'C',   2000,    28.70,   57400.00, 'xp_28-04.csv'),
(20019, 10019, '2026-04-28', 1,  6, 2, 'V',    500,    41.40,   20700.00, 'btg_28-04.csv'),
-- Corretora reportou boleta que a Alpha NÃO registrou (FALTA_MESA)
(20099, NULL,  '2026-04-28', 4,  8, 1, 'C',    500,     8.95,    4475.00, 'xp_28-04.csv');


-- ----------------------------------------------------------------------------
-- CASAMENTO — resultado da macro VBA / pipeline Python
-- ----------------------------------------------------------------------------
INSERT INTO fato_casamento (casamento_id, data_operacao, boleta_id, boleta_corr_id, status, motivo, diff_qtd, diff_preco_pct) VALUES
(30001, '2026-04-28', 10001, 20001, 'OK',           NULL,                    0,    0.0000),
(30002, '2026-04-28', 10002, 20002, 'OK',           NULL,                    0,    0.0000),
(30003, '2026-04-28', 10003, 20003, 'OK',           NULL,                    0,    0.0000),
(30004, '2026-04-28', 10004, 20004, 'DIVERGENTE',   'qtd_div: mesa 5000 vs corretora 5100', 100, 0.0000),
(30005, '2026-04-28', 10005, 20005, 'OK',           NULL,                    0,    0.0000),
(30006, '2026-04-28', 10006, 20006, 'OK',           NULL,                    0,    0.0000),
(30007, '2026-04-28', 10007, 20007, 'OK',           NULL,                    0,    0.0000),
(30008, '2026-04-28', 10008, 20008, 'OK',           NULL,                    0,    0.0000),
(30009, '2026-04-28', 10009, 20009, 'OK',           NULL,                    0,    0.0000),
(30010, '2026-04-28', 10010, 20010, 'DIVERGENTE',   'preco_div: 0.4035% acima da tolerância', 0, 0.4035),
(30011, '2026-04-28', 10011, 20011, 'OK',           NULL,                    0,    0.0000),
(30012, '2026-04-28', 10012, NULL,  'FALTA_CORRETORA', 'XP não enviou boleta 10012', NULL, NULL),
(30013, '2026-04-28', 10013, 20013, 'OK',           NULL,                    0,    0.0000),
(30014, '2026-04-28', 10014, 20014, 'OK',           NULL,                    0,    0.0000),
(30015, '2026-04-28', 10015, 20015, 'OK',           NULL,                    0,    0.0000),
(30016, '2026-04-28', 10016, 20016, 'OK',           NULL,                    0,    0.0000),
(30017, '2026-04-28', 10017, 20017, 'OK',           NULL,                    0,    0.0000),
(30018, '2026-04-28', 10018, 20018, 'OK',           NULL,                    0,    0.0000),
(30019, '2026-04-28', 10019, 20019, 'OK',           NULL,                    0,    0.0000),
(30020, '2026-04-28', NULL,  20099, 'FALTA_MESA',   'XP reportou boleta que a Alpha não tem', NULL, NULL);


-- ----------------------------------------------------------------------------
-- POSIÇÕES (snapshot do fechamento de 28/04/2026)
-- ----------------------------------------------------------------------------
INSERT INTO fato_posicao (posicao_id, data_referencia, fundo_id, ativo_id, quantidade, preco_medio, preco_mercado, valor_mercado, pnl_acumulado) VALUES
-- ALPHA_LONG_BIAS_FIM (fundo 1) — diversificado
(40001, '2026-04-28', 1,  9,    150, 14400.00, 14462.91,   2169436.50,    9436.50),
(40002, '2026-04-28', 1, 13,     50,  1100.00,  1120.91,     56045.50,    1045.50),
(40003, '2026-04-28', 1,  1,  60000,    37.20,    38.45,   2307000.00,   75000.00),
(40004, '2026-04-28', 1,  2,  35000,    65.50,    67.20,   2352000.00,   59500.00),
(40005, '2026-04-28', 1,  3,  40000,    32.10,    33.66,   1346400.00,   62400.00),
(40006, '2026-04-28', 1,  4,  60000,    16.20,    16.85,   1011000.00,   39000.00),
(40007, '2026-04-28', 1,  6,  35000,    40.10,    41.35,   1447250.00,   43750.00),
(40008, '2026-04-28', 1,  8,  90000,     9.50,     9.01,    810900.00,  -44100.00),
-- ALPHA_MULTIMERCADO_FIM (fundo 2)
(40009, '2026-04-28', 2, 11,    300,  4100.00,  4165.90,   1249770.00,   19770.00),
(40010, '2026-04-28', 2,  3,  40000,    32.50,    33.66,   1346400.00,   46400.00),
(40011, '2026-04-28', 2,  2,  18000,    66.10,    67.20,   1209600.00,   19800.00),
(40012, '2026-04-28', 2,  1,  25000,    37.80,    38.45,    961250.00,   16250.00),
-- ALPHA_RF_FIRF (fundo 3) — predominante RF
(40013, '2026-04-28', 3,  9,    400, 14380.00, 14462.91,   5785164.00,   33164.00),
(40014, '2026-04-28', 3, 10,    150,  9520.00,  9582.40,   1437360.00,    9360.00),
(40015, '2026-04-28', 3, 12,    400,  1040.00,  1050.00,    420000.00,    4000.00),
(40016, '2026-04-28', 3,  4,  20000,    16.45,    16.85,    337000.00,    8000.00),
(40017, '2026-04-28', 3,  6,  10000,    40.80,    41.35,    413500.00,    5500.00),
(40018, '2026-04-28', 3,  7,   1500,    12.20,    12.39,     18585.00,     285.00),
-- ALPHA_ACOES_FIA (fundo 4) — predominante RV
(40019, '2026-04-28', 4,  1,  45000,    37.50,    38.45,   1730250.00,   42750.00),
(40020, '2026-04-28', 4,  2,  21000,    66.50,    67.20,   1411200.00,   14700.00),
(40021, '2026-04-28', 4,  6,  20000,    40.20,    41.35,    827000.00,   23000.00),
(40022, '2026-04-28', 4,  3,  35000,    32.80,    33.66,   1178100.00,   30100.00),
(40023, '2026-04-28', 4,  4,  60000,    16.30,    16.85,   1011000.00,   33000.00),
(40024, '2026-04-28', 4,  8,  25000,     9.20,     9.01,    225250.00,   -4750.00),
-- ALPHA_DIVIDENDOS_FIA (fundo 5) — bancos e dividendeiras
(40025, '2026-04-28', 5,  4,  85000,    16.40,    16.85,   1432250.00,   38250.00),
(40026, '2026-04-28', 5,  3,  50000,    32.95,    33.66,   1683000.00,   35500.00),
(40027, '2026-04-28', 5,  5,  35000,    28.20,    28.70,   1004500.00,   17500.00),
(40028, '2026-04-28', 5,  1,  15000,    37.10,    38.45,    576750.00,   20250.00),
(40029, '2026-04-28', 5,  2,   8000,    66.80,    67.20,    537600.00,    3200.00);


-- ----------------------------------------------------------------------------
-- CONCILIAÇÃO COM CUSTÓDIA (28/04/2026)
-- ----------------------------------------------------------------------------
-- Maioria OK; 2 divergências propositais pra ilustrar relatório
INSERT INTO fato_conciliacao (conciliacao_id, data_referencia, fundo_id, ativo_id, qtd_alpha, qtd_custodia, diferenca, status) VALUES
(50001, '2026-04-28', 1,  1, 60000, 60000,    0, 'OK'),
(50002, '2026-04-28', 1,  2, 35000, 35000,    0, 'OK'),
(50003, '2026-04-28', 1,  3, 40000, 40000,    0, 'OK'),
(50004, '2026-04-28', 1,  9,   150,   150,    0, 'OK'),
(50005, '2026-04-28', 2,  3, 40000, 40000,    0, 'OK'),
-- DIVERGÊNCIA 1: Alpha tem 18000 VALE3, custódia tem 18100 (diff de 100 ações)
(50006, '2026-04-28', 2,  2, 18000, 18100, -100, 'DIVERGENTE'),
(50007, '2026-04-28', 3,  9,   400,   400,    0, 'OK'),
(50008, '2026-04-28', 3, 10,   150,   150,    0, 'OK'),
(50009, '2026-04-28', 4,  1, 45000, 45000,    0, 'OK'),
-- DIVERGÊNCIA 2: 200 ITUB4 a menos no custodiante
(50010, '2026-04-28', 4,  3, 35000, 34800,  200, 'DIVERGENTE'),
(50011, '2026-04-28', 5,  4, 85000, 85000,    0, 'OK'),
(50012, '2026-04-28', 5,  3, 50000, 50000,    0, 'OK');


-- ----------------------------------------------------------------------------
-- PL E COTA (snapshot 27/04 e 28/04 pra calcular variação)
-- ----------------------------------------------------------------------------
INSERT INTO fato_pl_fundo (pl_id, data_referencia, fundo_id, pl_total, valor_cota, quantidade_cotas, rentabilidade_dia, rentabilidade_mtd, rentabilidade_ytd, captacao_dia, resgate_dia) VALUES
-- 27/04 (D-1) — base pra calcular variação
(60001, '2026-04-27', 1, 15400000.00, 1.85432100, 8305000.00, 0.000812, 0.018500, 0.072300,        0.00,       0.00),
(60002, '2026-04-27', 2, 10580000.00, 1.62100500, 6526000.00, 0.000654, 0.014200, 0.058700,        0.00,       0.00),
(60003, '2026-04-27', 3,  8620000.00, 1.34520100, 6407000.00, 0.000456, 0.011300, 0.041800,        0.00,       0.00),
(60004, '2026-04-27', 4,  8050000.00, 2.20140000, 3657000.00, 0.001234, 0.022100, 0.089400,   100000.00,       0.00),
(60005, '2026-04-27', 5,  6750000.00, 1.45230000, 4647000.00, 0.000823, 0.016800, 0.064200,        0.00,   50000.00),
-- 28/04 (D+0)
(60011, '2026-04-28', 1, 15518891.55, 1.85578432, 8362000.00, 0.000789, 0.019300, 0.073200,        0.00,       0.00),
(60012, '2026-04-28', 2, 10671391.30, 1.62456800, 6568000.00, 0.000721, 0.014900, 0.059800,        0.00,       0.00),
(60013, '2026-04-28', 3,  8648656.70, 1.34890000, 6411000.00, 0.000510, 0.011800, 0.042400,        0.00,       0.00),
(60014, '2026-04-28', 4,  8137548.60, 2.21340000, 3676000.00, 0.001112, 0.023200, 0.090600,        0.00,       0.00),
(60015, '2026-04-28', 5,  6792724.20, 1.45720000, 4661000.00, 0.000656, 0.017500, 0.064900,    50000.00,       0.00);
