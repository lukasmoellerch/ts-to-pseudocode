# Pseudo Editor
A small tool that tries to convert typescript (or javascript) into equivalent pseudocode.

Demo: [https://pseudocode.lukas-moeller.ch](https://pseudocode.lukas-moeller.ch)

## Features
Only exported functions are converted.

- `x | 0`
- `Math.floor(x)`
- `Math.ceil(x)`
- `new Set()`
- `x.length`
- `x.size`
- `union(a, b)`
- `setminus(a, b)`
- `for(var i = 0; i < x; i++) {}`
- Mathematical operators are converted accordingly (+, -, *, /, &&, ||, !, ^)
	- All divisions are converted into fractions
- 

## Dependencies
Awesome projects this editor depends on:
- [Typescript Compiler](https://www.typescriptlang.org)
- [Pseudocode.js](http://www.tatetian.io/pseudocode.js/)
- [KaTeX](https://katex.org)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)