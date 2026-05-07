# SQL — Alpha Capital Backoffice

Camada relacional do projeto BO·OPS. Modela o dia a dia operacional de uma gestora brasileira (boletas, casamento, custódia, posições, PL/cota) num schema relacional limpo, com queries reais que um analista de backoffice/middle roda no dia a dia.

> **Por que isso existe:** o projeto principal usa Excel + Python pra refletir a realidade de gestoras pequenas e médias. Esta camada SQL mostra como a mesma operação seria estruturada em ambiente de banco relacional — caminho natural quando a operação cresce.

---

## Conteúdo

| Arquivo | Linhas | O que faz |
|---|---|---|
| `schema.sql` | ~250 | DDL: tabelas, FKs, índices, views, constraints |
| `seed.sql` | ~260 | Dados sintéticos coerentes (5 fundos, 15 ativos, ~30 boletas, snapshots de PL) |
| `relatorios.sql` | ~325 | 12 queries reais de backoffice/middle, com explicação do "porquê" |

Total: **~840 linhas de SQL** validadas em SQLite 3.45.

---

## Como rodar

Em SQLite (sem instalação adicional, vem no Python):

```bash
# clona o repositório
git clone https://github.com/raphael-mgg/bo-ops.git
cd bo-ops/sql

# cria o banco e popula
sqlite3 alpha_capital.db < schema.sql
sqlite3 alpha_capital.db < seed.sql

# roda os 12 relatórios
sqlite3 alpha_capital.db < relatorios.sql
```

Ou via Python (se não tem `sqlite3` no shell):

```python
import sqlite3
con = sqlite3.connect('alpha_capital.db')
for arquivo in ['schema.sql', 'seed.sql']:
    with open(arquivo) as f:
        con.executescript(f.read())

# exemplo: ranking de fundos por PL
for row in con.execute("""
    SELECT f.nome, pl.pl_total, pl.valor_cota
    FROM fato_pl_fundo pl JOIN dim_fundo f ON f.fundo_id = pl.fundo_id
    WHERE pl.data_referencia = (SELECT MAX(data_referencia) FROM fato_pl_fundo)
    ORDER BY pl.pl_total DESC
"""):
    print(row)
```

Compatível com **SQLite 3.35+** (CTEs e window functions). Pra rodar em **PostgreSQL 12+**, basta trocar `JULIANDAY()` por `EXTRACT(EPOCH FROM ...)/86400` na query 8.

---

## Modelagem

### Dimensões (4)

- `dim_fundo` — 5 fundos da Alpha Capital com classe ANBIMA, benchmark, taxas, custodiante
- `dim_ativo` — 15 ativos (ações, RF pública, RF privada, câmbio) com classificação completa
- `dim_corretora` — 4 corretoras parceiras (XP, BTG, Itaú BBA, Bradesco) com layout de arquivo
- `dim_calendario` — calendário de pregão (dias úteis e feriados)

### Fatos (6)

- `fato_boleta_mesa` — boletas registradas pela mesa de operações
- `fato_boleta_corretora` — boletas reportadas pelas corretoras (espelho)
- `fato_casamento` — resultado do casamento entre os dois lados (OK / DIVERGENTE / FALTA)
- `fato_posicao` — snapshot diário de posições (qtd, PM, mark-to-market, P&L)
- `fato_conciliacao` — conciliação Alpha vs Custodiante
- `fato_pl_fundo` — snapshot diário de PL e cota dos fundos

### Views úteis

- `v_carteira_atual` — carteira do dia mais recente com nomes resolvidos e % na carteira
- `v_boletas` — boletas com nomes em vez de IDs

---

## Os 12 relatórios

Cada um foi escrito pra responder a **uma pergunta real** que o gestor ou compliance faz no dia a dia:

| # | Relatório | Pergunta de negócio |
|---|---|---|
| 1 | Ranking por PL | "Como estão os fundos hoje?" |
| 2 | Top 10 exposições consolidadas | "Quanto a casa tem em Petrobras somando todos os fundos?" |
| 3 | Boletas com divergência | "O que precisa ser resolvido antes do fechamento?" |
| 4 | % casamento por corretora | "Qual corretora dá mais trabalho?" |
| 5 | Enquadramento ANBIMA | "Algum FIA caiu abaixo dos 67% em ações?" |
| 6 | Necessidade de caixa por D+ | "Quanto sai de caixa nos próximos D+0/1/2?" |
| 7 | Divergências de custódia | "Onde tem diferença entre nossa posição e a do custodiante?" |
| 8 | RF vencendo em 90 dias | "O que precisa ser realocado em breve?" |
| 9 | Debêntures sem FGC | "Qual é nossa exposição a risco de crédito sem cobertura?" |
| 10 | Drawdown atual | "Qual fundo está mais distante do pico?" |
| 11 | Volume por trader | "Quem operou mais no mês?" |
| 12 | P&L decomposto | "O que explica a variação de PL hoje?" |

