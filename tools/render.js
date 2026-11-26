#!/usr/bin/env node
/* render.js — colhe a saída de verdade de um componente Svelte 5.
 *
 *   node tools/render.js App.svelte               HTML gerado pela renderização no servidor
 *   node tools/render.js App.svelte --texto       só o texto que aparece na tela
 *   node tools/render.js App.svelte --bruto       HTML exato (com os marcadores <!--[--> do Svelte)
 *   node tools/render.js App.svelte --css         o CSS que o compilador gerou para o componente
 *   node tools/render.js App.svelte --json        {html, texto, css, erros, avisos}
 *   node tools/render.js App.svelte --props '{"nome":"Ana"}'
 *   node tools/render.js App.svelte --cliente     confere o código gerado para o navegador
 *
 * O que sai aqui é o que a aula pode escrever num <pre class="out">: este programa usa o
 * MESMO compilador (svelte@5) e o MESMO renderizador (svelte/server) das caixas do guia.
 * Erro de compilação sai no mesmo formato da caixa:
 *   Erro de compilação (linha 3, coluna 10): Expected }
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

async function principal() {
  const args = process.argv.slice(2);
  const arq = args.find((a) => !a.startsWith("--"));
  if (!arq) {
    console.error("uso: node tools/render.js App.svelte [--texto|--bruto|--css|--json] [--props '{\"x\":1}'] [--cliente]");
    process.exit(2);
  }
  if (!fs.existsSync(arq)) {
    console.error("não achei o arquivo: " + arq);
    process.exit(2);
  }

  const querTexto = args.includes("--texto");
  const querBruto = args.includes("--bruto");
  const querCss = args.includes("--css");
  const querJson = args.includes("--json");
  const querCliente = args.includes("--cliente");
  const iNome = args.indexOf("--nome");
  const iProps = args.indexOf("--props");
  let props = {};
  if (iProps >= 0) {
    try {
      props = JSON.parse(args[iProps + 1] || "{}");
    } catch (e) {
      console.error("--props precisa de um JSON válido: " + e.message);
      process.exit(2);
    }
  }

  const { compile } = await import("svelte/compiler");
  const fonte = fs.readFileSync(arq, "utf8");
  // o nome do arquivo entra no hash do CSS e nas mensagens de erro: use --nome para repetir o da aula
  const nome = iNome >= 0 ? args[iNome + 1] : path.basename(arq);

  let comp;
  try {
    comp = compile(fonte, { generate: "server", dev: false, filename: nome });
  } catch (e) {
    console.log(formatarErro(e));
    process.exit(1);
  }

  const erros = [];
  const avisos = (comp.warnings || []).map((w) => formatarAviso(w));

  /* o código gerado para o servidor importa "svelte/internal/server": precisa de um arquivo
     de verdade no projeto para o Node resolver */
  // o módulo tem de nascer DENTRO do projeto, senão o Node não acha node_modules/svelte
  const pasta = fs.mkdtempSync(path.join(RAIZ, "tmp", ".render-"));
  const destino = path.join(pasta, "componente.mjs");
  fs.writeFileSync(destino, comp.js.code);

  let html = "";
  try {
    const { render } = await import("svelte/server");
    const mod = await import("file://" + destino);
    const saida = render(mod.default, { props });
    html = saida.body || "";
  } catch (e) {
    console.log("Erro ao renderizar: " + (e && e.message ? e.message : e));
    process.exit(1);
  } finally {
    try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) {}
  }

  if (querCliente) {
    try {
      compile(fonte, { generate: "client", dev: false, filename: nome });
    } catch (e) {
      erros.push(formatarErro(e));
    }
  }

  const css = comp.css && comp.css.code ? comp.css.code : "";
  const limpo = limpar(html);
  const texto = textoDoHtml(limpo);

  if (querJson) {
    console.log(JSON.stringify({ html: limpo, texto, css, erros, avisos }, null, 1));
    return;
  }
  if (querCss) {
    console.log(css.trim());
    return;
  }
  if (querTexto) {
    console.log(texto);
    return;
  }
  if (querBruto) {
    console.log(html);
    return;
  }
  console.log(limpo);
  avisos.forEach((a) => console.error("aviso: " + a));
  erros.forEach((e) => console.error(e));
}

/* o render() embrulha o conteúdo em comentários-âncora do Svelte (<!--[--> … <!--]-->).
   A aula mostra o HTML que o navegador recebe, sem esses marcadores internos. */
function limpar(html) {
  return String(html)
    .replace(/<!--\[-->|<!--\]-->/g, "")
    .replace(/<!--[^>]*-->/g, "")
    .trim();
}

function textoDoHtml(html) {
  const N = require("./nucleo");
  return N.normalizar(N.decodificarEntidades(String(html).replace(/<[^>]*>/g, " ")));
}

function formatarErro(e) {
  const pos = e && e.start && typeof e.start.line === "number"
    ? " (linha " + e.start.line + ", coluna " + e.start.column + ")"
    : "";
  const msg = String((e && e.message) || e).split("\n")[0].trim();
  return "Erro de compilação" + pos + ": " + msg;
}

function formatarAviso(w) {
  const pos = w && w.start && typeof w.start.line === "number" ? " (linha " + w.start.line + ")" : "";
  return (w && w.code ? w.code + pos + ": " : "") + (w && w.message ? w.message : String(w));
}

principal().catch((e) => {
  console.error("erro fatal:", e);
  process.exit(2);
});
