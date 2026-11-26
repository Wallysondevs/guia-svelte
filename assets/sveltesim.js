/* =============================================================================
   assets/sveltesim.js — a caixa "Experimente" do Guia Svelte

   Não é simulação: este arquivo carrega o COMPILADOR de verdade
   (assets/svelte-compiler.js, svelte@5.59.2 empacotado) e o RUNTIME de verdade
   (assets/svelte-motor.js). O componente é compilado na hora, montado dentro de
   um iframe isolado e fica reativo — clique à vontade.

   Meta da caixa, no atributo data-goal, com passos separados por ";;":
     out:<texto>        o texto que aparece na tela é exatamente este
     outre:<regex>      o texto casa com esta expressão regular
     html:<html>        o HTML gerado é exatamente este
     erro:<trecho>      o compilador recusa o código com uma mensagem que contém o trecho
     clique:<seletor>   clica no elemento (dentro do componente)
     digitar:<seletor>=<valor>  escreve no campo e dispara input
     depois:<ms>        espera (para promessas e transições)

   Exemplos reais:
     data-goal="out:Cliques: 0"
     data-goal="clique:button;;clique:button;;out:Cliques: 2"
     data-goal="digitar:input=Ana;;out:Olá, Ana"
     data-goal="erro:Expected }"

   O mesmo avaliador roda no testador (tools/testar-missoes.js), então a meta que
   passa no navegador é a meta que a página promete.
   ============================================================================= */
