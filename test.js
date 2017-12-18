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
// Converts a cons list into a flat list of types like Cat prefers
function consListToString(t) {
    if (t instanceof type_inference_1.TypeInference.TypeArray)
        return typeToString(t.types[0]) + " " + consListToString(t.types[1]);
    else
        return typeToString(t);
}
exports.consListToString = consListToString;
// Converts a string into a type expression
function typeToString(t) {
    if (type_inference_1.TypeInference.isFunctionType(t) && t instanceof type_inference_1.TypeInference.TypeArray) {
        return t.typeSchemeToString() + "("
            + consListToString(type_inference_1.TypeInference.functionInput(t)) + " -> "
            + consListToString(type_inference_1.TypeInference.functionOutput(t)) + ")";
    }
    else {
        return t.toString();
    }
}
exports.typeToString = typeToString;
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
function testClone(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () {
        var t = stringToType(input);
        t = type_inference_1.TypeInference.clone(t, 0);
        t = type_inference_1.TypeInference.clone(t, 1);
        return t.toString();
    }, input, fail);
}
function runCloneTests() {
    testClone("('a)");
    testClone("('a 'b)");
    testClone("('a ('b))");
    testClone("('a ('b) ('a))");
    testClone("('a ('b) ('a ('c) ('c 'd)))");
    testClone("(fun ('a 'b) ('b 'c))");
}
function testParse(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () { return stringToType(input); }, input, fail);
}
var coreTypes = {
    apply: "(fun ((fun 'a 'b) 'a) 'b)",
    compose: "(fun ((fun 'b 'c) ((fun 'a 'b) 'd)) ((fun ('a 'c) 'd)))",
    quote: "(fun ('a 'b)  ((fun 'c ('a 'c)) 'b))",
    dup: "(fun ('a 'b) ('a ('a 'b)))",
    swap: "(fun ('a ('b 'c)) ('b ('a 'c)))",
    pop: "(fun ('a 'b) 'b)",
};
function runParseTests() {
    testParse("abc");
    testParse("'abc");
    testParse("()");
    testParse("( )");
    testParse("(a)");
    testParse("('a)");
    testParse("(array int)");
    testParse("(array 't)");
    testParse("(fun int 't ())");
    testParse("(fun int float)");
    testParse("(()())");
    testParse("(fun (int (int 'a)) (float (float 'a)))");
    testParse("(()()", true);
    testParse("()()", true);
    testParse("()())", true);
    testParse("(a b", true);
    testParse("a b", true);
    testParse("a b)", true);
    for (var k in coreTypes)
        testParse(coreTypes[k]);
}
function testComposition(a, b, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () {
        var expr1 = stringToType(a);
        console.log("Type A: " + expr1.toString());
        var expr2 = stringToType(b);
        console.log("Type B: " + expr2.toString());
        var r = type_inference_1.TypeInference.composeFunctions(expr1, expr2);
        console.log("Composed type: " + r.toString());
        r = type_inference_1.TypeInference.normalizeVarNames(r);
        console.log("Normalized type: " + r.toString());
        // Return a prettified version of the function
        return typeToString(r);
    }, "Unifying " + a + " with " + b, fail);
}
function testUnifyChain(ops) {
    var t1 = coreTypes[ops[0]];
    var t2 = coreTypes[ops[1]];
    testComposition(t1, t2);
}
function runUnificationTests() {
    testComposition("'a", "int");
    testComposition("int", "'a");
    testComposition("int", "int");
    testComposition("('a)", "(int)");
    testComposition("('a (int 'b))", "(int (int (float string)))");
    testComposition("'a", "('b int)");
    testComposition("(fun 'a 'b)", "(fun (int int) float)");
    testComposition("(fun ('a 'b) 'b)", "(fun (int (int int)) 'c)");
    testComposition("(fun ('a 'b) 'b)", "(fun (int (int int)) ('c))", true);
}
function testAllPairs() {
    for (var op1 in coreTypes) {
        for (var op2 in coreTypes) {
            console.log(op1 + " " + op2);
            testComposition(coreTypes[op1], coreTypes[op2]);
        }
    }
}
runParseTests();
runCloneTests();
runUnificationTests();
testAllPairs();
process.exit();
//# sourceMappingURL=test.js.map