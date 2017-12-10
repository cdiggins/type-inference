"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var myna_1 = require("./node_modules/myna-parser/myna");
var type_inference_1 = require("./type_inference");
function RegisterGrammars() {
    var typeGrammar = new function () {
        var _this = this;
        this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ']').ast;
        this.funcInput = this.typeExprRec.ws.zeroOrMore.ast;
        this.funcOutput = this.typeExprRec.ws.zeroOrMore.ast;
        this.typeFunc = myna_1.Myna.guardedSeq('(', myna_1.Myna.ws, this.funcInput, '->', myna_1.Myna.ws, this.funcOutput, ')').ast;
        this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
        this.typeConstant = myna_1.Myna.identifier.ast;
        this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeFunc, this.typeVar, this.typeConstant).ast;
    };
    myna_1.Myna.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
    var catGrammar = new function () {
        var _this = this;
        this.recTerm = myna_1.Myna.delay(function () { return _this.term; });
        this.quotation = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term = myna_1.Myna.choice(this.quotation, myna_1.Myna.identifier, myna_1.Myna.integer).ast;
        this.definedName = myna_1.Myna.identifier.ast;
        this.definition = myna_1.Myna.guardedSeq(myna_1.Myna.keyword('define').ws, this.definedName, myna_1.Myna.ws, ":", myna_1.Myna.ws, typeGrammar.typeExpr).ast;
        this.extern = myna_1.Myna.guardedSeq(myna_1.Myna.keyword('define').ws, this.definedName, myna_1.Myna.ws, myna_1.Myna.guardedSeq('{', this.term.zeroOrMore, '}')).ast;
        this.program = myna_1.Myna.choice(this.definition, this.term).zeroOrMore.ast;
    };
    myna_1.Myna.registerGrammar('cat', catGrammar, catGrammar.program);
}
RegisterGrammars();
function stringToType(input) {
    var ast = myna_1.Myna.parse(myna_1.Myna.grammars['type'].typeExpr, input);
    return astToType(ast);
}
function astToType(ast) {
    if (!ast)
        throw new Error("Missing AST node");
    switch (ast.name) {
        case "typeVar":
            return new type_inference_1.TypeInference.TypeVariable(ast.allText.substr(1));
        case "typeConstant":
            return new type_inference_1.TypeInference.TypeConstant(ast.allText);
        case "typeFunc":
            return new type_inference_1.TypeInference.TypeList([
                new type_inference_1.TypeInference.TypeConstant('function'),
                astToType(ast.children[0]),
                astToType(ast.children[1])
            ]);
        case "funcInput":
        case "funcOutput":
        case "typeList":
            return new type_inference_1.TypeInference.TypeList(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1)
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default:
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}
function TestParseType(input) {
    var ast = myna_1.Myna.parsers["type"](input);
    // console.log(ast);
    var t = astToType(ast);
    console.log("input = " + t);
}
TestParseType("abc");
TestParseType("'abc");
TestParseType("[]");
TestParseType("[ ]");
TestParseType("[a]");
TestParseType("[ab cd]");
TestParseType("[ab [cd] [ef]]");
TestParseType("[[][a][[]b]'abc]");
TestParseType("('a 'b -> 'c 'd)");
TestParseType("(( -> ) -> ('c -> [abc]))");
function TestConstraints(a, b) {
    var engine = new type_inference_1.TypeInference.Engine();
    var expr1 = stringToType(a);
    var expr2 = stringToType(b);
    engine.addTypeConstraint(expr1, expr2);
    engine.resolve();
    engine.logState();
}
TestConstraints("'a", "int");
TestConstraints("int", "'a");
TestConstraints("int", "int");
TestConstraints("['a]", "[int]");
TestConstraints("['a int 'b]", "[int int float string]");
TestConstraints("'a", "['a int]");
TestConstraints("('a -> 'b)", "(int int -> float)");
process.exit();
//# sourceMappingURL=type_parser.js.map