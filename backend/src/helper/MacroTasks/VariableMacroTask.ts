import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getVariable, setVariable} from "../VariableHelper";
import {logRegular, logWarn} from "../LogHelper";

type Token =
    | { type: "number"; value: number }
    | { type: "string"; value: string }
    | { type: "literal"; value: any }
    | { type: "variable"; value: string }
    | { type: "operator"; value: string }
    | { type: "paren"; value: "(" | ")" };

function getPathValue(root: any, path: string): any {
    const parts = String(path)
        .trim()
        .split(".")
        .map(part => part.trim())
        .filter(Boolean);

    let value = root;

    for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        value = value[part];
    }

    return value;
}


function setPathValue(root: any, path: string, value: any) {
    const parts = String(path)
        .trim()
        .split('.')
        .map(part => part.trim())
        .filter(Boolean);

    if (!parts.length) return;

    let target = root;

    for (let index = 0; index < parts.length - 1; index++) {
        const part = parts[index];
        const current = target[part];

        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            target[part] = {};
        }

        target = target[part];
    }

    target[parts[parts.length - 1]] = value;
}

class LocalExpressionParser {
    private index = 0;

    constructor(
        private readonly tokens: Token[],
        private readonly variables: any,
    ) {}

    parse(): any {
        const value = this.parseOr();

        if (this.index !== this.tokens.length) {
            throw new Error(`unexpected token ${this.describe(this.tokens[this.index])}`);
        }

        return value;
    }

    private parseOr(): any {
        let left = this.parseAnd();

        while (this.matchOperator("||")) {
            const right = this.parseAnd();
            left = left || right;
        }

        return left;
    }

    private parseAnd(): any {
        let left = this.parseEquality();

        while (this.matchOperator("&&")) {
            const right = this.parseEquality();
            left = left && right;
        }

        return left;
    }

    private parseEquality(): any {
        let left = this.parseComparison();

        while (true) {
            const operator = this.matchAnyOperator(["==", "!=", "===", "!=="]);

            if (!operator) break;

            const right = this.parseComparison();

            switch (operator) {
                case "==":
                    // Intentional loose equality for macro expressions.
                    left = left == right;
                    break;
                case "!=":
                    left = left != right;
                    break;
                case "===":
                    left = left === right;
                    break;
                case "!==":
                    left = left !== right;
                    break;
            }
        }

        return left;
    }

    private parseComparison(): any {
        let left = this.parseAdditive();

        while (true) {
            const operator = this.matchAnyOperator(["<", "<=", ">", ">="]);

            if (!operator) break;

            const right = this.parseAdditive();

            switch (operator) {
                case "<":
                    left = left < right;
                    break;
                case "<=":
                    left = left <= right;
                    break;
                case ">":
                    left = left > right;
                    break;
                case ">=":
                    left = left >= right;
                    break;
            }
        }

        return left;
    }

    private parseAdditive(): any {
        let left = this.parseMultiplicative();

        while (true) {
            const operator = this.matchAnyOperator(["+", "-"]);

            if (!operator) break;

            const right = this.parseMultiplicative();

            if (operator === "+") {
                left = left + right;
            } else {
                left = Number(left) - Number(right);
            }
        }

        return left;
    }

    private parseMultiplicative(): any {
        let left = this.parsePower();

        while (true) {
            const operator = this.matchAnyOperator(["*", "/", "%"]);

            if (!operator) break;

            const right = this.parsePower();

            switch (operator) {
                case "*":
                    left = Number(left) * Number(right);
                    break;
                case "/":
                    left = Number(left) / Number(right);
                    break;
                case "%":
                    left = Number(left) % Number(right);
                    break;
            }
        }

        return left;
    }

    private parsePower(): any {
        let left = this.parseUnary();

        if (this.matchOperator("**")) {
            left = Number(left) ** Number(this.parsePower());
        }

        return left;
    }

    private parseUnary(): any {
        const operator = this.matchAnyOperator(["!", "+", "-"]);

        if (!operator) return this.parsePrimary();

        const value = this.parseUnary();

        switch (operator) {
            case "!":
                return !value;
            case "+":
                return Number(value);
            case "-":
                return -Number(value);
        }
    }

    private parsePrimary(): any {
        const token = this.tokens[this.index];

        if (!token) {
            throw new Error("unexpected end of expression");
        }

        if (token.type === "paren" && token.value === "(") {
            this.index++;

            const value = this.parseOr();
            const closing = this.tokens[this.index];

            if (!closing || closing.type !== "paren" || closing.value !== ")") {
                throw new Error("missing closing parenthesis");
            }

            this.index++;
            return value;
        }

        if (token.type === "number" || token.type === "string" || token.type === "literal") {
            this.index++;
            return token.value;
        }

        if (token.type === "variable") {
            this.index++;

            const value = getPathValue(this.variables, token.value);

            if (value === undefined) {
                throw new Error(`variable ${token.value} is undefined`);
            }

            return value;
        }

        throw new Error(`unexpected token ${this.describe(token)}`);
    }

    private matchOperator(operator: string): boolean {
        const token = this.tokens[this.index];

        if (token?.type === "operator" && token.value === operator) {
            this.index++;
            return true;
        }

        return false;
    }