(function () {
  "use strict";

  var COMPILADOR = "assets/svelte-compiler.js";
  var MOTOR = "assets/svelte-motor.js";
  var base = (function () {
    // assets/sveltesim.js -> raiz do site
    var s = document.currentScript && document.currentScript.src;
    if (!s) return "";
    return s.replace(/assets\/sveltesim\.js.*$/, "");
  })();

  var compiladorPromessa = null;
  function carregarCompilador() {
    if (!compiladorPromessa) {
      compiladorPromessa = import(base + COMPILADOR);
    }
    return compiladorPromessa;
  }

  function normalizarTexto(t) {
    return String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  }

  /* ---------------------------------------------------------------- compilar */

  function reescreverImports(codigo) {
    var motor = new URL(base + MOTOR, location.href).href;
    return codigo.replace(/(['"])svelte(\/[^'"]*)?\1/g, "'" + motor + "'");
  }

  /* Compila e monta num iframe novo. Devolve {pronto, html, texto, erro, doc, janela}. */
  function montar(comp, codigo, opcoes) {
    opcoes = opcoes || {};
    var alvo = opcoes.alvo || document.createElement("div");
    if (!alvo.parentNode) {
      // fora da tela, mas DENTRO do documento: iframe solto não carrega
      alvo.style.cssText = "position:fixed;left:-9999px;top:0;width:340px;height:120px;overflow:hidden";
      document.body.appendChild(alvo);
    }
    alvo.innerHTML = "";
    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "resultado do componente");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    alvo.appendChild(iframe);

    var compilado;
    try {
      compilado = comp(codigo, { generate: "client", dev: false, filename: "App.svelte" });
    } catch (e) {
      return Promise.resolve({
        erro: mensagemDeErro(e),
        html: "",
        texto: "",
        doc: null,
        elem: alvo,
        destruir: function () {}
      });
    }

    var js = reescreverImports(compilado.js.code);
    var cartaoCss = "";
    try {
      compilado.css && compilado.css.code && (cartaoCss = compilado.css.code);
    } catch (e) {
      cartaoCss = "";
    }

    var motorUrl = new URL(base + MOTOR, location.href).href;
    var blob = URL.createObjectURL(new Blob([js], { type: "text/javascript" }));
    var html =
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      "<style>html,body{margin:0;padding:12px;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111;background:#fff}" +
      "body{overflow-wrap:anywhere}button,input,select,textarea{font:inherit}" +
      cartaoCss +
      "</style></head><body><div id=\"app\"></div>" +
      '<script type="module">' +
      'import { mount } from ' + JSON.stringify(motorUrl) + ";\n" +
      "import Comp from " + JSON.stringify(blob) + ";\n" +
      "try {\n" +
      "  mount(Comp, { target: document.getElementById('app'), props: " + JSON.stringify(opcoes.props || {}) + " });\n" +
      "  requestAnimationFrame(() => requestAnimationFrame(() => parent.postMessage({ tipo: 'svelte-pronto' }, '*')));\n" +
      "} catch (e) { parent.postMessage({ tipo: 'svelte-erro', msg: String(e && e.message || e) }, '*'); }\n" +
      "window.addEventListener('error', (e) => parent.postMessage({ tipo: 'svelte-erro', msg: String(e.message || e) }, '*'));\n" +
      "window.addEventListener('unhandledrejection', (e) => parent.postMessage({ tipo: 'svelte-erro', msg: String((e.reason && e.reason.message) || e.reason) }, '*'));\n" +
      "</script></body></html>";

    return new Promise(function (resolve) {
      var terminado = false;
      var erroRuntime = null;

      function aoReceber(ev) {
        if (ev.source !== iframe.contentWindow) return;
        var d = ev.data || {};
        if (d.tipo === "svelte-erro" && !erroRuntime) erroRuntime = String(d.msg || "erro");
        if (d.tipo === "svelte-pronto") finalizar();
        if (d.tipo === "svelte-erro") setTimeout(finalizar, 30);
      }
      window.addEventListener("message", aoReceber);

      function finalizar() {
        if (terminado) return;
        terminado = true;
        window.removeEventListener("message", aoReceber);
        var doc = null;
        try {
          doc = iframe.contentDocument;
        } catch (e) {
          doc = null;
        }
        if (!doc) {
          resolve({ erro: "não consegui abrir o resultado (iframe fora do documento?)", html: "", texto: "", doc: null, elem: alvo, destruir: function () {} });
          return;
        }
        // componente que quebrou é parado: um laço de efeito infinito queimaria a máquina do leitor
        if (erroRuntime) {
          try {
            iframe.srcdoc = "<!doctype html><meta charset='utf-8'><body style=\"margin:0;padding:12px;font:14px/1.5 system-ui;color:#b42318\">componente parado: o erro acima interrompeu a execução.</body>";
          } catch (e) {}
        }
        ajustarAltura();
        resolve({
          erro: erroRuntime,
          html: doc.getElementById("app") ? doc.getElementById("app").innerHTML : "",
          texto: normalizarTexto(doc.body ? doc.body.innerText : ""),
          doc: doc,
          elem: alvo,
          destruir: function () {
            try { URL.revokeObjectURL(blob); } catch (e) {}
            try { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch (e) {}
          }
        });
      }

      function ajustarAltura() {
        try {
          var d = iframe.contentDocument;
          var h = Math.max(90, Math.min(640, d.documentElement.scrollHeight + 2));
          iframe.style.height = h + "px";
        } catch (e) {
          iframe.style.height = "120px";
        }
      }

      iframe.srcdoc = html;
      setTimeout(function () {
        if (!terminado) {
          if (!erroRuntime) erroRuntime = "o componente não terminou de montar";
          finalizar();
        }
      }, opcoes.limite || 4000);
    });
  }

  function mensagemDeErro(e) {
    if (!e) return "erro desconhecido";
    if (e.name === "CompileError" || /svelte/i.test(String(e.name || ""))) {
      var cab = "Erro de compilação";
      var pos = "";
      if (e.start && typeof e.start.line === "number") pos = " (linha " + e.start.line + ", coluna " + e.start.column + ")";
      // o compilador anexa a URL da documentação na mesma mensagem; a aula não precisa dela
      var msg = String(e.message || e).split("\n")[0].trim();
      return cab + pos + ": " + msg;
    }
    return (e.name ? e.name + ": " : "") + (e.message || String(e));
  }

  /* ------------------------------------------------------------------- metas */

  /* devolve null quando bate, ou o motivo da falha */
  async function rodarMeta(resultado, meta, opcoes) {
    var passos = String(meta || "").split(";;").map(function (p) { return p.trim(); }).filter(Boolean);
    if (!passos.length) return null;
    var i;

    // erro esperado: olha a mensagem antes de tudo
    var passoErro = passos.find(function (p) { return p.indexOf("erro:") === 0; });
    if (passoErro) {
      var trecho = passoErro.slice(5);
      var msg = resultado.erro || "";
      if (!msg) return "o código compilou; eu esperava a mensagem contendo \"" + trecho + "\"";
      if (msg.indexOf(trecho) === -1) return "a mensagem foi \"" + msg.slice(0, 200) + "\", que não contém \"" + trecho + "\"";
      return null;
    }
    if (resultado.erro) return "o componente quebrou: " + resultado.erro;
    if (!resultado.doc) return "o componente não montou";

    for (i = 0; i < passos.length; i++) {
      var p = passos[i];
      if (p.indexOf("out:") === 0) {
        var esperado = normalizarTexto(p.slice(4));
        var obtido = normalizarTexto(resultado.doc.body.innerText);
        if (obtido !== esperado)
          return "esperava o texto \"" + esperado + "\", veio \"" + (obtido.length > 200 ? obtido.slice(0, 200) + "…" : obtido) + "\"";
      } else if (p.indexOf("outre:") === 0) {
        var re;
        try {
          re = new RegExp(p.slice(6));
        } catch (e) {
          return "expressão regular inválida na meta: " + p.slice(6);
        }
        var txt = normalizarTexto(resultado.doc.body.innerText);
        if (!re.test(txt)) return "o texto não casa com /" + p.slice(6) + "/";
      } else if (p.indexOf("html:") === 0) {
        var alvo = normalizarHtml(p.slice(5));
        var tem = normalizarHtml(resultado.html);
        if (tem !== alvo) return "esperava o HTML \"" + alvo + "\", veio \"" + (tem.length > 200 ? tem.slice(0, 200) + "…" : tem) + "\"";
      } else if (p.indexOf("clique:") === 0) {
        var sel = p.slice(7);
        var el = resultado.doc.querySelector(sel);
        if (!el) return "não achei o elemento \"" + sel + "\" para clicar";
        el.click();
        await esperar(60);
      } else if (p.indexOf("digitar:") === 0) {
        var resto = p.slice(8);
        var corte = resto.indexOf("|");
        if (corte === -1) corte = resto.indexOf("=");
        var s2 = corte === -1 ? resto : resto.slice(0, corte);
        var valor = corte === -1 ? "" : resto.slice(corte + 1);
        var campo = resultado.doc.querySelector(s2);
        if (!campo) return "não achei o campo \"" + s2 + "\"";
        campo.focus();
        campo.value = valor;
        campo.dispatchEvent(new resultado.doc.defaultView.Event("input", { bubbles: true }));
        campo.dispatchEvent(new resultado.doc.defaultView.Event("change", { bubbles: true }));
        await esperar(60);
      } else if (p.indexOf("depois:") === 0) {
        await esperar(Number(p.slice(7)) || 100);
      } else {
        return "passo de meta que não conheço: \"" + p + "\"";
      }
    }
    return null;
  }

  function normalizarHtml(h) {
    return String(h == null ? "" : h).replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  }

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ---------------------------------------------------------------- a caixa */

  function criarBotoes(caixa) {
    var barra = caixa.querySelector(".try-bar");
    if (!barra) {
      barra = document.createElement("div");
      barra.className = "try-bar";
      var script = caixa.querySelector("pre.script");
      script.parentNode.insertBefore(barra, script.nextSibling);
    }
    return barra;
  }

  function garantirPecas(caixa) {
    var barra = criarBotoes(caixa);
    if (!barra.querySelector("button")) {
      ["Rodar", "Verificar", "Solução"].forEach(function (rotulo, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = rotulo;
        if (i > 0) b.className = "secondary";
        barra.appendChild(b);
      });
    }
    if (!caixa.querySelector(".try-status")) {
      var st = document.createElement("p");
      st.className = "try-status";
      st.setAttribute("role", "status");
      st.setAttribute("aria-live", "polite");
      barra.parentNode.insertBefore(st, barra.nextSibling);
    }
    if (!caixa.querySelector(".try-vivo")) {
      var vivo = document.createElement("div");
      vivo.className = "try-vivo";
      vivo.hidden = true;
      var out = caixa.querySelector(".try-out");
      caixa.insertBefore(vivo, out || null);
    }
    if (!caixa.querySelector(".try-out")) {
      var pre = document.createElement("pre");
      pre.className = "try-out";
      pre.hidden = true;
      caixa.appendChild(pre);
    }
    return {
      barra: barra,
      status: caixa.querySelector(".try-status"),
      vivo: caixa.querySelector(".try-vivo"),
      out: caixa.querySelector(".try-out")
    };
  }

  function lerCodigo(caixa) {
    var script = caixa.querySelector("pre.script");
    var texto = script.innerText.replace(/\u00a0/g, " ");
    return texto.replace(/\n+$/, "\n");
  }

  function prepararEdicao(script) {
    if (script.dataset.editavel === "1") return;
    script.dataset.editavel = "1";
    script.setAttribute("contenteditable", "true");
    script.setAttribute("spellcheck", "false");
    script.setAttribute("role", "textbox");
    script.setAttribute("aria-multiline", "true");
    script.setAttribute("aria-label", "código do componente, editável");
    script.addEventListener("keydown", function (ev) {
      if (ev.key === "Tab") {
        ev.preventDefault();
        document.execCommand("insertText", false, "  ");
      }
    });
    script.addEventListener("paste", function (ev) {
      ev.preventDefault();
      var t = (ev.clipboardData || window.clipboardData).getData("text");
      document.execCommand("insertText", false, t.replace(/\n+$/, ""));
    });
  }

  async function ligar(caixa, comp) {
    var pecas = garantirPecas(caixa);
    var script = caixa.querySelector("pre.script");
    var solucao = caixa.querySelector("pre.solucao");
    var meta = caixa.getAttribute("data-goal") || "";
    var atual = null;
    var ocupado = false;

    prepararEdicao(script);

    async function render(codigo, mostrarErroNoOut) {
      if (atual && atual.destruir) atual.destruir();
      pecas.out.hidden = false;
      pecas.out.textContent = "compilando…";
      var r = await montar(comp, codigo, { alvo: pecas.vivo });
      atual = r;
      pecas.vivo.hidden = false;
      if (r.erro) {
        pecas.out.innerHTML = "";
        var s = document.createElement("span");
        s.className = "m-err";
        s.textContent = r.erro;
        pecas.out.appendChild(s);
      } else if (r.html && r.html.trim()) {
        pecas.out.textContent = "HTML gerado:\n" + r.html;
      } else {
        pecas.out.innerHTML = '<span class="m-vazio">o componente não desenhou nada</span>';
      }
      return r;
    }

    async function rodar() {
      if (ocupado) return;
      ocupado = true;
      try {
        pecas.status.textContent = "";
        pecas.status.className = "try-status";
        await render(lerCodigo(caixa));
      } finally {
        ocupado = false;
      }
    }

    async function verificar() {
      if (ocupado) return;
      ocupado = true;
      try {
        var r = await render(lerCodigo(caixa));
        var falha = await rodarMeta(r, meta);
        if (falha) {
          pecas.status.textContent = "❌ Ainda não: " + falha;
          pecas.status.className = "try-status try-check falhou";
        } else {
          pecas.status.textContent = meta ? "✅ Meta cumprida." : "✅ O componente compila e roda.";
          pecas.status.className = "try-status try-check ok";
          var tarefa = caixa.querySelector(".try-task");
          if (tarefa) tarefa.classList.add("ok");
        }
      } finally {
        ocupado = false;
      }
    }

    async function mostrarSolucao() {
      if (!solucao) return;
      script.innerText = solucao.innerText.replace(/\u00a0/g, " ").replace(/\n+$/, "\n");
      await rodar();
    }

    var botoes = pecas.barra.querySelectorAll("button");
    botoes[0].addEventListener("click", rodar);
    if (botoes[1]) botoes[1].addEventListener("click", verificar);
    if (botoes[2]) {
      if (!solucao) botoes[2].style.display = "none";
      else botoes[2].addEventListener("click", mostrarSolucao);
    }

    // atalho para quem lê: Ctrl/Cmd + Enter roda
    script.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        rodar();
      }
    });
  }

  async function iniciar() {
    var caixas = Array.prototype.slice.call(document.querySelectorAll(".trysvelte"));
    if (!caixas.length) return;
    var comp;
    try {
      comp = (await carregarCompilador()).compile;
    } catch (e) {
      caixas.forEach(function (c) {
        var pecas = garantirPecas(c);
        pecas.status.textContent = "não consegui carregar o compilador do Svelte: " + e.message;
        pecas.status.className = "try-status try-check falhou";
      });
      return;
    }
    window.__svelteCompilar = comp;
    window.__sveltePronto = true;
    for (var i = 0; i < caixas.length; i++) await ligar(caixas[i], comp);
  }

  /* gancho usado pelo testador: compila, monta, roda a meta e devolve o resultado */
  window.__svelteAvaliar = async function (codigo, meta) {
    var comp = window.__svelteCompilar || (await carregarCompilador()).compile;
    window.__svelteCompilar = comp;
    var r = await montar(comp, codigo);
    var falha = await rodarMeta(r, meta);
    var resposta = {
      ok: !falha,
      motivo: falha,
      erro: r.erro || null,
      html: r.html,
      texto: r.texto
    };
    if (r.destruir) r.destruir();
    return resposta;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
