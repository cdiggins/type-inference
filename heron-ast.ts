// Variable usage 
// - Declaration
// - Usage 
// - function calls

import { Myna as m } from "myna-parser";

import { heronGrammar, parseHeron } from './heron-parser';

const g = heronGrammar;

function createAstVisitorFunction(rule, lines) {
    lines.push("  function visit_" + rule.name + "(ast, state) {");
    lines.push("    // " + rule.astRuleDefn());
    lines.push("    this.visitChildren(ast, state);");
    lines.push("  }")
}

function createAstVisitor() {
    const grammarName = "heron";
    var lines = [
        "class " + grammarName + "Visitor",
        "{",4
        "  function visitNode(ast, state) {",
        "    this['visit_' + child.name](child, state);",
        "  }",        
        "  function visitChildren(ast, state) {",
        "    for (let child of ast.children)",
        "      this.visitNode(child, state);",
        "  }"        
        ];
    var rules = m.grammarAstRules(grammarName);
    for (var r of rules)
        createAstVisitorFunction(r, lines);    
    lines.push("}");

    return lines.join("\n");
}

const output = createAstVisitor();
console.log(output);

declare const process;
process.exit();