---

## Convenções aplicadas

- **Datas em ISO** (`YYYY-MM-DD`) — sem ambiguidade entre formatos BR/US
- **Valores monetários** em `DECIMAL(18,4)` — 4 casas pra acomodar PU de renda fixa
- **Quantidades** em `INTEGER` (ações) ou `DECIMAL(18,4)` (cotas, RF unitário)
- **Chaves naturais** (CNPJ, ticker B3) + IDs sintéticos pra agilizar joins
- **CHECK constraints** nas colunas críticas (status, lado, valores positivos)
- **Índices** nas colunas usadas em filtros e joins frequentes (data, fundo, status)

---

## Decisões técnicas notáveis

### Por que SQLite e não PostgreSQL?

SQLite roda sem servidor, sem instalação, vem no Python. Recrutador clona, executa, vê funcionar. Em produção real numa gestora, seria PostgreSQL ou SQL Server — mas pra demonstração, o overhead não vale.

O código foi escrito com **portabilidade em mente** — só uma função (`JULIANDAY`) precisa de adaptação pra rodar em PostgreSQL.

### Por que separar `fato_boleta_mesa` e `fato_boleta_corretora`?

Numa operação real, esses dois fluxos chegam de fontes diferentes (sistema interno da mesa vs arquivos das corretoras). Separar reflete a realidade e permite reconciliar os dois lados em `fato_casamento` — o que é exatamente o que o operador faz às 9h da manhã.

### Por que `fato_casamento` permite NULL em ambas as boletas?

Porque os 4 status (`OK`, `DIVERGENTE`, `FALTA_MESA`, `FALTA_CORRETORA`) precisam representar todos os cenários:
- `OK` e `DIVERGENTE` — os dois lados existem
- `FALTA_MESA` — corretora reportou, mesa não tem (suspeita: corretora errou ou mesa não registrou)
- `FALTA_CORRETORA` — mesa registrou, corretora não confirmou (suspeita: corretora atrasada ou mesa duplicou)

### Por que `valor_bruto` é coluna calculada e não derivada?

Em produção, `valor_bruto = quantidade × preço`. Mas guardar o valor calculado **na hora da boleta** é importante — futuras divisões de papel ou ajustes de PU não devem alterar o histórico. É um princípio comum em sistemas operacionais financeiros.

---

## Próximos passos (fora do escopo)

Coisas que ficaram fora desta versão e seriam o caminho natural em produção:

- **Particionamento** em `fato_boleta_mesa` por mês
- **Tabela de auditoria** (`fato_boleta_audit`) capturando UPDATE/DELETE
- **Schema separado** pra dados de mercado (cotações intraday) em outro banco
- **Trigger** pra atualizar `valor_bruto` se quantidade ou preço mudarem
- **Roles e permissões** (BO read-write, gestor read-only, compliance read-all)

---

## Validação

Os 12 relatórios foram **validados executando** contra o `seed.sql`. Resultados de exemplo:

```
=== Ranking por PL ===
ALPHA_LONG_BIAS_FIM       PL R$ 15.518.892   cota 1,855784   dia +0,0789%
ALPHA_MULTIMERCADO_FIM    PL R$ 10.671.391   cota 1,624568   dia +0,0721%
ALPHA_RF_FIRF             PL R$  8.648.657   cota 1,348900   dia +0,0510%
ALPHA_ACOES_FIA           PL R$  8.137.549   cota 2,213400   dia +0,1112%
ALPHA_DIVIDENDOS_FIA      PL R$  6.792.724   cota 1,457200   dia +0,0656%

=== Enquadramento FIA (≥67% em ações) ===
ALPHA_ACOES_FIA      FIA    100,00% em ações  ✓
ALPHA_DIVIDENDOS_FIA FIA    100,00% em ações  ✓
ALPHA_LONG_BIAS_FIM  FIM     80,65%
ALPHA_MULTIMERCADO   FIM     73,78%
ALPHA_RF_FIRF        FIRF     9,14%

=== Debêntures sem FGC (risco de crédito) ===
DEB_VALE_2030        R$ 56.046
```

---

← [Voltar para o README principal](../README.md)

