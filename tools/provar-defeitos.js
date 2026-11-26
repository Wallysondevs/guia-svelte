#!/usr/bin/env node
/* provar-defeitos.js — prova que o testador REPROVA quando o guia tem defeito.
 *
 * Um testador que só diz "ok" não serve para nada. Este script pega a aula-modelo
 * (primeiro-componente.html), injeta um defeito de cada vez numa cópia em tmp/defeitos/
 * e chama o testador de verdade. Se o testador NÃO reprovar, é o testador que está errado.
 *
 *   node tools/provar-defeitos.js            roda todos os defeitos
 *   node tools/provar-defeitos.js -v         mostra a saída do testador em cada caso
 *
 * Sai com 1 se algum defeito passar batido.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const N = require("./nucleo");

const RAIZ = N.RAIZ;
const MODELO = path.join(RAIZ, "primeiro-componente.html");
const PASTA = path.join(RAIZ, "tmp/defeitos");
const verboso = process.argv.includes("-v") || process.argv.includes("--verboso");

function semSimulado(html, de, para) {
  if (html.indexOf(de) === -1) throw new Error("o defeito não casou com nada: " + de.slice(0, 60));
  return html.split(de).join(para);
}

const DEFEITOS = [
  {
    nome: "sem dl.anatomy",
    espera: /dl\.anatomy/,
    html: (h) => h.replace(/<dl class="anatomy">[\s\S]*?<\/dl>/g, ""),
    semSim: true
  },
  {
    nome: "table.ref fora do .table-wrap",
    espera: /FORA de \.table-wrap/,
    html: (h) => h.replace('<div class="table-wrap">\n<table class="ref">', '<table class="ref">').replace("</table>\n</div>", "</table>"),
    semSim: true
  },
  {
    nome: "sem <h2>Resumo</h2>",
    espera: /Resumo/,
    html: (h) => h.replace("<h2>Resumo</h2>", "<h2>Fim</h2>"),
    semSim: true
  },
  {
    nome: "meta fraca (inicial igual à solução)",
    espera: /já cumpre a meta/,
    html: (h) => {
      const m = h.match(/<pre class="script"[^>]*>([\s\S]*?)<\/pre>\s*<pre class="solucao"[^>]*>([\s\S]*?)<\/pre>/);
      if (!m) throw new Error("não achei o par script/solucao");
      return h.replace(m[0], m[0].replace(m[1], m[2]));
    }
  },
  {
    nome: "solução não cumpre a meta",
    espera: /a SOLUÇÃO não cumpre/,
    html: (h) => h.replace('data-goal="out:R$ 0.90"', 'data-goal="out:R$ 9.99"')
  },
  {
    nome: "passo de meta inventado",
    espera: /passo de meta desconhecido/,
    html: (h) => h.replace('data-goal="out:R$ 0.90"', 'data-goal="console:log"'),
    semSim: true
  },
  {
    nome: "menos de 3 caixas",
    espera: /caixa\(s\) \.trysvelte/,
    html: (h) => {
      const i = h.indexOf('<div class="trysvelte"');
      const j = h.indexOf('<div class="trysvelte"', i + 10);
      const k = h.indexOf("</div>", h.indexOf("</pre>", j)) + 6;
      return h.slice(0, j) + h.slice(k);
    },
    semSim: true
  },
  {
    nome: "< sem escape dentro de pre.file",
    espera: /sem escape dentro de/,
    html: (h) => h.replace("&lt;h1&gt;Olá, {nome}&lt;/h1&gt;", "<h1>Olá, {nome}</h1>"),
    semSim: true
  },
  {
    nome: "link para página que não existe",
    espera: /NÃO existe no disco/,
    html: (h) => h.replace("<p>Aquele <code>svelte-7mbznn</code> é um selo",
                          "<p><a href=\"nao-existe-mesmo.html\">veja</a> Aquele <code>svelte-7mbznn</code> é um selo"),
    semSim: true
  },
  {
    nome: "placeholder TODO",
    espera: /placeholder de rascunho/,
    html: (h) => h.replace("<h2>1. A ideia", "<h2>1. TODO A ideia"),
    semSim: true
  },
  {
    nome: "dado da máquina real",
    espera: /dado da máquina real/,
    html: (h) => h.replace("ana@notebook:~/loja$ npm run dev", "ana@notebook:/home/" + "wallyson/loja$ npm run dev"),
    semSim: true
  },
  {
    nome: "texto curto demais",
    espera: /palavras/,
    html: (h) => {
      const ini = h.indexOf("<h2>3.");
      const fim = h.indexOf("<h2>9.");
      return h.slice(0, ini) + h.slice(fim);
    },
    semSim: true
  },
  {
    nome: "title sem | Guia Svelte",
    espera: /\| Guia Svelte/,
    html: (h) => h.replace(/\| Guia Svelte<\/title>/, "— Svelte</title>"),
    semSim: true
  },
  {
    nome: "sem o segundo .pager",
    espera: /\.pager na página/,
    html: (h) => {
      const i = h.lastIndexOf('<div class="pager"></div>');
      return h.slice(0, i) + h.slice(i + '<div class="pager"></div>'.length);
    },
    semSim: true
  },
  {
    nome: "meta description curta",
    espera: /meta description tem/,
    html: (h) => h.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="curta">'),
    semSim: true
  },
  {
    nome: "h2 fora da numeração",
    espera: /numerados/,
    aviso: true,
    html: (h) => {
      const antes = h;
      const novo = h.replace("<h2>2. O primeiro componente da Ana</h2>", "<h2>O primeiro componente da Ana</h2>");
      if (novo === antes) throw new Error("não achei o h2 2");
      return novo;
    },
    semSim: true
  }
];

function rodarTestador(arquivo, semSim) {
  const env = Object.assign({}, process.env, {
    PATH: "/home/wallyson/.local/node22/bin:" + process.env.PATH,
    NODE_PATH: process.env.NODE_PATH || "/home/wallyson/guia-react/node_modules"
  });
  const comando = ["tools/testar-missoes.js", arquivo].concat(semSim ? ["--sem-sim"] : []);
  const r = cp.spawnSync(process.execPath, comando, { cwd: RAIZ, env, encoding: "utf8", timeout: 240000 });
  return { saida: (r.stdout || "") + (r.stderr || ""), codigo: r.status };
}

function principal() {
  if (!fs.existsSync(MODELO)) {
    console.error("não achei a aula-modelo: " + MODELO);
    process.exit(2);
  }
  const original = fs.readFileSync(MODELO, "utf8");
  fs.mkdirSync(PASTA, { recursive: true });

  let passaram = 0;
  console.log("provando " + DEFEITOS.length + " defeitos contra o testador (fonte: primeiro-componente.html)\n");

  DEFEITOS.forEach((d, k) => {
    const nome = "d" + String(k + 1).padStart(2, "0") + "-" + d.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
    const arq = path.join(PASTA, nome + ".html");
    let html;
    try {
      html = d.html(original);
    } catch (e) {
      console.log("✗ " + d.nome + ": o defeito não pôde ser injetado — " + e.message);
      return;
    }
    if (html === original) {
      console.log("✗ " + d.nome + ": a injeção não mudou nada (defeito mal escrito)");
      return;
    }
    fs.writeFileSync(arq, html);
    const relativo = path.relative(RAIZ, arq);
    const r = rodarTestador(relativo, d.semSim === true);
    const pegou = d.aviso
      ? r.codigo === 0 && d.espera.test(r.saida)
      : r.codigo === 1 && d.espera.test(r.saida);
    if (pegou) {
      passaram++;
      console.log("✓ " + d.nome + " — reprovado como devia");
    } else {
      console.log("✗ " + d.nome + " — PASSOU BATIDO (código " + r.codigo + ")");
      if (verboso) console.log(r.saida.split("\n").slice(-14).join("\n"));
      else console.log("   rode com -v para ver a saída do testador");
    }
  });

  console.log("");
  console.log(passaram + " de " + DEFEITOS.length + " defeitos reprovados");
  if (passaram < DEFEITOS.length) {
    console.log("o testador deixou passar defeito: conserte a REGRA, não o defeito.");
    process.exit(1);
  }
  console.log("o testador está afiado.");
}

principal();
