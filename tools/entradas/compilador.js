// entrada do compilador para o navegador — vira assets/svelte-compiler.js
// (node tools/empacotar.js --gerar)
import { compile, compileModule, parse, walk, VERSION } from 'svelte/compiler';

export { compile, compileModule, parse, walk, VERSION };