    private matchAnyOperator(operators: string[]): string | null {
        const token = this.tokens[this.index];

        if (token?.type !== "operator" || !operators.includes(token.value)) {
            return null;
        }

        this.index++;
        return token.value;
    }

    private describe(token: Token | undefined): string {
        if (!token) return "end of expression";
        return JSON.stringify(token.value);
    }
}

function tokenizeExpression(expression: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;

    while (index < expression.length) {
        const current = expression[index];

        if (/\s/.test(current)) {
            index++;
            continue;
        }

        if (expression.startsWith("${", index)) {
            const end = expression.indexOf("}", index + 2);

            if (end === -1) {
                throw new Error("unterminated variable placeholder");
            }

            const path = expression.slice(index + 2, end).trim();

            if (!path) {
                throw new Error("empty variable placeholder");
            }

            tokens.push({type: "variable", value: path});
            index = end + 1;
            continue;
        }

        if (current === '"' || current === "'") {
            const quote = current;
            let value = "";
            index++;

            while (index < expression.length) {
                const char = expression[index++];

                if (char === quote) {
                    tokens.push({type: "string", value});
                    value = "";
                    break;
                }

                if (char === "\\") {
                    if (index >= expression.length) {
                        throw new Error("unterminated string escape");
                    }

                    const escaped = expression[index++];

                    switch (escaped) {
                        case "n":
                            value += "\n";
                            break;
                        case "r":
                            value += "\r";
                            break;
                        case "t":
                            value += "\t";
                            break;
                        case "\\":
                            value += "\\";
                            break;
                        case '"':
                            value += '"';
                            break;
                        case "'":
                            value += "'";
                            break;
                        default:
                            value += escaped;
                            break;
                    }

                    continue;
                }

                value += char;
            }

            if (expression[index - 1] !== quote) {
                throw new Error("unterminated string");
            }

            continue;
        }

        const numberMatch = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);

        if (numberMatch) {
            tokens.push({type: "number", value: Number(numberMatch[0])});
            index += numberMatch[0].length;
            continue;
        }

        const keywordMatch = expression.slice(index).match(/^(true|false|null)\b/);

        if (keywordMatch) {
            const raw = keywordMatch[1];
            tokens.push({
                type: "literal",
                value: raw === "true" ? true : raw === "false" ? false : null,
            });
            index += raw.length;
            continue;
        }

        const operator = [
            "!==", "===", "**", "&&", "||", "<=", ">=", "==", "!=",
            "+", "-", "*", "/", "%", "<", ">", "!",
        ].find(candidate => expression.startsWith(candidate, index));

        if (operator) {
            tokens.push({type: "operator", value: operator});
            index += operator.length;
            continue;
        }

        if (current === "(" || current === ")") {
            tokens.push({type: "paren", value: current});
            index++;
            continue;
        }

        throw new Error(`unsupported token near ${JSON.stringify(expression.slice(index, index + 16))}`);
    }

    return tokens;
}

function evaluateLocalExpression(expression: any, variables: any): any {
    if (typeof expression !== "string") {
        return expression;
    }

    const trimmed = expression.trim();

    if (!trimmed) {
        return "";
    }

    // A single placeholder copies the real value, preserving arrays/objects/numbers/booleans.
    const placeholder = trimmed.match(/^\$\{([^}]+)}$/);

    if (placeholder) {
        const value = getPathValue(variables, placeholder[1]);

        if (value === undefined) {
            throw new Error(`variable ${placeholder[1].trim()} is undefined`);
        }

        return value;
    }

    // Plain text without expression syntax stays plain text.
    if (!/[+\-*/%<>=!&|()]/.test(trimmed) && !trimmed.includes("${")) {
        return expression;
    }

    return new LocalExpressionParser(tokenizeExpression(trimmed), variables).parse();
}

export default class VariableMacroTask extends BaseMacroTask {
    channel = "variable"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const key = String(data.key ?? "").trim();

        if (!key) {
            logWarn(`variable ${method} requires key`);
            return;
        }

        switch (method) {
            case "get": {
                const value = await getVariable(key);
                variables[key] = value;

                logRegular(`variable get ${key}=${JSON.stringify(value)}`);
                break;
            }

            case "set": {
                if (data.value === undefined) {
                    logWarn(`variable set requires value`);
                    break;
                }

                await setVariable(key, data.value, data.to_file === true || data.toFile === true);
                variables[key] = data.value;

                logRegular(`variable set ${key}=${JSON.stringify(data.value)}`);
                break;
            }

            case "local_set": {
                if (data.expression === undefined && data.value === undefined) {
                    logWarn(`variable local_set requires expression`);
                    break;
                }

                try {
                    const expression = data.expression ?? data.value;
                    const value = evaluateLocalExpression(expression, variables);

                    setPathValue(variables, key, value);

                    logRegular(`variable local_set ${key}=${JSON.stringify(value)}`);
                } catch (error: any) {
                    logWarn(`variable local_set ${key} failed: ${error?.message ?? error}`);
                }

                break;
            }

            default: {
                logWarn(`invalid variable method: ${method}`);
                break;
            }
        }
    }
}
