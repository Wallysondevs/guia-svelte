#!/usr/bin/env node
/* testar-navegador.js — abre as páginas no Chromium de verdade, clica em tudo e mede.
 *
 *   node tools/testar-navegador.js pagina.html [outra.html …]
 *   node tools/testar-navegador.js --todas
 *   --largura 1280        largura do desktop (padrão 1280)
 *   --fotos DIR           salva um PNG de cada página (claro e escuro)
 *   --rapido              não clica nas caixas (só carrega e mede)
 *
 * Reprova (problema) quando:
 *   - o menu lateral não tem o número de links da NIVEIS (menu quebrado);
 *   - alguma caixa .trysvelte não monta, ou o botão Rodar não desenha nada;
 *   - a página rola de lado a 375 px (o celular é o leitor mais comum);
 *   - aparece erro no console ou exceção na página;
 *   - o título da aba não termina em "| Guia Svelte".
 *
 * Sai com código 1 quando alguma página tem problema.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const N = require("./nucleo");

const RAIZ = N.RAIZ;
const args = process.argv.slice(2);
let todas = false, largura = 1280, fotos = null, rapido = false;
const paginas = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--todas") todas = true;
  else if (a === "--largura") largura = parseInt(args[++i], 10) || 1280;
  else if (a === "--fotos") fotos = args[++i];
  else if (a === "--rapido") rapido = true;
  else if (a.charAt(0) === "-") { console.error("opção desconhecida: " + a); process.exit(2); }
  else paginas.push(a);
}
if (todas) fs.readdirSync(RAIZ).filter((f) => /\.html$/i.test(f)).sort().forEach((f) => paginas.push(f));
if (!paginas.length) { console.error("uso: node tools/testar-navegador.js [--todas] [--fotos DIR] [página.html …]"); process.exit(2); }

function subirServidor() {
  const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
  const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const alvo = path.join(RAIZ, p);
    if (!alvo.startsWith(RAIZ)) { res.writeHead(403).end("fora"); return; }
    fs.readFile(alvo, (err, dados) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 " + p); return; }
      res.writeHead(200, { "content-type": tipos[path.extname(alvo)] || "application/octet-stream" });
      res.end(dados);
    });
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok({ servidor, porta: servidor.address().port })));
}

function acharPuppeteer() {
  const cands = [
    process.env.PUPPETEER_DIR && path.join(process.env.PUPPETEER_DIR, "puppeteer-core"),
    path.join(RAIZ, "node_modules/puppeteer-core"),
    path.join(os.homedir(), "guia-react/node_modules/puppeteer-core"),
    "puppeteer-core"
  ].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) {} }
  return null;
}
function acharChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), ".cache/puppeteer/chrome");
  try {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith("linux-")).sort().reverse();
    for (const d of dirs) {
      const p = path.join(base, d, "chrome-linux64/chrome");
      if (fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return undefined;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function testarPagina(pg, url, nomePag, esperado) {
  const problemas = [];
  const notas = [];
  const erros = [];
  let dentroDasCaixas = false;   // erro de componente é verificado pelo testar-missoes
  const aoErro = (e) => { if (!dentroDasCaixas) erros.push("exceção na página: " + String(e && e.message || e).slice(0, 160)); };
  const aoConsole = (m) => { if (!dentroDasCaixas && m.type() === "error") erros.push("console: " + m.text().slice(0, 160)); };
  pg.on("pageerror", aoErro);
  pg.on("console", aoConsole);

  const t0 = Date.now();
  try {
    await pg.setViewport({ width: largura, height: 900 });
    await pg.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    await dormir(120);

    const titulo = await pg.title();
    if (!/\|\s*Guia Svelte\s*$/.test(titulo)) problemas.push("título da aba não termina em \"| Guia Svelte\": \"" + titulo + "\"");

    const info = await pg.evaluate(() => {
      const caixas = document.querySelectorAll(".trysvelte");
      return {
        caixas: caixas.length,
        menu: document.querySelectorAll("#sidebar .nivel-lista a").length,
        marca: !!document.querySelector(".brand")
      };
    });
    if (!info.marca) problemas.push("a barra superior não foi montada (assets/site.js não rodou)");
    if (info.menu !== esperado) problemas.push("menu com " + info.menu + " links (a NIVEIS tem " + esperado + ")");

    let rodadas = 0, verificadas = 0, comMeta = 0;
    if (!rapido && info.caixas) {
      dentroDasCaixas = true;
      // espera o simulador carregar (compilador de 830 KB na primeira página)
      await pg.waitForFunction("window.__sveltePronto === true", { timeout: 30000 }).catch(() => {
        problemas.push("o compilador não carregou (window.__sveltePronto nunca ficou true)");
      });
      comMeta = await pg.evaluate(() => document.querySelectorAll(".trysvelte[data-goal]").length);
      for (let i = 0; i < info.caixas; i++) {
        const antes = erros.length;
        const okRodar = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          const b = c.querySelectorAll(".try-bar button")[0];
          if (!b) return false;
          b.click();
          return true;
        }, i);
        if (!okRodar) { problemas.push("caixa " + (i + 1) + " sem botão Rodar"); continue; }
        const alvoEspera = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          return /(^|;;)\s*erro:/.test(c.getAttribute("data-goal") || "") ? 2600 : 450;
        }, i);
        await dormir(alvoEspera);
        const estado = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          const vivo = c.querySelector(".try-vivo");
          const out = c.querySelector(".try-out");
          const iframe = c.querySelector(".try-vivo iframe");
          const corpo = iframe && iframe.contentDocument && iframe.contentDocument.body;
          return {
            temIframe: !!iframe,
            html: corpo ? corpo.innerHTML.trim().length : 0,
            out: out ? out.innerText.trim().slice(0, 120) : "",
            altura: iframe ? iframe.getBoundingClientRect().height : 0
          };
        }, i);
        rodadas++;
        if (!estado.temIframe) problemas.push("caixa " + (i + 1) + ": o Rodar não criou o iframe do resultado");
        else if (!estado.html) problemas.push("caixa " + (i + 1) + ": o componente montou vazio (saída: " + estado.out + ")");
        else if (estado.altura < 40) problemas.push("caixa " + (i + 1) + ": o iframe ficou com " + Math.round(estado.altura) + " px de altura");
        // meta que PEDE erro (data-goal com "erro:") quebra o componente de propósito: o erro
        // de console daí é o conteúdo da aula, não defeito da página
        const pedeErro = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          return /(^|;;)\s*erro:/.test(c.getAttribute("data-goal") || "");
        }, i);
        if (pedeErro) erros.length = antes;
      }
      // Verificar em todas: aqui só conferimos que o botão responde
      for (let i = 0; i < info.caixas; i++) {
        const antesV = erros.length;
        const pedeErroV = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          return /(^|;;)\s*erro:/.test(c.getAttribute("data-goal") || "");
        }, i);
        const respondeu = await pg.evaluate((ix) => {
          const c = document.querySelectorAll(".trysvelte")[ix];
          const b = c.querySelectorAll(".try-bar button")[1];
          if (!b) return null;
          b.click();
          return true;
        }, i);
        if (!respondeu) continue;
        let st = "";
        for (let tentativa = 0; tentativa < 15 && !st; tentativa++) {
          await dormir(200);
          st = await pg.evaluate((ix) => {
            const c = document.querySelectorAll(".trysvelte")[ix];
            const s = c.querySelector(".try-status");
            return s ? s.innerText.trim() : "";
          }, i);
        }
        if (!st) problemas.push("caixa " + (i + 1) + ": o Verificar não escreveu status");
        else verificadas++;
        if (pedeErroV) erros.length = antesV;
      }
      dentroDasCaixas = false;
    }

    // celular: 375 px, sem rolagem horizontal
    await pg.setViewport({ width: 375, height: 812 });
    await dormir(150);
    const celular = await pg.evaluate(() => {
      const de = document.documentElement;
      const rolaSozinho = (e) => {
        for (let p = e.parentElement; p; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === "auto" || ov === "scroll") return true;
        }
        return false;
      };
      const largos = Array.from(document.querySelectorAll("body *")).filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.right > window.innerWidth + 1 && !rolaSozinho(e);
      }).slice(0, 3).map((e) => {
        const cls = typeof e.className === "string" && e.className ? "." + e.className.split(/\s+/)[0] : "";
        return e.tagName.toLowerCase() + cls;
      });
      return { rolagem: de.scrollWidth, janela: window.innerWidth, largos };
    });
    if (celular.rolagem > celular.janela + 1)
      problemas.push("rolagem horizontal em 375 px: a página mede " + celular.rolagem + " px (janela " + celular.janela +
        " px)" + (celular.largos.length ? " — passam da borda: " + celular.largos.join(", ") : ""));

    if (fotos) {
      const nomeArq = path.basename(nomePag).replace(/\.html?$/i, "");
      await pg.setViewport({ width: largura, height: 900 });
      await pg.evaluate(() => window.scrollTo(0, 0));
      await pg.screenshot({ path: path.join(fotos, nomeArq + ".png"), fullPage: true });
      await pg.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await dormir(80);
      await pg.screenshot({ path: path.join(fotos, nomeArq + "-escuro.png"), fullPage: true });
      await pg.evaluate(() => document.documentElement.removeAttribute("data-theme"));
    }

    // a página pode pedir um erro de propósito: data-goal="erro:<trecho>"
    const trechos = Array.from(new Set((await pg.evaluate(() => Array.from(document.querySelectorAll(".trysvelte[data-goal]"))
      .map((c) => c.getAttribute("data-goal").split(";;").map((p) => p.trim()).filter((p) => p.indexOf("erro:") === 0).map((p) => p.slice(5).trim()))
      .flat().filter(Boolean)))));
    const pretendido = (msg) => trechos.some((t) => msg.indexOf(t) !== -1);
    erros.filter((e) => !pretendido(e)).slice(0, 6).forEach((e) => problemas.push(e));
    notas.push("caixas=" + info.caixas + ", Rodar " + rodadas + ", Verificar " + verificadas + (comMeta ? "/" + comMeta : "") +
      ", menu=" + info.menu + "/" + esperado + ", 375 px " + (celular.rolagem > celular.janela + 1 ? "ROLANDO" : "ok"));
    return { problemas, notas, ms: Date.now() - t0 };
  } finally {
    pg.off("pageerror", aoErro);
    pg.off("console", aoConsole);
  }
}

(async () => {
  const pup = acharPuppeteer();
  if (!pup) { console.error("não achei o puppeteer-core (use NODE_PATH=/caminho/node_modules)"); process.exit(2); }
  const NIVEIS = N.lerNiveis();
  const esperado = NIVEIS ? NIVEIS.size : 0;
  if (!esperado) console.error("aviso: não consegui ler a NIVEIS; o menu não será conferido");
  if (fotos) fs.mkdirSync(fotos, { recursive: true });

  const { servidor, porta } = await subirServidor();
  const navegador = await pup.launch({ executablePath: acharChrome(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const pg = await navegador.newPage();
  console.log("servindo " + RAIZ + " em http://127.0.0.1:" + porta);
  console.log("menu esperado: " + esperado + " links (NIVEIS de assets/site.js)\n");

  let ruins = 0;
  const listaRuins = [];
  for (const p of paginas) {
    const arq = path.join(RAIZ, p);
    if (!fs.existsSync(arq)) { console.error("não achei: " + p); continue; }
    const url = "http://127.0.0.1:" + porta + "/" + p;
    let r;
    try {
      r = await testarPagina(pg, url, p, esperado);
    } catch (e) {
      r = { problemas: ["o testador quebrou: " + e.message], notas: ["(nada)"], ms: 0 };
    }
    if (r.problemas.length) {
      ruins++;
      listaRuins.push(p);
      console.log("✗ " + p + "  (" + (r.ms / 1000).toFixed(1) + " s)");
      r.problemas.slice(0, 8).forEach((m) => console.log("    " + m));
    } else {
      console.log("✓ " + p + "  " + r.notas[0] + "  (" + (r.ms / 1000).toFixed(1) + " s)");
    }
  }

  console.log("\n" + paginas.length + " página(s), " + ruins + " com problema" + (ruins ? "" : "") + ".");
  if (ruins) console.log("com problema: " + listaRuins.join(", "));
  await navegador.close();
  servidor.close();
  process.exit(ruins ? 1 : 0);
})().catch((e) => { console.error("erro fatal:", e); process.exit(2); });
