# Como escrever uma aula do Guia Svelte

Este guia é uma **escola**, no estilo W3Schools, para quem **nunca programou**. O padrão de
referência é o **Guia MongoDB** e o **Guia Lógica** (144 aulas cada, aprovados pelo dono).
**Uma aula = um assunto.** Nada de código "seco": toda aula tem

- a **anatomia** do componente (`dl.anatomy`), pedaço por pedaço;
- a **saída real**, colhida no compilador de verdade (`pre.term` e `pre.out`);
- o que acontece **quando dá errado**, com a mensagem real (`div.cenario`);
- **três** caixas "Experimente", que compilam e rodam o componente no navegador.

Tamanho: **2.800 a 4.000 palavras** por aula. Abaixo de 2.500 o testador reprova.

## 1. A linguagem ensinada

**Svelte 5, com runas** (`$state`, `$derived`, `$effect`, `$props`). Regras de ouro:

| certo (é o que o guia ensina) | errado (não entra nas aulas) |
|---|---|
| `let contador = $state(0)` | `let contador = 0` (modo antigo, só na aula `modo-antigo.html`) |
| `<button onclick={…}>` | `<button on:click={…}>` |
| `let { nome } = $props()` | `export let nome` (só na aula `modo-antigo.html`) |
| `{#snippet}` + `{@render}` | `<slot>` (só na aula `slots.html`, como comparação) |
| `{@html texto}` | `{texto}` para HTML (o guia ensina que isto escapa) |

SvelteKit entra no Nível 3: `+page.svelte`, `+layout.svelte`, `+page.js`, `+page.server.js`,
`+server.js`, `+error.svelte`, `hooks.server.js`. Antes disso, **nada de SvelteKit** — o leitor
precisa saber o que é um componente.

