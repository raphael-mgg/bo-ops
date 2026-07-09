# BO·OPS — Um dia na mesa de operações

Projeto de portfólio que simula o dia a dia de backoffice/middle office de uma gestora brasileira fictícia (**Alpha Capital**), em três camadas complementares:

1. **Site interativo** (este repositório, publicado via Netlify) — uma narrativa visual do dia na mesa: casamento de boletas, conciliação de custódia, necessidade de caixa, marcação a mercado, quadro de cotações estilo canal de notícias, home broker simulado e trechos reais de VBA, Python e DAX usados no fluxo. Inclui a aba **DATA·OPS**, que simula o dia do time de dados: ETL, conferência de integridade (completude, sanidade, batimento de cota), motor de cálculo e dashboard da mesa.
2. **Camada SQL** ([`sql/`](sql/README.md)) — a mesma operação modelada em banco relacional: schema com dimensões e fatos, dados sintéticos, 12 relatórios reais de backoffice e as 3 consultas diárias da mesa de dados (`relatorios_dataops.sql`). ~940 linhas de SQL validadas em SQLite.
3. **Projeto Alpha Capital** ([`alpha_capital_projeto.zip`](alpha_capital_projeto.zip)) — o pipeline Excel + Python completo: arquivos de corretoras, scripts de casamento/conciliação e saídas prontas para Power BI.

## Estrutura

```
├── index.html                  # o site (página única)
├── style.css
├── script.js                   # interatividade, simulações e cotações
├── agenda.json                 # agenda econômica exibida no quadro de mercado
├── sql/                        # camada SQL (schema, seed, relatórios) — ver sql/README.md
└── alpha_capital_projeto.zip   # projeto Excel + Python da Alpha Capital
```

## Como rodar o site localmente

O site é 100% estático — basta servir a raiz do repositório com qualquer servidor HTTP (necessário porque o `script.js` carrega o `agenda.json` via `fetch`, o que não funciona abrindo o arquivo direto):

```bash
git clone https://github.com/raphael-mgg/bo-ops.git
cd bo-ops
python3 -m http.server 8000
# abra http://localhost:8000
```

## Cotações reais (opcional)

Por padrão, o quadro de cotações roda em **modo simulação** (random walk realista, indicado no status "DADOS SIMULADOS"). Para exibir cotações reais de ações e Ibovespa (delay de 15 min), crie uma chave gratuita na [Brapi](https://brapi.dev) e insira-a na constante `BRAPI_TOKEN` no topo do bloco de mercado do `script.js`:

```js
const BRAPI_TOKEN = 'sua-chave-aqui';
```

O dólar (USD/BRL) vem da [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas) e não precisa de chave. Sem chave da Brapi ou sem conexão, o site continua funcionando normalmente com dados simulados.

## Autor

**Raphael Monteiro Guimarães Gonçalves** — projeto de estudo/portfólio sobre operações de backoffice e middle office em gestoras.
