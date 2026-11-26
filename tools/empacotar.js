#!/usr/bin/env node
/* empacotar.js — o motor do site é o motor de verdade, e este script garante isso.
 *
 *   node tools/empacotar.js --checar    confere versão e hashes dos arquivos empacotados
 *   node tools/empacotar.js --gerar     reconstrói os pacotes a partir de node_modules/svelte
 *
 * O que existe em assets/:
 *   svelte-compiler.js  compilador (svelte/compiler) para o navegador, ~830 KB
 *   svelte-motor.js     runtime completo (svelte + svelte/internal/client + legacy + flags), ~126 KB
 *
 * Regra do guia: a caixa "Experimente" usa ESTE compilador. Se a versão do Svelte mudar, o guia
 * inteiro precisa ser reconferido (as mensagens de erro mudam de texto).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ASSETS = path.join(RAIZ, "assets");
const MANIFESTO = path.join(ASSETS, "vendor.json");
const PACOTES = ["svelte-compiler.js", "svelte-motor.js"];

function hash(arq) {
  return crypto.createHash("sha256").update(fs.readFileSync(arq)).digest("hex").slice(0, 16);
}

function versaoSvelte() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, "node_modules/svelte/package.json"), "utf8")).version;
  } catch (e) {
    return null;
  }
}

function lerManifesto() {
  if (!fs.existsSync(MANIFESTO)) return null;
  try { return JSON.parse(fs.readFileSync(MANIFESTO, "utf8")); } catch (e) { return null; }
}

function gerar() {
  const versao = versaoSvelte();
  if (!versao) {
    console.error("não achei node_modules/svelte (rode npm install primeiro)");
    process.exit(2);
  }
  const entradas = {
    "svelte-compiler.js": ["tools/entradas/compilador.js", true],
    "svelte-motor.js": ["tools/entradas/motor.js", true]
  };
  const esbuild = path.join(RAIZ, "node_modules/.bin/esbuild");
  if (!fs.existsSync(esbuild)) {
    console.error("não achei node_modules/.bin/esbuild");
    process.exit(2);
  }
  Object.keys(entradas).forEach((saida) => {
    const [entrada] = entradas[saida];
    const r = cp.spawnSync(esbuild, [entrada, "--bundle", "--format=esm", "--platform=browser", "--minify",
      "--outfile=" + path.join(ASSETS, saida)], { cwd: RAIZ, encoding: "utf8" });
    if (r.status !== 0) {
      console.error("esbuild falhou em " + saida + ":\n" + (r.stderr || r.stdout));
      process.exit(1);
    }
    console.log("gerado assets/" + saida);
  });
  const manifesto = {
    svelte: versao,
    gerado: new Date().toISOString().slice(0, 10),
    arquivos: {}
  };
  PACOTES.forEach((p) => {
    manifesto.arquivos[p] = {
      sha256: hash(path.join(ASSETS, p)),
      bytes: fs.statSync(path.join(ASSETS, p)).size
    };
  });
  fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + "\n");
  console.log("manifesto escrito em assets/vendor.json (svelte " + versao + ")");
}

function checar() {
  const manifesto = lerManifesto();
  if (!manifesto) {
    console.error("falta assets/vendor.json — rode: node tools/empacotar.js --gerar");
    process.exit(1);
  }
  let erros = 0;
  PACOTES.forEach((p) => {
    const arq = path.join(ASSETS, p);
    if (!fs.existsSync(arq)) {
      console.error("FALTA assets/" + p);
      erros++;
      return;
    }
    const esperado = manifesto.arquivos[p] && manifesto.arquivos[p].sha256;
    const atual = hash(arq);
    if (esperado !== atual) {
      console.error("assets/" + p + " mudou desde o manifesto (" + atual + " ≠ " + esperado + ") — rode --gerar");
      erros++;
    } else {
      console.log("assets/" + p + " ok (" + Math.round(fs.statSync(arq).size / 1024) + " KB, sha " + atual + ")");
    }
  });
  const instalada = versaoSvelte();
  if (!instalada) {
    console.log("aviso: node_modules/svelte ausente — não deu para conferir a versão");
  } else if (instalada !== manifesto.svelte) {
    console.error("a versão instalada do svelte é " + instalada + " e os pacotes foram gerados com " +
      manifesto.svelte + " — rode --gerar e reconfira as aulas (mensagens de erro mudam)");
    erros++;
  } else {
    console.log("svelte " + manifesto.svelte + " confere com o manifesto");
  }
  /* o compilador que o SITE usa precisa carregar de verdade */
  const compilador = path.join(ASSETS, "svelte-compiler.js");
  if (fs.existsSync(compilador)) {
    const txt = fs.readFileSync(compilador, "utf8");
    if (!/export/.test(txt)) {
      console.error("assets/svelte-compiler.js não parece um módulo ES (sem export)");
      erros++;
    }
  }
  if (erros) {
    console.error("\n" + erros + " problema(s) nos pacotes do motor");
    process.exit(1);
  }
  console.log("\nmotor do site confere com o do projeto.");
}

const args = process.argv.slice(2);
if (args.includes("--gerar")) gerar();
else if (args.includes("--checar")) checar();
else {
  console.error("uso: node tools/empacotar.js --checar | --gerar");
  process.exit(2);
}
