#!/usr/bin/env node
/* verificar-saidas.js — confere se a saída escrita nas aulas é a saída DE VERDADE.
 *
 *   node tools/verificar-saidas.js pagina.html [outra.html …]
 *   node tools/verificar-saidas.js --todas
 *   -q            mostra só as divergências
 *
 * Para cada par "<pre class=file data-file=X.svelte>" seguido de "<pre class=out>", este script
 * usa o compilador de verdade (svelte 5.59.2) e compara com o que a página publica:
 *   - bloco publicado com tags (<h1>, <p>…)  -> comparado com o HTML gerado por svelte/server;
 *   - bloco publicado só com texto           -> comparado com o texto que aparece na tela;
 *   - bloco com cara de CSS                  -> comparado com o CSS que o compilador gerou;
 *   - componente que NÃO compila             -> a página tem de publicar a mensagem do compilador.
 *
 * Reprova (divergência) quando o que está na página não é o que o compilador produz — o pecado
 * capital do guia: saída "mais ou menos como sai".
 *
 * Sai com 1 quando alguma divergência é encontrada.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const N = require("./nucleo");

const RAIZ = N.RAIZ;
const args = process.argv.slice(2);
let todas = false, quieto = false, corrigir = false;
const paginas = [];
for (const a of args) {
  if (a === "--todas") todas = true;
  else if (a === "-q" || a === "--quieto") quieto = true;
  else if (a === "--fix") corrigir = true;
  else if (a.charAt(0) === "-") { console.error("opção desconhecida: " + a); process.exit(2); }
  else paginas.push(a);
}
if (todas) fs.readdirSync(RAIZ).filter((f) => /\.html$/i.test(f)).sort().forEach((f) => paginas.push(f));
if (!paginas.length) { console.error("uso: node tools/verificar-saidas.js [--todas] [-q] pagina.html …"); process.exit(2); }

/* --------------------------------------------------------------- o motor real */
let compile, render, pasta;
async function prepararMotor() {
  ({ compile } = await import("svelte/compiler"));
  ({ render } = await import("svelte/server"));
  pasta = fs.mkdtempSync(path.join(RAIZ, "tmp", ".saidas-"));
}
let n = 0;

/* devolve {html, texto, css} ou {erro} */
async function produzir(fonte, nome) {
  let comp;
  try {
    comp = compile(fonte, { generate: "server", dev: false, filename: nome });
  } catch (e) {
    return { erro: mensagem(e) };
  }
  const css = comp.css && comp.css.code ? comp.css.code : "";
  const destino = path.join(pasta, "c" + (++n) + ".mjs");
  fs.writeFileSync(destino, comp.js.code);
  let mod;
  try {
    mod = await import("file://" + destino);
  } catch (e) {
    return { erro: mensagem(e), css };
  }
  try {
    const saida = render(mod.default, { props: {} });
    const html = String(saida.body || "")
      .replace(/<!--\[-->|<!--\]-->/g, "")
      .replace(/<!--[^>]*-->/g, "")
      .trim();
    return { html, texto: N.normalizar(N.decodificarEntidades(html.replace(/<[^>]*>/g, " "))), css };
  } catch (e) {
    return { erro: mensagem(e), css };
  }
}

function mensagem(e) {
  const msg = String((e && e.message) || e).split("\n")[0].trim();
  if (e && e.start && typeof e.start.line === "number") {
    return "Erro de compilação (linha " + e.start.line + ", coluna " + e.start.column + "): " + msg;
  }
  return msg;
}

const normal = (s) => N.normalizar(N.decodificarEntidades(String(s == null ? "" : s)).replace(/<[^>]*>/g, " "));