## 2. Esqueleto do arquivo

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seu Primeiro Componente — a tela que muda sozinha | Guia Svelte</title>
<meta name="description" content="100 a 180 caracteres, específicos desta aula.">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="assets/style.css">
<script>try{var t=localStorage.getItem("tema");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
</head>
<body>
<div class="layout">
<nav class="sidebar" id="sidebar" aria-label="Tópicos"></nav>
<main class="main">
<div class="content">

<div class="pager"></div>

<h1>Svelte · <span class="hl">Primeiro Componente</span></h1>
<p class="intro">…a Ana, o problema dela, em 3 a 5 linhas…</p>
<div class="note"><strong>Você vai aprender</strong><ul>…8 a 10 itens…</ul></div>

<hr>
<h2>1. …</h2>
…
<h2>Resumo</h2>

<div class="pager"></div>
</div>
</main>
</div>
<script src="assets/site.js"></script>
</body>
</html>
```

## 3. Ordem da aula (é sempre esta)

1. **A ideia antes do código** — 2 ou 3 parágrafos com a analogia do dia a dia (a padaria da Ana, a
   lista de compras, o quadro de avisos).
2. **A tabela "no dia a dia × no componente"** (`table.ref` dentro de `div.table-wrap`).
3. **O primeiro código** (`pre.file data-file="App.svelte"`) e a **anatomia** (`dl.anatomy`).
4. **A saída real**: `pre.out` com o HTML gerado ou o texto que aparece na tela, e/ou `pre.term`
   com a sessão de terminal.
5. **A caixa "Experimente"** logo depois do conceito (`div.trysvelte`).
6. **Variações** — o mesmo conceito com outros valores, outra forma de escrever, o custo de cada uma.
7. **Quando dá errado** — 3 `div.cenario` com a mensagem real do compilador (copiada, não inventada).
8. **Referência rápida** — 2 a 4 `table.ref` com o resumo do que existe.
9. **Exercícios** — 3 `.mc` + 1 `.exercise`.
10. **Resumo** — 6 a 10 marcadores, sempre `<h2>Resumo</h2>`.

Cada `<h2>` é numerado: `<h2>1. …</h2>`, `<h2>2. …</h2>`. São **10 a 13** seções de conteúdo.

## 4. As caixas "Experimente" (`.trysvelte`)

O leitor edita o componente e clica em **Rodar**: o guia compila o código com o **compilador de
verdade** (`svelte@5.59.2`) e monta no iframe. **Não é simulação.** A meta (`data-goal`) é conferida
pelo botão **Verificar**, pelo mesmo avaliador que o testador usa.

```html
<div class="trysvelte" data-goal="clique:button;;out:Cliques: 1">
<p class="try-task"><strong>Missão:</strong> faça o contador começar em 0 e chegar a 1 clique.</p>
<pre class="script" data-file="App.svelte">&lt;script&gt;
  let contador = $state(3);
&lt;/script&gt;

&lt;button onclick={() =&gt; contador++}&gt;Cliques: {contador}&lt;/button&gt;</pre>
<pre class="solucao" data-file="App.svelte">&lt;script&gt;
  let contador = $state(0);
&lt;/script&gt;

&lt;button onclick={() =&gt; contador++}&gt;Cliques: {contador}&lt;/button&gt;</pre>
</div>
```

Regras que o testador **reprova**:

- o código inicial **já cumpre** a meta (missão sem graça);
- a solução **não cumpre** a meta;
- `data-goal` desconhecido, vazio, ou sem nenhum passo observável;
- falta `pre.script` ou `pre.solucao`;
- meta que depende de algo que o leitor não vê (não vale "o console mostra…").

Passos da meta, na ordem, separados por `;;`:

| passo | para que serve |
|---|---|
| `out:<texto>` | o texto que aparece na tela é exatamente este (espaços colapsados) |
| `outre:<regex>` | o texto da tela casa com a expressão regular |
| `html:<html>` | o HTML gerado é exatamente este |
| `erro:<trecho>` | o compilador recusa o código com mensagem que contém o trecho |
| `clique:<seletor>` | clica no elemento (dentro do componente) |
| `digitar:<seletor>=<valor>` | escreve no campo e dispara `input` (use `seletor\|valor` quando o seletor tem `=`, ex.: `digitar:input[type=number]\|42`) |
| `depois:<ms>` | espera (promessas, transições) |

Exemplos reais:

```
data-goal="out:Olá, Ana"
data-goal="clique:button;;clique:button;;out:Cliques: 2"
data-goal="digitar:input=Ana;;out:Olá, Ana"
data-goal="clique:#mais;;out:Total: 3"
data-goal="erro:$state(...) can only be used as a variable declaration initializer"
```

**Escape:** dentro de `pre.file`, `pre.script`, `pre.solucao` e `pre.out` o `<` e o `>` são
escapados (`&lt;`, `&gt;`), porque é HTML. **Só** `pre.term` fica cru (é terminal). O testador
reprova tag crua dentro de `pre`.

## 5. Saídas reais: como colher

O compilador e o renderizador são os de verdade. Use as ferramentas:

```bash
export PATH="$HOME/.local/node22/bin:$PATH"
cd ~/guia-svelte-novo

node tools/render.js tmp/App.svelte            # HTML gerado (vai no pre.out)
node tools/render.js tmp/App.svelte --texto    # só o texto que aparece na tela
node tools/render.js tmp/App.svelte --css      # o CSS que o compilador gerou
node tools/render.js tmp/App.svelte --json     # html, texto, css, erros, avisos
node tools/render.js tmp/Ruim.svelte           # erro de compilação, no formato da caixa
```

Saída de exemplo (é esta a forma do `pre.out`):

```
<h1>Olá, Ana</h1> <button>Cliques: 0</button> <p>nenhum clique ainda</p>
```

**Regra de fidelidade:** o `pre.out` tem de ser **copiado** da saída do `render.js` — nada de
escrever à mão "mais ou menos como sai". O nome do arquivo entra no hash do CSS e na mensagem de
erro, então repita o da aula: `node tools/render.js tmp/App.svelte --nome src/App.svelte`.

**Conferidor de saídas (use sempre antes de commitar):**

```bash
node tools/verificar-saidas.js -q SUA-PAGINA.html     # confere cada par pre.file + pre.out
node tools/verificar-saidas.js --fix SUA-PAGINA.html  # reescreve os pre.out com a saída real
```

Ele recompila cada `pre.file` com o compilador de verdade e compara com o `pre.out` seguinte: HTML
contra HTML, texto contra texto, CSS contra CSS, e mensagem de erro contra a mensagem real. `--fix`
conserta os blocos divergentes — depois **releia o texto ao redor**, porque um número que mudou
(o hash `svelte-xxxxx`, o número da linha do erro) costuma aparecer citado na prosa também. Onde a lição é sobre comportamento (o que aparece na
tela), prefira `--texto`; onde é sobre marcação, use o HTML.

### Terminal (`pre.term`)

A máquina da Ana é `ana@notebook`, o projeto dela fica em `~/loja`:

```
ana@notebook:~/loja$ npm run dev
  VITE v7.1.3  ready in 412 ms
  ➜  Local:   http://localhost:5173/
```

- o prompt `ana@notebook:~/loja$` aparece sozinho, sem `$` extra;
- sessões de `npm`, `npx sv`, `vite build` são as reais — rode antes de escrever;
- para SvelteKit, o projeto de referência em `tmp/kit` existe para colher essas saídas (peça as
  sessões a quem cuida das ferramentas se precisar de uma que não exista);
- **limpeza permitida**: tirar os códigos de cor ANSI e as linhas que só existem na máquina de quem
  colheu (`[vite] Forced re-optimization` com horário, `Port 5173 is in use`). O que **não** se
  tira é linha de resultado: tamanho de arquivo, número de módulos, tempo de build, mensagem de erro.
  Se o número muda a cada execução (tempo), a página diz que é uma medição daquela execução.

## 6. Componentes do guia

| componente | quando usar |
|---|---|
| `<dl class="anatomy">` | a anatomia de um pedaço de código (1 a 3 por página) |
| `<pre class="file" data-file="App.svelte">` | código completo, com nome de arquivo |
| `<pre class="out">` | saída do compilador/render (HTML ou texto) — escapado |
| `<pre class="term">` | sessão de terminal com prompt — cru |
| `<div class="cenario">` | "quando dá errado", com `<pre class="out">` da mensagem real |
| `<pre class="solucao">` | solução de um exercício (fica escondida até clicar) |
| `<div class="table-wrap"><table class="ref">` | comparação, referência (2 a 4 por página) |
| `<div class="mc" data-answer="2">` | múltipla escolha (3 por página) |
| `<div class="exercise">` | completar código com `<input data-answer="…">` (1 por página) |
| `<div class="tip">`, `<div class="warning">`, `<div class="note">` | dica, aviso, nota |

## 6.1 Convenções que o time fechou (versão, portas, onde vai cada saída)

**Versões canônicas** (medidas nesta máquina; a página que citar versão usa estas):

| | versão | onde |
|---|---|---|
| Svelte | **5.59.2** | `assets/vendor.json` e o motor das caixas |
| Vite | **7.3.8** | projeto `~/loja` (Svelte puro) |
| SvelteKit | **3.4.1** (com Vite **8.4.0**) | projeto do Nível 3 |
| `@sveltejs/vite-plugin-svelte` | 6.2.4 | Svelte puro |

No SvelteKit 3 **não existe `svelte.config.js`**: o plugin e o adaptador ficam no `vite.config.js`
(`sveltekit({ compilerOptions, adapter })`). Se uma aula falar do arquivo antigo, diga que ele não
é mais lido — é o que `kit-projeto.html` e `adapters.html` fazem.

**A pasta do projeto é `~/loja` nos dois casos**: nos Níveis 1 e 2 é um projeto Svelte puro (Vite
7); no Nível 3 a Ana recria a mesma pasta como projeto SvelteKit (`npx sv create`), e a aula que faz
isso (`kit-projeto.html`) diz que é um projeto novo. O Vite do Kit é o 8.4.0 — cada aula cita a
versão que apareceu no terminal dela.

**Portas**: `npm run dev` usa **5173** e `npm run preview` usa **4173**. Se na sua máquina a porta
estiver ocupada, o Vite escreve `Port 5173 is in use, trying another one…` — não esconda a linha, e
diga na página que o número vem do terminal, não do código.

**Onde vai cada saída:**

| tipo de saída | bloco | conferido por máquina? |
|---|---|---|
| HTML/texto/CSS que o compilador gera de um `.svelte` | `pre.out` logo depois do `pre.file` | **sim** (`verificar-saidas.js`) |
| mensagem de erro do compilador sobre um `.svelte` | `pre.out` logo depois do `pre.file` | **sim** |
| sessão de terminal: `npm`, `curl`, `build`, `dev`, `ls` | `pre.term` | não (é sessão, não saída de componente) |
| resposta HTTP, log de servidor, saída de teste | `pre.term` | não |
| aviso do compilador (`a11y_*`, `non_reactive_update`) | prosa, com o texto entre `<code>` | — |

Um `pre.out` **só** existe pareado com um `pre.file`: é o que o conferidor recompila. Saída de
pai+filho ou que depende de `props` vai como `pre.term` (ou como segundo `pre.out`, com a ressalva
escrita na página de que aquele bloco é composição de dois arquivos).

### Letras miúdas que já causaram erro

- **`pre.term` é livre**: pode ficar cru (o testador não cobra escape ali) ou escapado. Se a linha
  do terminal tiver algo que o navegador leria como tag (`<link …>`, `<script>`), **escape** — senão
  a linha desaparece da tela.
- **`pre.out` de uma saída que já contém entidade** precisa de escape duplo: se o compilador gera
  `&lt;p&gt;`, a página escreve `&amp;lt;p&amp;gt;` (o navegador mostra `&lt;p&gt;`, que é a saída).
- **`data-file` é o caminho completo** (`src/routes/conta/+page.svelte`), sempre igual ao `--nome` do
  `render.js`: o hash do CSS e o número da linha do erro dependem desse nome.
- **Toda página com pelo menos um `pre.file` deveria ter um par conferido** (`pre.file` + `pre.out`).
  Nas aulas de servidor, onde a saída é log, vale mostrar um componente pequeno só para ter o par.
- **Um `pre.out` de pai + filho** não passa no conferidor (ele compila um arquivo só, com
  `props: {}`): nesse caso use `pre.term` e diga na página que a saída é de dois arquivos juntos.

- **Cada `pre.file` precisa da sua própria saída logo em seguida.** O conferidor casa cada `pre.file`
  com o **próximo** `pre.out`, mesmo com prosa no meio: um `pre.file` sem saída "rouba" o `pre.out`
  do bloco seguinte e a página passa a divergir. Se o bloco é só ilustração, não use `pre.file`
  (use `pre.script` ou `code`).
- **CSS gerado** (o que sai de `render.js --css`) é `pre.out` do **mesmo** `pre.file` que tem o
  `<style>` — não é bloco solto no meio do texto.
- **`div.cenario` aceita erro de execução também**: mensagem do compilador, do navegador
  (`naoExiste is not defined`) ou do servidor (`EADDRINUSE`) — o que importa é ser copiada de verdade.
- **Meta `html:` com aspas dentro** usa aspas simples no atributo:
  `data-goal='html:&lt;p class="ok"&gt;…&lt;/p&gt;'`.

- **`data-file` é só para arquivo `.svelte`.** O conferidor compila o que estiver em `data-file`; um
  `main.js` ou um `index.html` ali divergem por definição. Para esses, use `<pre class="file">` **sem**
  `data-file` (ou `code` na prosa).
- **Erro que só existe no navegador** (`each_key_duplicate` de produção, `effect_update_depth_exceeded`)
  não sai no `pre.out` de um `pre.file`: aquele bloco é recompilado com `dev: false`. Deixe esses
  erros na prosa, entre aspas, ou num `pre.term`.
- **Saída depois de clique ou digitação**: pode vir num segundo `pre.out`, mas o **primeiro**
  `pre.out` do par é o que o conferidor olha — ele tem de ser o estado inicial.

## 7. Privacidade

Proibido: o nome do dono da máquina, o home real, o caminho de root, o IP da VPS, o IP da rede
interna, o endereço MAC e o nome da rede Wi-Fi. Só `ana@notebook` e `/home/ana`.

## 8. Antes de entregar

```bash
export PATH="$HOME/.local/node22/bin:$PATH"
export NODE_PATH=/home/wallyson/guia-react/node_modules
cd ~/guia-svelte-novo
node tools/testar-missoes.js -q SUA-PAGINA.html
```

O testador confere 11 coisas: cabeçalho, estrutura, conteúdo, caixas, **metas rodando no Chromium**,
escape, links, placeholders, privacidade, tamanho e o tipo da página. **Zero FALHA** é o mínimo para
entregar; aviso tem de ser justificado no commit.

## 9. Estilo

- Português do Brasil, "você", frases curtas, sem "simplesmente", "basta" nem "obviamente".
- Traduza o termo na primeira vez: *componente* (um pedaço da tela com nome), *estado* (o que muda),
  *propriedade* (o que vem de fora), *reativo* (muda sozinho quando o dado muda).
- A vida da Ana: a padaria, a lista de compras, a turma, o troco, a agenda.
- O **porquê** antes do **como**, e o **custo** de cada escolha.
- Nunca "como você já sabe": quem lê é quem nunca programou.
