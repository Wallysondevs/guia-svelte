// entrada do runtime para o navegador — vira assets/svelte-motor.js
// (node tools/empacotar.js --gerar)
//
// O código que o compilador gera importa de "svelte/internal/client" e também de
// "svelte/internal/flags/*", "svelte/internal/disclose-version", "svelte/internal/init-operations"
// e "svelte/legacy". Tudo isso precisa estar no MESMO módulo, senão a página tem duas cópias
// do estado reativo e o componente quebra com "Cannot read properties of undefined".
import 'svelte/internal/disclose-version';
import 'svelte/internal/init-operations';
import 'svelte/internal/flags/async';
import 'svelte/internal/flags/legacy';
import 'svelte/internal/flags/tracing';
import 'svelte/internal/flags/custom-renderer';

import {
  mount, unmount, hydrate, tick, flushSync, untrack,
  onMount, onDestroy, createEventDispatcher,
  getContext, setContext, hasContext, createRawSnippet
} from 'svelte';

export * from 'svelte/internal/client';
export * from 'svelte/legacy';

// módulos públicos que as aulas usam dentro da caixa: o avaliador troca qualquer
// import de "svelte/..." por este único módulo, então tudo precisa sair daqui
export * from 'svelte/transition';
export * from 'svelte/easing';
export * from 'svelte/motion';
export * from 'svelte/animate';

export {
  mount, unmount, hydrate, tick, flushSync, untrack,
  onMount, onDestroy, createEventDispatcher,
  getContext, setContext, hasContext, createRawSnippet
};