/* ---------------------------------------------------------------------- a página */
async function verificar(arq) {
  const html = fs.readFileSync(arq, "utf8").replace(/^\uFEFF/, "");
  const src = N.prepararHtml(html);
  const tags = N.varrer(src);
  const pres = N.listar(tags, "pre");
  const achados = [];
  let pares = 0, conferidos = 0;
  const conteudo = (el) => N.decodificarEntidades(src.slice(el.fimTag, el.fimEl ?? src.length));

  /* Cada pre.file é comparado com o PRÓXIMO pre.out, mesmo que exista prosa entre os dois.
     Se no meio aparecer outro pre.file, o par não existe (o autor mostrou dois programas). */
  for (let k = 0; k < pres.length; k++) {
    const pf = pres[k];
    if (!N.temClasse(pf.at, "file") || !pf.at["data-file"]) continue;
    let seguinte = null;
    for (let j = k + 1; j < pres.length; j++) {
      if (N.temClasse(pres[j].at, "file")) break;
      if (N.temClasse(pres[j].at, "out")) { seguinte = pres[j]; break; }
    }
    if (!seguinte) continue;
    pares++;
    const nomeArq = pf.at["data-file"];
    const codigo = conteudo(pf).replace(/^\n/, "").replace(/\s+$/, "\n");
    const publicadoCru = conteudo(seguinte).trim();
    const r = await produzir(codigo, nomeArq);

    // 1. a página publica uma mensagem de erro: tem de ser a mensagem real
    const pareceErro = /^(Erro de compilação|Erro ao renderizar|\w+Error|ReferenceError|TypeError)/i.test(publicadoCru) ||
      / is not defined|is not a function|can only be used|Expected token|attempted to close|left open/i.test(publicadoCru);
    if (r.erro) {
      const esperado = normal(r.erro);
      const publicado = normal(publicadoCru);
      conferidos++;
      if (!publicado || (esperado.indexOf(publicado) === -1 && publicado.indexOf(esperado) === -1 &&
        normal(esperado.split(": ").slice(1).join(": ")).indexOf(publicado) === -1)) {
        achados.push({
          tipo: "erro",
          msg: nomeArq + " não compila/roda, e a página mostra outra coisa",
          publicado: N.curto(publicadoCru, 200),
          real: N.curto(r.erro, 200),
          corrigir: { el: seguinte, novo: r.erro }
        });
      }
      continue;
    }
    if (pareceErro) {
      achados.push({
        tipo: "erro",
        msg: nomeArq + " compila e roda, mas a página publica uma mensagem de erro",
        publicado: N.curto(publicadoCru, 200),
        real: N.curto(r.html || r.texto, 200),
        corrigir: { el: seguinte, novo: r.html || r.texto }
      });
      continue;
    }

    // 2. bloco de CSS (o autor tirou de --css)
    const pareceCss = /[{}]/.test(publicadoCru) && /:/.test(publicadoCru) && !/<[a-zA-Z]/.test(publicadoCru) &&
      /<style>/.test(codigo);
    if (pareceCss) {
      conferidos++;
      if (normal(publicadoCru) !== normal(r.css)) {
        achados.push({ tipo: "css", msg: "CSS de " + nomeArq + " não bate com o compilador", publicado: N.curto(publicadoCru, 200), real: N.curto(r.css, 200), corrigir: { el: seguinte, novo: r.css } });
      }
      continue;
    }

    // 3. HTML gerado ou texto da tela
    const pareceHtml = /<[a-zA-Z][^>]*>/.test(publicadoCru);
    // HTML compara com HTML (tag por tag); texto compara com texto (tag fora)
    const publicado = pareceHtml ? N.normalizar(publicadoCru) : normal(publicadoCru);
    const referencia = pareceHtml ? N.normalizar(r.html) : r.texto;
    conferidos++;
    if (publicado !== referencia) {
      achados.push({
        tipo: "divergente",
        msg: "saída de " + nomeArq + " não bate com o compilador (" + (pareceHtml ? "HTML" : "texto") + ")",
        publicado: N.curto(publicadoCru, 200),
        real: N.curto(pareceHtml ? r.html : r.texto, 200),
        corrigir: { el: seguinte, novo: pareceHtml ? r.html : r.texto }
      });
    }
  }
  if (corrigir && achados.length) {
    // de trás para a frente, para os offsets não mudarem
    const lista = achados.filter((a) => a.corrigir && a.corrigir.el).sort((x, y) => y.corrigir.el.ini - x.corrigir.el.ini);
    /* os offsets de `src` valem para o arquivo original: é ele que recebe a correção
       (sobre `src` os scripts do <head> seriam apagados) */
    let texto = html;
    lista.forEach((a) => {
      const el = a.corrigir.el;
      const corpo = String(a.corrigir.novo).trim()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      texto = texto.slice(0, el.fimTag) + "\n" + corpo + "\n" + texto.slice(el.fimEl === null ? texto.length : el.fimEl);
    });
    if (texto !== src) texto = texto.replace(/\n{3,}/g, "\n\n");
    if (texto !== src) {
      fs.writeFileSync(arq, texto);
      achados.forEach((a) => { a.corrigido = !!a.corrigir; });
    }
  }
  return { pares, conferidos, achados };
}

(async () => {
  await prepararMotor();
  let totalPares = 0, totalConf = 0, comProblema = 0;
  const listaRuins = [];
  for (const p of paginas) {
    const arq = path.join(RAIZ, p);
    if (!fs.existsSync(arq)) { console.error("não achei: " + p); continue; }
    const r = await verificar(arq);
    totalPares += r.pares;
    totalConf += r.conferidos;
    if (r.achados.length) {
      comProblema++;
      listaRuins.push(p);
      console.log("\n== " + p);
      r.achados.forEach((a) => {
        console.log("  DIVERGE " + a.msg);
        if (a.publicado !== undefined) console.log("    na página: " + a.publicado);
        if (a.real !== undefined) console.log("    compilador: " + a.real);
      });
    } else if (!quieto) {
      console.log("ok  " + p + "  (" + r.conferidos + " saída(s) conferida(s))");
    }
  }
  try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) {}
  console.log("\n" + totalConf + " de " + totalPares + " par(es) arquivo+saída conferidos; " + comProblema + " página(s) com divergência");
  if (comProblema) {
    console.log("com divergência: " + listaRuins.join(", "));
    process.exit(1);
  }
})();
