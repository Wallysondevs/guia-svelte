// entrada do módulo de stores para o navegador — vira assets/svelte-store.js
// (node tools/empacotar.js --gerar)
//
// Por que um arquivo separado: `svelte/store` exporta `derived` e `get`, e o
// `svelte/internal/client` exporta outros `derived` e `get` (as runas). Num módulo só, o
// `export *` dos dois deixa os dois nomes ambíguos e o componente compilado quebra com
// "$.get is not a function". Então a caixa resolve `svelte/store` para ESTE arquivo e
// todo o resto de `svelte/...` para o motor.
export * from 'svelte/store';
