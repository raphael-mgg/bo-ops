# Como publicar o site BO.OPS

O site é 100% estático (HTML + CSS + JS puros, sem build). Roda local abrindo o `index.html` no navegador, ou pode ser publicado gratuitamente em qualquer serviço de hosting estático.

## 1) Rodar localmente (mais simples)

**Opção A — duplo clique:**
Descompacte o zip e dê duplo clique no `index.html`. Funciona, mas o navegador às vezes bloqueia o download do zip por segurança. Pra evitar isso, use a opção B.

**Opção B — servidor local (recomendado):**

Abra o terminal na pasta do site e rode:

```bash
# Python 3 (vem instalado no Mac/Linux, instalável no Windows)
python -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador. Pra parar, `Ctrl+C` no terminal.

---

## 2) Publicar no GitHub Pages (grátis, link público)

Tempo: ~5 minutos. Você precisa de uma conta no GitHub.

1. Crie um repositório novo no GitHub. Sugestão de nome: `backoffice-alpha-capital`
2. Faça upload de todos os arquivos do site (`index.html`, `style.css`, `script.js`, `alpha_capital_projeto.zip`) — pode arrastar direto na interface web
3. Vá em **Settings → Pages**
4. Em "Source", selecione **Deploy from a branch**, escolha branch `main` e pasta `/ (root)`. Salve.
5. Aguarde 1-2 minutos. O GitHub gera um link tipo:
   ```
   https://SEU_USUARIO.github.io/backoffice-alpha-capital/
   ```
6. Compartilhe esse link no seu LinkedIn / currículo / processo seletivo.

---

## 3) Publicar no Netlify (alternativa, drag-and-drop)

Tempo: ~2 minutos. Mais rápido que GitHub Pages.

1. Acesse https://app.netlify.com/drop
2. Arraste a pasta inteira do site pra área indicada
3. Pronto — Netlify gera um link tipo `https://random-name-12345.netlify.app`
4. (Opcional) Em **Site settings → Domain → Site name**, mude o subdomínio pra algo legível tipo `bo-ops-raphael.netlify.app`

---

## 4) Publicar no Vercel

Mesmo princípio do Netlify. https://vercel.com → "Import Project" → upload da pasta.

---

## Estrutura dos arquivos

```
site/
├── index.html                       # página única
├── style.css                        # estilos (tema escuro/claro)
├── script.js                        # toggle tema, copiar código, scroll spy
├── alpha_capital_projeto.zip        # o projeto completo pra download
└── COMO_PUBLICAR.md                 # este arquivo
```

## Personalização rápida

**Trocar nome / dados de contato:** abra `index.html`, procure pelas seções `<footer>` e edite.

**Trocar link do GitHub:** procure por `github.com/raphael-rj/alpha-capital-backoffice` e troque pelo seu link real depois de subir o repo.

**Adicionar seção:** copie qualquer bloco `<section class="section" id="...">...</section>` e adapte. Adicione um `<a class="nav-link">` correspondente na sidebar.

**Mudar a paleta:** as cores ficam todas no topo do `style.css`, dentro de `:root` e `[data-theme="light"]`. Mude `--accent` e tudo se ajusta.

---

## Dicas pro processo seletivo

- O site é leve (~70 KB sem o zip), abre instantâneo, funciona offline
- Coloque o link no topo do currículo: "Portfólio técnico: [link]"
- Mencione na carta de apresentação algo como: "Construí uma simulação completa do dia a dia de backoffice usando as 4 ferramentas (Excel, VBA, Python, Power BI). Disponível em [link] com código aberto."
- Em entrevista, peça pra abrir o site na tela e use como roteiro pra explicar seu pensamento. Cada seção é uma história ("aqui o operador chega de manhã e precisa..."), o que torna a apresentação fluida.
