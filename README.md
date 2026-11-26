# Guia Svelte

Curso de **Svelte 5 e SvelteKit** em português, para quem **nunca programou**: 144 aulas, do primeiro
componente ao site publicado. No ar em **https://wallysondevs.github.io/guia-svelte/**.

## O que tem aqui

- **Nível 1 · Fundamentos** (48 aulas): componente, expressões, `$state`, `$derived`, `$effect`,
  `$props`, condições, listas, eventos, `bind:`, formulários.
- **Nível 2 · Componentes e Interação** (40): ciclo de vida, composição, context, stores, snippets,
  transições, `{@attach}`, testes com Vitest, performance, refatoração.
- **Nível 3 · SvelteKit** (30): rotas, `load`, `+page.server.js`, form actions, cookies, hooks,
  autenticação, `$env`, SEO, adaptadores, deploy, segurança, PWA.
- **Projetos** (12) e **Referência** (14).

## As caixas "Experimente" não são simulação

Cada caixa `.trysvelte` compila o código do leitor com o **compilador de verdade** do Svelte
(`svelte@5.59.2`, empacotado em `assets/svelte-compiler.js`) e monta o componente com o **runtime de
verdade** (`assets/svelte-motor.js`) dentro de um iframe. Clicar, digitar e ver a tela reagir é
execução real, não imagem.

A saída publicada nas aulas (`pre.out`) foi colhida desse mesmo compilador com `tools/render.js` — e
o conferidor recompila cada bloco para provar que continua igual.

## Ferramentas

```bash
export PATH="$HOME/.local/node22/bin:$PATH"
export NODE_PATH=/caminho/para/node_modules      # puppeteer-core + Chrome
npm install                                     # svelte, vite, esbuild (para o motor)

node tools/render.js tmp/App.svelte --nome src/App.svelte   # HTML gerado
node tools/render.js tmp/App.svelte --nome src/App.svelte --texto
node tools/render.js tmp/App.svelte --nome src/App.svelte --css
node tools/render.js tmp/Ruim.svelte                        # erro de compilação real

node tools/testar-missoes.js -q pagina.html      # 11 verificações; compila e roda cada caixa
node tools/testar-missoes.js --todas
node tools/verificar-saidas.js -q pagina.html    # recompila cada pre.file e compara com o pre.out
node tools/verificar-saidas.js --fix pagina.html # conserta o pre.out divergente
node tools/testar-navegador.js --todas           # Chromium 1280 e 375 px, clicando em tudo
node tools/provar-defeitos.js                    # prova que o testador reprova 16 defeitos
node tools/empacotar.js --checar                 # motor do site == svelte da node_modules
node tools/servir.mjs 8788                       # servidor estático (módulos ES pedem http)
```

## Contrato de escrita

`CONTRIBUINDO.md` tem o esqueleto da página, a ordem da aula, os componentes, as metas das caixas
(`out:`, `outre:`, `html:`, `erro:`, `clique:`, `digitar:`, `depois:`), a convenção de saída real e
as regras de privacidade.

## Estrutura

```
guia-svelte/
├── *.html                    todas as páginas na raiz
├── assets/
│   ├── style.css             casca do site (a mesma família dos outros guias)
│   ├── site.js               menu, tema, pager, exercícios; NIVEIS é a fonte do menu
│   ├── sveltesim.js          a caixa .trysvelte
│   ├── svelte-compiler.js    compilador real (gerado)
│   ├── svelte-motor.js       runtime real (gerado)
│   └── vendor.json           versão e hashes dos pacotes do motor
└── tools/                    render, testadores, prova de defeitos, empacotador, servidor
```

O motor empacotado é reconstruído com `node tools/empacotar.js --gerar` a partir de
`node_modules/svelte`; `--checar` avisa quando a versão instalada muda (as mensagens de erro do
compilador mudam junto, e as aulas foram escritas com elas).
