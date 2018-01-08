"use strict";
// This is a set of tests for the type-inference algorithm applied to lambda Calculus and the Concatenative calculus.
// Running these tests require installation of the Myna parsing module. 
Object.defineProperty(exports, "__esModule", { value: true });
// \f.f(f)
// \x.\f.(f(f))x
// apply, abstract, variable 
var type_inference_1 = require("./type_inference");
var myna_1 = require("./node_modules/myna-parser/myna");
// Defines syntax parsers for type expression, the lambda calculus, and Cat 
function registerGrammars() {
    // A simple grammar for parsing type expressions
    var typeGrammar = new function () {
        var _this = this;
        this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_1.Myna.guardedSeq('(', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
        this.typeConstant = myna_1.Myna.identifier.or(myna_1.Myna.digits).or("->").or("*").or("[]").ast;
        this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeVar, this.typeConstant).ast;
    };
    myna_1.Myna.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
    // A Myna grammar for parsing the lambda calculus with integers 
    var lambdaGrammar = new function () {
        var _this = this;
        this.recExpr = myna_1.Myna.delay(function () { return _this.expr; });
        this.var = myna_1.Myna.identifier.ast;
        this.number = myna_1.Myna.digits.ast;
        this.abstraction = myna_1.Myna.guardedSeq("\\", this.var, ".").then(this.recExpr).ast;
        this.parenExpr = myna_1.Myna.guardedSeq("(", this.recExpr, ")").ast;
        this.expr = myna_1.Myna.choice(this.parenExpr, this.abstraction, this.var, this.number).then(myna_1.Myna.ws).oneOrMore.ast;
    };
    myna_1.Myna.registerGrammar('lambda', lambdaGrammar, lambdaGrammar.expr);
    // Defines a Myna grammar for parsing simple Cat expressions
    var catGrammar = new function () {
        var _this = this;
        this.identifier = myna_1.Myna.identifier.ast;
        this.integer = myna_1.Myna.integer.ast;
        this.true = myna_1.Myna.keyword("true").ast;
        this.false = myna_1.Myna.keyword("false").ast;
        this.recTerm = myna_1.Myna.delay(function () { return _this.term; });
        this.quotation = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term = myna_1.Myna.choice(this.quotation, this.integer, this.true, this.false, this.identifier);
        this.terms = myna_1.Myna.ws.then(this.term.ws.zeroOrMore);
    };
    myna_1.Myna.registerGrammar('cat', catGrammar, catGrammar.terms);
}
registerGrammars();
var typeParser = myna_1.Myna.parsers['type'];
var lcParser = myna_1.Myna.parsers['lambda'];
var catParser = myna_1.Myna.parsers['cat'];
//================================================================
var catTypes = {
    apply: "((('a -> 'b) 'a) -> 'b)",
    compose: "((('b -> 'c) (('a -> 'b) 'd)) -> (('a -> 'c) 'd))",
    quote: "(('a 'b) -> (('c -> ('a 'c)) 'b))",
    dup: "(('a 'b) -> ('a ('a 'b)))",
    swap: "(('a ('b 'c)) -> ('b ('a 'c)))",
    pop: "(('a 'b) -> 'b)",
    id: "('a -> 'a)",
};
var combinators = {
    i: "\\x.x",
    k: "\\x.\\y.x",
    s: "\\x.\\y.\\z.x z (y z)",
    b: "\\x.\\y.\\z.x (y z)",
    c: "\\x.\\y.\\z.x y z",
    w: "\\x.\\y.x y y",
    m: "\\x.x x",
    succ: "\\n.\\f.\\x.f (n f x)",
    pred: "\\n.\\f.\\x.n (\\g.\\h.h (g f)) (\\u.x) (\\t.t)",
    plus: "\\m.\\n.\\f.\\x.m f (n f x)",
    mul: "\\m.\\n.\\f.m (n f)",
    zero: "\\f.\\x.x",
    one: "\\f.\\x.f x",
    two: "\\f.\\x.f (f x)",
    three: "\\f.\\x.f (f (f x))",
    True: "\\x.\\y.x",
    False: "\\x.\\y.y",
    pair: "\\x.\\y.\\f.f x y",
    first: "\\p.p \\x.\\y.x",
    second: "\\p.p \\x.\\y.y",
    nil: "\\a.\\x.\\y.x",
    null: "\\p.p (\\a.\\b.\\x.\\y.y)",
    // This currently fails: just like it does with HM
    test1: "(\\i.(i \\x.x) (i 0)) \\y.y",
    // More tests
    test2: "\\i.(i 0) \\y.y",
    test3: "\\i.(i i) \\y.y",
    test4: "\\i.(i \\x.x) \\y.y",
    test5: "\\i.(i (\\x.x 0)) \\y.y",
    test6: "0",
    test7: "\\i.0",
    test8: "\\i.i 0",
    test9: "\\i.0 \\y.y",
    test10: "(\\i.0)",
    test11: "(\\i.i 0)",
    test12: "\\i.i (0)",
    test13: "(\\i.0 \\y.y)",
    test14: "\\i.0 (\\y.y)",
    test15: "(\\i.0) (\\y.y)",
    test16: "(\\i.0) \\y.y",
};
//=================================================================
// Parsing functions
function stringToType(input) {
    var ast = typeParser(input);
    if (ast.end != input.length)
        throw new Error("Only part of input was consumed");
    return astToType(ast);
}
function astToType(ast) {
    if (!ast)
        return null;
    switch (ast.name) {
        case "typeVar":
            return type_inference_1.TypeInference.typeVariable(ast.allText.substr(1));
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
function lambdaAstToType(ast, engine) {
    switch (ast.rule.name) {
        case "abstraction":
            {
                var arg = engine.introduceVariable(ast.children[0].allText);
                var body = lambdaAstToType(ast.children[1], engine);
                var fxn = type_inference_1.TypeInference.functionType(arg, body);
                engine.popVariable();
                return fxn;
            }
        case "parenExpr":
            return lambdaAstToType(ast.children[0], engine);
        case "var":
            return engine.lookupVariable(ast.allText);
        case "number":
            return type_inference_1.TypeInference.typeConstant('Num');
        case "expr":
            {
                var r = lambdaAstToType(ast.children[0], engine);
                for (var i = 1; i < ast.children.length; ++i) {
                    var args = lambdaAstToType(ast.children[i], engine);
                    r = engine.applyFunction(r, args);
                }
                return r;
            }
        default:
            throw new Error("Unrecognized ast rule " + ast.rule);
    }
}
function stringToLambdaExprType(s) {
    var e = new type_inference_1.TypeInference.ScopedTypeInferenceEngine();
    var ast = lcParser(s);
    if (ast.end != s.length)
        throw new Error("Only part of input was consumed");
    var t = lambdaAstToType(ast, e);
    t = e.getUnifiedType(t);
    t = type_inference_1.TypeInference.alphabetizeVarNames(t);
    return t;
}
function catTypeFromAst(ast) {
    switch (ast.name) {
        case "integer":
            return type_inference_1.TypeInference.quotation(type_inference_1.TypeInference.typeConstant('Num'));
        case "true":
        case "false":
            return type_inference_1.TypeInference.quotation(type_inference_1.TypeInference.typeConstant('Bool'));
        case "identifier": {
            var ts = catTypes[ast.allText];
            if (!ts)
                throw new Error("Could not find type for term: " + ast.allText);
            return stringToType(ts);
        }
        case "quotation": {
            var innerType = ast.children.length > 0
                ? catTypeFromAst(ast.children[0])
                : type_inference_1.TypeInference.idFunction();
            return type_inference_1.TypeInference.quotation(innerType);
        }
        case "terms": {
            var types = ast.children.map(catTypeFromAst);
            return type_inference_1.TypeInference.composeFunctionChain(types);
        }
        default:
            throw new Error("Could not figure out function type");
    }
}
function catType(s) {
    var ast = catParser(s);
    if (ast.allText.length != s.length)
        throw new Error("Could not parse the entire term: " + s);
    return catTypeFromAst(ast);
}
//==========================================================================================
// Testing helper functions 
function testParse(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () { return stringToType(input); }, input, fail);
}
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
function typeToString(t) {
    if (t instanceof type_inference_1.TypeInference.TypeVariable)
        return "'" + t.name;
    else if (t instanceof type_inference_1.TypeInference.TypeArray)
        return "(" + t.types.map(typeToString).join(" ") + ")";
    else
        return t.toString();
}
function testLambdaCalculus() {
    for (var k in combinators) {
        try {
            var s = combinators[k];
            var t = stringToLambdaExprType(s);
            console.log(k + " = " + s + " : " + t);
        }
        catch (e) {
            console.log("FAILED: " + k + " " + e);
        }
    }
}
function printCatTypes() {
    for (var k in catTypes) {
        var ts = catTypes[k];
        var t = stringToType(ts);
        console.log(k);
        console.log(ts);
        console.log(t.toString());
    }
}
function testCatType(term, type) {
    var exp = type;
    var inf = catType(term);
    var r = type_inference_1.TypeInference.normalizeVarNames(inf);
    if (r.toString() != exp) {
        console.log("FAILED: " + term + " + expected " + exp + " got " + r);
    }
    else {
        console.log("PASSED: " + term + " : " + exp);
    }
}
function testCatTypes() {
    var data = [
        // Primitive forms 
        ["", "!t0.(t0 -> t0)"],
        ["id", "!t0.(t0 -> t0)"],
        ["apply", "!t1.(!t0.((t0 -> t1) t0) -> t1)"],
        ["compose", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) t3))"],
        ["quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) t1))"],
        ["dup", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))"],
        ["swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t0 t2)))"],
        ["pop", "!t1.(!t0.(t0 t1) -> t1)"],
        // Quotations of Primitives 
        ["[]", "!t0.(t0 -> (!t1.(t1 -> t1) t0))"],
        ["[id]", "!t0.(t0 -> (!t1.(t1 -> t1) t0))"],
        ["[apply]", "!t0.(t0 -> (!t2.(!t1.((t1 -> t2) t1) -> t2) t0))"],
        ["[pop]", "!t0.(t0 -> (!t2.(!t1.(t1 t2) -> t2) t0))"],
        ["[dup]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (t1 (t1 t2)) t0))"],
        ["[compose]", "!t0.(t0 -> (!t2!t3!t4.(!t1.((t1 -> t2) ((t3 -> t1) t4)) -> ((t3 -> t2) t4)) t0))"],
        ["[quote]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (!t3.(t3 -> (t1 t3)) t2)) t0))"],
        ["[swap]", "!t0!.(t0 -> t1!t2!t3.((t1 (t2 t3)) -> `(t2 (t1 t3))) t0))"],
        // Compositions of Primitives 
        ["apply apply", "!t2.(!t0.((t0 -> !t1.((t1 -> t2) t1)) t0) -> t2)"],
        ["apply compose", "!t2!t3!t4.(!t0.((t0 -> !t1.((t1 -> t2) ((t3 -> t1) t4))) t0) -> ((t3 -> t2) t4))"],
        ["apply quote", "!t1!t2.(!t0.((t0 -> (t1 t2)) t0) -> (!t3.(t3 -> (t1 t3)) t2))"],
        ["apply dup", "!t1!t2.(!t0.((t0 -> (t1 t2)) t0) -> (t1 (t1 t2)))"],
        ["apply swap", "!t1!t2!t3.(!t0.((t0 -> (t1 (t2 t3))) t0) -> (t2 (t1 t3)))"],
        ["apply pop", "!t2.(!t0.((t0 -> !t1.(t1 t2)) t0) -> t2)"],
        ["compose apply", "!t1.(!t0.((t0 -> t1) !t2.((t2 -> t0) t2)) -> t1)"],
        ["compose compose", "!t1!t3!t4.(!t0.((t0 -> t1) !t2.((t2 -> t0) ((t3 -> t2) t4))) -> ((t3 -> t1) t4))"],
        ["compose quote", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> (!t4.(t4 -> ((t2 -> t1) t4)) t3))"],
        ["compose dup", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) ((t2 -> t1) t3)))"],
        ["compose swap", "!t1!t2!t3!t4.(!t0.((t0 -> t1) ((t2 -> t0) (t3 t4))) -> (t3 ((t2 -> t1) t4)))"],
        ["compose pop", "!t3.(!t0.(!t1.(t0 -> t1) (!t2.(t2 -> t0) t3)) -> t3)"],
        ["quote apply", "!t0!t1.((t0 t1) -> (t0 t1))"],
        ["quote compose", "!t0!t1!t2!t3.((t0 ((t1 -> t2) t3)) -> ((t1 -> (t0 t2)) t3))"],
        ["quote quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (!t3.(t3 -> (t0 t3)) t2)) t1))"],
        ["quote dup", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))"],
        ["quote swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (!t3.(t3 -> (t0 t3)) t2)))"],
        ["quote pop", "!t1.(!t0.(t0 t1) -> t1)"],
        ["dup apply", "!t1.(!t0.((((rec 1) t0) -> t1) t0) -> t1)"],
        ["dup compose", "!t0!t1.(((t0 -> t0) t1) -> ((t0 -> t0) t1))"],
        ["dup quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (t0 t1)))"],
        ["dup dup", "!t0!t1.((t0 t1) -> (t0 (t0 (t0 t1))))"],
        ["dup swap", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))"],
        ["dup pop", "!t0!t1.((t0 t1) -> (t0 t1))"],
        ["swap apply", "!t2.(!t0.(t0 !t1.(((t0 t1) -> t2) t1)) -> t2)"],
        ["swap compose", "!t0!t2!t3.(!t1.((t0 -> t1) ((t1 -> t2) t3)) -> ((t0 -> t2) t3))"],
        ["swap quote", "!t0!t1!t2.((t0 (t1 t2)) -> (!t3.(t3 -> (t1 t3)) (t0 t2)))"],
        ["swap dup", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t1 (t0 t2))))"],
        ["swap swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t0 (t1 t2)))"],
        ["swap pop", "!t0!t2.((t0 !t1.(t1 t2)) -> (t0 t2))"],
        ["pop apply", "!t2.(!t0.(t0 !t1.((t1 -> t2) t1)) -> t2)"],
        ["pop compose", "!t2!t3!t4.(!t0.(t0 !t1.((t1 -> t2) ((t3 -> t1) t4))) -> ((t3 -> t2) t4))"],
        ["pop quote", "!t1!t2.(!t0.(t0 (t1 t2)) -> (!t3.(t3 -> (t1 t3)) t2))"],
        ["pop dup", "!t1!t2.(!t0.(t0 (t1 t2)) -> (t1 (t1 t2)))"],
        ["pop swap", "!t1!t2!t3.(!t0.(t0 (t1 (t2 t3))) -> (t2 (t1 t3)))"],
        ["pop pop", "!t2.(!t0.(t0 !t1.(t1 t2)) -> t2)"],
        // Some standard library operators         
        ["swap quote compose apply", "!t1!t2.(!t0.((t0 -> t1) (t2 t0)) -> (t2 t1))"],
        // Various tests
        ["swap quote compose apply pop", "!t1.(!t0.((t0 -> t1) !t2.(t2 t0)) -> t1)"],
        ["[id] dup 0 swap apply swap [id] swap apply apply", "!t0.(t0 -> (Num t0))"],
    ];
    console.log("Testing Cat expression inference");
    for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
        var xs = data_1[_i];
        testCatType(xs[0], xs[1]);
    }
}
// TODO: 
// Test these equalities: 
// [t] apply = t
// [t] pop = id
// t id = t
// id t = t
// [t] quote apply = [t]
// [t] dup popd apply = t
// [t] dup pop apply = t
// dip pop = pop apply
// [t] [u] compose = [t u]
// [t] apply [u] apply = t u
// [t] [u] compose apply = t u
// t u v = [t] [u] compose [v] compose apply = [u] [v] compose [t] swap compose apply 
function issue1() {
    // Working on issue #1 reported by @storyyeller
    type_inference_1.TypeInference.trace = true;
    var e = new type_inference_1.TypeInference.ScopedTypeInferenceEngine();
    var s = combinators.test1;
    var ast = lcParser(s);
    if (ast.end != s.length)
        throw new Error("Only part of input was consumed");
    var t = lambdaAstToType(ast, e);
    t = e.getUnifiedType(t);
    console.log(e.unifier.state());
    console.log(t.toString());
}
function issue1InCat() {
    var t = catType("");
    t = type_inference_1.TypeInference.alphabetizeVarNames(t);
    console.log(t.toString());
    t = catType("[id] dup [0 swap apply] swap quote compose apply [id] swap apply apply swap apply");
    t = type_inference_1.TypeInference.alphabetizeVarNames(t);
    console.log(t.toString());
}
testCatTypes();
testLambdaCalculus();
issue1();
process.exit();
//# sourceMappingURL=test.js.map