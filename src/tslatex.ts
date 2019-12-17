import ts from "typescript";
export function convertString(writer: TexWriter, fileContent: string) {
    const output: string[] = [];
    const options = {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2015,
        strict: true,
        suppressOutputPathCheck: false,
    };
    const file = {
        fileName: "test.ts",
        content: fileContent,
        sourceFile: undefined as ts.SourceFile | undefined,
    };
    ts.sys = {
        args: [],
        newLine: "\n",
        useCaseSensitiveFileNames: true,
        write(s: string): void { },
        readFile(path: string, encoding?: string): string | undefined { return undefined },
        writeFile(path: string, data: string, writeByteOrderMark?: boolean): void { },
        resolvePath(path: string): string { return path },
        fileExists(path: string): boolean { return false },
        directoryExists(path: string): boolean { return false },
        createDirectory(path: string): void { return },
        getExecutingFilePath(): string { return "" },
        getCurrentDirectory(): string { return "" },
        getDirectories(path: string): string[] { return [] },
        readDirectory(path: string, extensions?: readonly string[], exclude?: readonly string[], include?: readonly string[], depth?: number): string[] { return [] },

        exit(exitCode?: number): void { }

    }
    ts.createCompilerHost(options)
    const compilerHost = ts.createCompilerHost(options);
    const originalGetSourceFile = compilerHost.getSourceFile;
    compilerHost.getSourceFile = (fileName) => {
        if (fileName === file.fileName) {
            file.sourceFile = file.sourceFile ||
                ts.createSourceFile(fileName, file.content, ts.ScriptTarget.ES2015, true);
            return file.sourceFile;
        } else { return originalGetSourceFile.call(compilerHost, fileName, ts.ScriptTarget.ES2017); }
    };
    compilerHost.writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => { return; };

    function isNodeExported(node: ts.Node) {
        return (
            (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
        );
    }
    const visit = (node: ts.Node) => {
        if (!isNodeExported(node)) {
            return;
        }
        if (ts.isFunctionDeclaration(node) && node.name) {
            const symbol = checker.getSymbolAtLocation(node.name)!;
            const formatter = new FunctionFormatter(writer, node, checker, symbol);
            formatter.visitRoot(node);
            formatter.end();
        }
    };

    const program = ts.createProgram([file.fileName], options, compilerHost);
    const checker = program.getTypeChecker();
    for (const sourceFile of program.getSourceFiles()) {
        if (!sourceFile.isDeclarationFile) {
            ts.forEachChild(sourceFile, visit);
        }
    }
}

export class TexWriter {
    public buffer: string;
    public indentation: number;
    public prefix: string;
    constructor() {
        this.buffer = "";
        this.indentation = 0;
        this.prefix = "";
    }
    public writeLine(str: string) {
        this.buffer += "\n" + this.prefix + str;
    }
    public write(str: string) {
        this.buffer += str;
    }
    public indent() {
        this.indentation += 1;
        this.recalcPrefix();
    }
    public dedent() {
        this.indentation -= 1;
        this.recalcPrefix();
    }
    public recalcPrefix() {
        this.prefix = "";
        for (let i = 0; i < this.indentation; i++) {
            this.prefix += "  ";
        }
    }
}

class FunctionFormatter {
    public functionNode: ts.SignatureDeclaration;
    public symbol: ts.Symbol;
    public checker: ts.TypeChecker;

    public writer: TexWriter;
    constructor(writer: TexWriter, node: ts.FunctionDeclaration, checker: ts.TypeChecker, symbol: ts.Symbol) {
        this.writer = writer;
        this.symbol = symbol;
        this.functionNode = node;
        this.checker = checker;
        const signature = checker.getTypeAtLocation(node).getCallSignatures()[0];
        this.emitLine(`\\Procedure{${symbol.getName()}}`)
        this.emit("{$ ");
        for (const parameter of signature.getParameters()) {
            const parameterDocumentation = ts.displayPartsToString(parameter.getDocumentationComment(checker));
            const parameterType = checker.typeToString(checker.getTypeOfSymbolAtLocation(parameter, node));
            if (parameterType !== "any") {
                if (parameterDocumentation !== "") {
                    this.emit(`${parameterDocumentation}: ${parameterType}`);
                } else {
                    this.emit(`${parameter.name}: ${parameterType}`);
                }
            } else {
                if (parameterDocumentation !== "") {
                    this.emit(`${parameterDocumentation}`);
                } else {
                    this.emit(`${parameter.name}`);
                }
            }
        }
        this.emit("$}");
        const returnType = checker.typeToString(signature.getReturnType());
    }
    public end() {
        this.emitLine("\\EndProcedure")
    }
    public emit(str: string) {
        this.writer.write(str);
    }
    public emitLine(str: string) {
        this.writer.writeLine(str);
    }
    public visitRoot(node: ts.SignatureDeclaration) {
        this.writer.indent();
        node.forEachChild((child) => {
            if (ts.isBlock(child)) {
                this.visit(child);
            }
        });
        this.writer.dedent();
    }
    public visit(node: ts.Node, newline: boolean = true) {
        if (ts.isReturnStatement(node)) {
            const expression = node.expression;
            if (expression === undefined) {
                this.emitLine(`\\Return`);
            } else {
                this.emitLine(`\\Return{$${this.stringifyExpressionInMathContext(expression)}$}`);
            }
        } else if (ts.isBlock(node)) {
            node.forEachChild((n) => this.visit(n));
        } else if (ts.isForStatement(node)) {
            let { initializer, condition, incrementor } = node;
            if (initializer !== undefined && condition !== undefined && incrementor !== undefined) {
                let init = initializer;
                if (ts.isVariableDeclarationList(initializer) && initializer.declarations.length === 1) {
                    init = initializer.declarations[0].initializer as ts.Expression;
                    let v = initializer.declarations[0].name;
                    if (ts.isNumericLiteral(init)) {
                        if (ts.isIdentifier(v)
                            && ts.isBinaryExpression(condition)
                            && condition.operatorToken.getText() === "<"
                            && ts.isIdentifier(condition.left)
                            && condition.left.text === v.text) {
                            if (ts.isPostfixUnaryExpression(incrementor)
                                && ts.isIdentifier(incrementor.operand)
                                && incrementor.operator === ts.SyntaxKind.PlusPlusToken
                                && incrementor.operand.text === v.text) {
                                let start = parseFloat(init.text);
                                let end = this.stringifyExpressionInMathContext(condition.right)
                                this.emit(`\\For{$${v.text} \\gets ${start}$ to $${end} - 1$}`);
                                this.writer.indent();
                                this.visit(node.statement);
                                this.writer.dedent()
                                this.emitLine(`\\EndFor`);
                                return;
                            }
                        }
                    }
                }
                /*
                if (ts.isExpressionStatement(init)
                    && ts.isBinaryExpression(init.expression)
                    && init.expression.operatorToken.getText() === "="
                    && ts.isNumericLiteral(init.expression.right)) {
                    let v = init.expression.left;
                    if (ts.isIdentifier(v)
                        && ts.isBinaryExpression(condition)
                        && ts.isIdentifier(condition.left)
                        && condition.left.text === v.text) {
                        if (ts.isPostfixUnaryExpression(incrementor)
                            && ts.isIdentifier(incrementor.operand)
                            && incrementor.operator === ts.SyntaxKind.PlusPlusToken
                            && incrementor.operand.text === v.text) {
                        }
                    }
                }
                */

            }
            this.emit(`\\For{`);
            if (initializer !== undefined) {
                this.visit(initializer, false);
            }
            this.emit(" $;\\,\\,$ ");
            if (condition !== undefined) {
                this.emit(`$${this.stringifyExpressionInMathContext(condition)}$`);
            }
            this.emit(" $;\\,\\,$ ");
            if (incrementor !== undefined) {
                this.emit(`$${this.stringifyExpressionInMathContext(incrementor)}$`);
            }
            this.emitLine("}");
            this.writer.indent();
            this.visit(node.statement);
            this.writer.dedent();
            this.emitLine(`\\EndFor`);
        } else if (ts.isVariableDeclaration(node)) {
            const val = node.initializer;
            if (val === undefined) {
                return;
            }
            if (newline) {
                this.emitLine(`\\State $\\text{${node.name.getText()}} \\gets ${this.stringifyExpressionInMathContext(val)}$`);
            } else {
                this.emitLine(`$\\text{${node.name.getText()}} \\gets ${this.stringifyExpressionInMathContext(val)}$`);
            }

        } else if (ts.isVariableStatement(node)) {
            this.visit(node.declarationList, newline);
        } else if (ts.isVariableDeclarationList(node)) {
            for (const decl of node.declarations) {
                this.visit(decl, newline);
            }
        } else if (ts.isWhileStatement(node)) {
            this.emitLine(`\\While{$${this.stringifyExpressionInMathContext(node.expression)}$}`);
            this.writer.indent();
            this.visit(node.statement);
            this.writer.dedent();
            this.emitLine(`\\EndWhile`);
        } else if (ts.isDoStatement(node)) {
            this.emitLine(`\\DoWhile`);
            this.writer.indent();
            this.visit(node.statement);
            this.writer.dedent();
            this.emitLine(`\\Condition{$${this.stringifyExpressionInMathContext(node.expression)}$}`);
        } else if (ts.isExpressionStatement(node)) {
            if (newline) {
                this.emitLine(`\\State $${this.stringifyExpressionInMathContext(node.expression)}$`);
            } else {
                this.emit(`$${this.stringifyExpressionInMathContext(node.expression)}$`);
            }
        } else if (ts.isIfStatement(node)) {
            this.emitLine(`\\If{$${this.stringifyExpressionInMathContext(node.expression)}$}`);
            this.writer.indent();
            this.visit(node.thenStatement);
            this.writer.dedent();
            this.emitLine(`\\EndIf`);
        } else {
            node.forEachChild((child) => this.visit(child));
        }
    }
    public stringifyExpressionInMathContext(node: ts.Expression): string {
        if (ts.isNumericLiteral(node)) {
            return node.getText();
        } else if (ts.isBinaryExpression(node)) {
            const l = this.stringifyExpressionInMathContext(node.left);
            const r = this.stringifyExpressionInMathContext(node.right);
            const op = node.operatorToken;
            const opName = op.getText();
            if (opName === "+") {
                return `${l} + ${r}`;
            } else if (opName === "-") {
                return `${l} - ${r}`;
            } else if (opName === "*") {
                return `${l} \\cdot ${r}`;
            } else if (opName === "/") {
                return `\\frac{${l}}{${r}}`;
            } else if (opName === "^") {
                return `{${l}} \\wedge {${r}}`;
            } else if (opName === "==") {
                return `${l} = ${r}`;
            } else if (opName === "===") {
                return `${l} = ${r}`;
            } else if (opName === "!=") {
                return `${l} \\neq ${r}`;
            } else if (opName === "!==") {
                return `${l} \\neq ${r}`;
            } else if (opName === "=") {
                return `{${l}} \\gets {${r}}`;
            } else if (opName === "<") {
                return `{${l}} < {${r}}`;
            } else if (opName === ">") {
                return `{${l}} > {${r}}`;
            } else if (opName === "<=") {
                return `{${l}} \\leq {${r}}`;
            } else if (opName === ">=") {
                return `{${l}} \\geq {${r}}`;
            } else if (opName === "&&") {
                return `{${l}} \\land {${r}}`;
            } else if (opName === "||") {
                return `{${l}} \\lor {${r}}`;
            } else if (opName === "+=") {
                return `{${l}} \\gets {${l}} + {${r}}`;
            } else if (opName === "-=") {
                return `{${l}} \\gets {${l}} - {${r}}`;
            } else if (opName === "|") {
                if (ts.isNumericLiteral(node.right) && parseInt(node.right.text) === 0) {
                    return `\\lfloor${l}\\rfloor`;
                }
                return `{${l}} \\mathbin{|} {${r}}`;
            }
            return `{${l}} ${opName} {${r}}`;
        } else if (ts.isStringLiteral(node)) {
            return "\"" + node.text + "\"";
        } else if (ts.isIdentifier(node)) {
            return `\\text{${node.text}}`;
        } else if (ts.isCallExpression(node)) {
            const argStrings = node.arguments.map((arg) => this.stringifyExpressionInMathContext(arg));
            if (ts.isIdentifier(node.expression)) {
                if (node.expression.text === "union" && argStrings.length === 2) {
                    return `${argStrings[0]} \\cup ${argStrings[1]}`
                }
                if (node.expression.text === "intersection" && argStrings.length === 2) {
                    return `${argStrings[0]} \\cap ${argStrings[1]}`
                }
                if (node.expression.text === "setminus" && argStrings.length === 2) {
                    return `${argStrings[0]} \\setminus ${argStrings[1]}`
                }
            }
            if (ts.isIdentifier(node.expression)) {
                return `\\texttt{${node.expression.text}}\\left(${argStrings.join(", ")}\\right)`;
            }
            if (ts.isPropertyAccessExpression(node.expression)
                && ts.isIdentifier(node.expression.expression)
                && node.expression.expression.text === "Math") {
                if (node.expression.name.text === "floor") {
                    return `\\lfloor${argStrings.join(", ")}\\rfloor`;
                }
                if (node.expression.name.text === "ceil") {
                    return `\\lceil${argStrings.join(", ")}\\rceil`;
                }
                if (node.expression.name.text === "pow") {
                    return `{${argStrings[0]}}^{${argStrings[1]}}`;
                }
            }
            if (ts.isPropertyAccessExpression(node.expression)) {
                if (node.expression.name.text === "size") {
                    return `\\lvert${this.stringifyExpressionInMathContext(node.expression.expression)}\\rvert`;
                }
            }
            const lhs = this.stringifyExpressionInMathContext(node.expression);
            return `${lhs} \\left(${argStrings.join(", ")}\\right)`;
        } else if (ts.isPostfixUnaryExpression(node)) {
            const o = this.stringifyExpressionInMathContext(node.operand);
            if (node.operator === ts.SyntaxKind.PlusPlusToken) {
                return `${o}{\\scriptsize \\text{++}}`;
            } else {
                return `${o}{\\scriptsize \\text{--}}`;
            }
        } else if (ts.isPrefixUnaryExpression(node)) {
            const o = this.stringifyExpressionInMathContext(node.operand);
            if (node.operator === ts.SyntaxKind.ExclamationToken) {
                return `\\lnot${o}`;
            } else {
                return `not supported`;
            }
        } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
            return "\\textbf{true}";
        } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
            return "\\textbf{false}";
        } else if (ts.isElementAccessExpression(node)) {
            return `${this.stringifyExpressionInMathContext(node.expression)}\\left[${this.stringifyExpressionInMathContext(node.argumentExpression)}\\right]`;
        } else if (ts.isPropertyAccessExpression(node)) {
            if (node.name.text === "length") {
                return `\\lvert${this.stringifyExpressionInMathContext(node.expression)}\\rvert`;
            }
            return `${this.stringifyExpressionInMathContext(node.expression)}.${node.name.text}`;
        } else if (ts.isParenthesizedExpression(node)) {
            return `\\left(${this.stringifyExpressionInMathContext(node.expression)}\\right)`;
        } else if (ts.isNewExpression(node)) {
            let args = node.arguments;
            const argStrings = args === undefined ? [] : args.map((arg) => this.stringifyExpressionInMathContext(arg));
            if (ts.isIdentifier(node.expression)) {
                if (node.expression.text === "Set" && argStrings.length === 0) {
                    return "\\emptyset";
                }
            }
            return `\\textbf{new}\\;${this.stringifyExpressionInMathContext(node.expression)}\\left(${argStrings.join(", ")}\\right)`
        }
        return `${node.getText().replace(/\(/g, "\\left(").replace(/\)/g, "\\right)").replace(/\{/g, "\\left\\{").replace(/\}/g, "\\right\\}")}`;
    }
}