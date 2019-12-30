import { katex } from "katex";
import * as monaco from 'monaco-editor';
import * as pseudo from "pseudocode";
import Split from 'split.js';
import "./styles.css";
import { convertString, TexWriter } from "./tslatex";

// @ts-ignore
window.katex = katex;

const editor = monaco.editor.create(document.getElementById('container'), {
  value: localStorage.getItem("value") || `export function leftIndex(index) {
    return ((index + 1) * 2 | 0) - 1;
}
export function rightIndex(index) {
    return (index + 1) * 2 | 0;
}
export function parentIndex(index) {
    return ((index + 1) / 2) - 1;
}
export function isMaxHeap(array) {
    for (let i = 0; i < array.length; i++) {
        let val = array[i];
        let li = leftIndex(i);
        if (li < array.length && array[li] > val) {
            return false;
        }

        let ri = rightIndex(i);
        if (ri < array.length && array[ri] > val) {
            return false;
        }
    }
    return true;
}
export function roundDown(value) {
    return Math.floor(value);
}
export function roundUp(value) {
    return Math.ceil(value);
}
declare function union(a, b);
export function sets() {
    let a = new Set()
    let n = union(a, a);
    return Math.pow(n.size(), 2) ^ 2;
}
export function bubbleSort(A) {
    let swapped = false;
    do {
        swapped = false;
        for (var i = 1; i < A.length; i++) {
            if (A[i - 1] != A[i]) {
                var b = A[i];
                A[i] = A[i - 1];
                A[i - 1] = b;
                swapped = true;
            }
        }
    }
    while (swapped)
}
export function maxSubArraySummax(array) {
    let max = 0;
    let rmax = 0;
    for (let i = 0; i < array.length; i++) {
        rmax = rmax + array[i];
        if (rmax > max) {
            max = rmax;
        }
        if (rmax < 0) {
            rmax = 0
        }
    }
    return max;
}`,
  language: 'typescript',
  theme: 'vs-dark',
  automaticLayout: true,
});
const mode = document.getElementById("mode");
let currentModeIndex = parseInt(localStorage.getItem("index")) || 0;
const modes = ["latex", "rendered"];
const languageMap = {
  latex: "css",
  rendered: "raw"
}
document.getElementById("b").classList.add(languageMap[modes[currentModeIndex]]);

const debounce = (func, delay) => {
  let inDebounce
  return function () {
    const context = this
    const args = arguments
    clearTimeout(inDebounce)
    inDebounce = setTimeout(() => func.apply(context, args), delay)
  }
}
function modeStringUpdate() {
  mode.innerText = modes[currentModeIndex];
  forceCompile()
}
mode.addEventListener("click", () => {
  document.getElementById("b").classList.remove(languageMap[modes[currentModeIndex]]);
  currentModeIndex++;
  currentModeIndex = currentModeIndex % modes.length;
  localStorage.setItem("index", currentModeIndex + "");
  modeStringUpdate();
  document.getElementById("b").classList.add(languageMap[modes[currentModeIndex]]);
})
editor.getModel().onDidChangeContent((event) => {
  compile()
});
function forceCompile() {
  try {
    let writer = new TexWriter()
    const content = editor.getModel().getValue();
    localStorage.setItem("value", content);

    writer.writeLine("\\begin{algorithm}");
    writer.indent();
    writer.writeLine("\\begin{algorithmic}");
    writer.indent();
    convertString(writer, content)
    writer.dedent();
    writer.writeLine("\\end{algorithmic}");
    writer.dedent();
    writer.writeLine("\\end{algorithm}");


    const lang = languageMap[modes[currentModeIndex]];
    if (modes[currentModeIndex] === "rendered") {
      var options = {
        lineNumber: true,
      };
      let code = pseudo.renderToString(writer.buffer, options);
      document.getElementById("b").innerHTML = code;
    } else {
      monaco.editor.colorize(`\\algdef{SE}[DOWHILE]{DoWhile}{Condition}{\\algorithmicdo}[1]{\\algorithmicwhile\\ #1}
      ${writer.buffer}`, lang, {})
        .then(html =>
          document.getElementById("b").innerHTML = html
        );
    }
  } catch (e) {
    document.getElementById("b").innerHTML = e.toString();
  }
}
const compile = debounce(forceCompile, 500);
Split(['#a', '#b'], {
  direction: 'horizontal',
  gutterSize: 1,
  cursor: 'col-resize'
})
modeStringUpdate();