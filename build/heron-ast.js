"use strict";
// Variable usage 
// - Declaration
// - Usage 
// - function calls
Object.defineProperty(exports, "__esModule", { value: true });
var myna_parser_1 = require("myna-parser");
var heron_parser_1 = require("./heron-parser");
var g = heron_parser_1.heronGrammar;
function createAstVisitorFunction(rule, lines) {
    lines.push("  function visit_" + rule.name + "(ast, state) {");
    lines.push("    // " + rule.astRuleDefn());
    lines.push("    this.visitChildren(ast, state);");
    lines.push("  }");
}
function createAstVisitor() {
    var grammarName = "heron";
    var lines = [
        "class " + grammarName + "Visitor",
        "{",
        "  function visitNode(ast, state) {",
        "    this['visit_' + child.name](child, state);",
        "  }",
        "  function visitChildren(ast, state) {",
        "    for (let child of ast.children)",
        "      this.visitNode(child, state);",
        "  }"
    ];
    var rules = myna_parser_1.Myna.grammarAstRules(grammarName);
    for (var _i = 0, rules_1 = rules; _i < rules_1.length; _i++) {
        var r = rules_1[_i];
        createAstVisitorFunction(r, lines);
    }
    lines.push("}");
    return lines.join("\n");
}
var output = createAstVisitor();
console.log(output);
process.exit();
//# sourceMappingURL=heron-ast.js.map