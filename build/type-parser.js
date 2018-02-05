"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_system_1 = require("./type-system");
var myna_parser_1 = require("myna-parser");
// Defines syntax parsers for type expression, the lambda calculus, and Cat 
function registerGrammars() {
    // A simple grammar for parsing type expressions
    var typeGrammar = new function () {
        var _this = this;
        this.typeExprRec = myna_parser_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_parser_1.Myna.guardedSeq('(', myna_parser_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar = myna_parser_1.Myna.guardedSeq("'", myna_parser_1.Myna.identifier).ast;
        this.typeConstant = myna_parser_1.Myna.identifier.or(myna_parser_1.Myna.digits).or("->").or("*").or("[]").ast;
        this.typeExpr = myna_parser_1.Myna.choice(this.typeList, this.typeVar, this.typeConstant).ast;
    };
    myna_parser_1.Myna.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
}
registerGrammars();
exports.typeParser = myna_parser_1.Myna.parsers['type'];
function parseType(input) {
    var ast = exports.typeParser(input);
    if (ast.end != input.length)
        throw new Error("Only part of input was consumed");
    return astToType(ast);
}
exports.parseType = parseType;
function astToType(ast) {
    if (!ast)
        return null;
    switch (ast.name) {
        case "typeVar":
            return type_system_1.typeVariable(ast.allText.substr(1));
        case "typeConstant":
            return type_system_1.typeConstant(ast.allText);
        case "typeList":
            return type_system_1.typeArray(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1)
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default:
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}
//# sourceMappingURL=type-parser.js.map