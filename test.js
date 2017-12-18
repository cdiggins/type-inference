"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_inference_1 = require("./type_inference");
var myna_1 = require("./node_modules/myna-parser/myna");
function registerGrammars() {
    var typeGrammar = new function () {
        var _this = this;
        this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_1.Myna.guardedSeq('(', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
        this.typeConstant = myna_1.Myna.identifier.ast;
        this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeVar, this.typeConstant).ast;
    };
    myna_1.Myna.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
}
registerGrammars();
var parser = myna_1.Myna.parsers['type'];
function runTest(f, testName, expectFail) {
    if (expectFail === void 0) { expectFail = false; }
    try {
        console.log("Running test: " + testName);
        var result = f();
        console.log("Result = " + result);
        if (result && !expectFail || !result && expectFail) {
            console.log("PASSED");
        }
        else {
            console.log("FAILED");
        }
    }
    catch (e) {
        if (expectFail) {
            console.log("PASSED: expected fail, error caught: " + e.message);
        }
        else {
            console.log("FAILED: error caught: " + e.message);
        }
    }
}
function stringToType(input) {
    var ast = parser(input);
    if (ast.end != input.length)
        throw new Error("Only part of input was consumed");
    return astToType(ast);
}
exports.stringToType = stringToType;
function astToType(ast) {
    if (!ast)
        return null;
    switch (ast.name) {
        case "typeVar":
            return type_inference_1.TypeInference.typeVar(ast.allText.substr(1));
        case "typeConstant":
            return type_inference_1.TypeInference.typeConstant(ast.allText);
        case "typeList":
            return type_inference_1.TypeInference.typeArray(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1)
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default:
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}
exports.astToType = astToType;
function testComputeSchemas(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () {
        var t = stringToType(input);
        type_inference_1.TypeInference.computeSchemes(t);
        return t.toString();
    }, input, fail);
}
function runSchemaTests() {
    testComputeSchemas("('a)");
    testComputeSchemas("('a 'b)");
    testComputeSchemas("('a ('b))");
    testComputeSchemas("('a ('b) ('a))");
    testComputeSchemas("('a ('b) ('a ('c) ('c 'd)))");
    testComputeSchemas("(function ('a 'b) ('b 'c))");
}
runSchemaTests();
function testParse(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () { return stringToType(input); }, input, fail);
}
function runParseTests() {
    testParse("abc");
    testParse("'abc");
    testParse("()");
    testParse("( )");
    testParse("(a)");
    testParse("('a)");
    testParse("(array int)");
    testParse("(array 't)");
    testParse("(function int 't ())");
    testParse("(function int float)");
    testParse("(()())");
    testParse("(function (int (int 'a)) (float (float 'a)))");
    testParse("(()()", true);
    testParse("()()", true);
    testParse("()())", true);
    testParse("(a b", true);
    testParse("a b", true);
    testParse("a b)", true);
}
// runParseTests()
function testUnification(a, b, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () {
        var engine = new type_inference_1.TypeInference.Unifier();
        var expr1 = stringToType(a);
        type_inference_1.TypeInference.computeSchemes(expr1);
        console.log(expr1.toString());
        var expr2 = stringToType(b);
        type_inference_1.TypeInference.computeSchemes(expr2);
        console.log(expr2.toString());
        engine.unifyTypes(expr1, expr2);
        return "success";
    }, "Unifying " + a + " with " + b, fail);
}
function runUnificationTests() {
    testUnification("'a", "int");
    testUnification("int", "'a");
    testUnification("int", "int");
    testUnification("('a)", "(int)");
    testUnification("('a (int 'b))", "(int (int (float string)))");
    testUnification("'a", "('b int)");
    testUnification("(function 'a 'b)", "(function (int int) float)");
    testUnification("(function ('a 'b) 'b)", "(function (int (int int)) 'c)");
    testUnification("(function ('a 'b) 'b)", "(function (int (int int)) ('c))", true);
}
process.exit();
//# sourceMappingURL=test.js.map