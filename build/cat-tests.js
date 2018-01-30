"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_inference_1 = require("./type_inference");
var type_parser_1 = require("./type-parser");
var cat_types_1 = require("./cat-types");
var cat_lambda_1 = require("./cat-lambda");
var lambda_calculus_1 = require("./lambda-calculus");
var combinatory_logic_1 = require("./combinatory-logic");
var lambda_calculus_to_cat_1 = require("./lambda-calculus-to-cat");
var catTests = [
    // Primitive forms 
    ["", "!t0.(t0 -> t0)"],
    // ["id", "!t0!t1.((t0 t1) -> (t0 t1))"],
    ["apply", "!t1.(!t0.((t0 -> t1) t0) -> t1)"],
    ["compose", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) t3))"],
    ["quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) t1))"],
    ["dup", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))"],
    ["swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t0 t2)))"],
    ["pop", "!t1.(!t0.(t0 t1) -> t1)"],
    // Quotations of Primitives 
    ["[]", "!t0.(t0 -> (!t1.(t1 -> t1) t0))"],
    //["[id]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (t1 t2)) t0))"],
    ["[apply]", "!t0.(t0 -> (!t2.(!t1.((t1 -> t2) t1) -> t2) t0))"],
    ["[pop]", "!t0.(t0 -> (!t2.(!t1.(t1 t2) -> t2) t0))"],
    ["[dup]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (t1 (t1 t2))) t0))"],
    ["[compose]", "!t0.(t0 -> (!t2!t3!t4.(!t1.((t1 -> t2) ((t3 -> t1) t4)) -> ((t3 -> t2) t4)) t0))"],
    ["[quote]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (!t3.(t3 -> (t1 t3)) t2)) t0))"],
    ["[swap]", "!t0.(t0 -> (!t1!t2!t3.((t1 (t2 t3)) -> (t2 (t1 t3))) t0))"],
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
function printCatTypes() {
    for (var k in cat_types_1.catTypes) {
        var ts = cat_types_1.catTypes[k];
        var t = type_parser_1.parseType(ts);
        console.log(k);
        console.log(ts);
        console.log(t.toString());
    }
}
function testCatType(term, type) {
    var exp = type;
    var inf = cat_types_1.inferCatType(term);
    var r = type_inference_1.TypeInference.normalizeVarNames(inf);
    if (r.toString() != exp) {
        console.log("FAILED: " + term + " + expected " + exp + " got " + r);
    }
    else {
        console.log("PASSED: " + term + " : " + exp);
    }
}
function testCatTypes() {
    console.log("Testing Cat expression inference");
    for (var _i = 0, catTests_1 = catTests; _i < catTests_1.length; _i++) {
        var xs = catTests_1[_i];
        testCatType(xs[0], xs[1]);
    }
}
function issue1InCat() {
    var t = cat_types_1.inferCatType("");
    t = type_inference_1.TypeInference.alphabetizeVarNames(t);
    console.log(t.toString());
    t = cat_types_1.inferCatType("[id] dup [0 swap apply] swap quote compose apply [id] swap apply apply swap apply");
    t = type_inference_1.TypeInference.alphabetizeVarNames(t);
    console.log(t.toString());
}
/*
function testCloning() {
    var types = catTests.map(t => inferCatType(t[0]));
    for (var t of types) {
        try {
            var r1 = ti.freshParameterNames(t, 0);
            var r2 = ti.freshVariableNames(t, 0);
            var r3 = t.clone({});
            compareTypes(t, r1);
            compareTypes(t, r2);
            compareTypes(t, r3);
        }
        catch (e) {
            console.log("FAILED cloning test of " + t + " with message " + e);
        }
    }
}
*/
var lambdaCatTests = [
    "\\a",
    "\\a \\b",
    "\\a \\b @a",
    "\\a \\b @b @a apply",
    "\\a \\b [@a] apply",
    "\\a @a @a",
    "\\a \\b @b @a",
    "\\a \\b @a @a",
    "\\a \\b \\c @c @a @b",
    "\\a \\b \\c @c @b @a",
    "\\a \\b \\c @a @b @c",
    "\\a \\b \\c @a @c @b",
    "\\a \\b \\c @b @a @c",
    "\\a \\b \\c @b @c @a",
];
// SK Combinators expressed in Lambda Cat. 
var lambdaCatCombinators = {
    i: "\\x @x",
    k: "\\x [\\y @x]",
    s: "\\x [\\y [\\z @y @z apply @z @x apply apply]]",
    b: "\\x [\\y [\\z @z @y apply @x apply]]",
    c: "\\x [\\y [\\z @z @y @x apply apply]]",
    w: "\\x [\\y [@y @y @x apply apply]]",
    m: "\\x [@x @x apply]",
    issue: "[\\x @x] [\\i 0 @i apply [\\x @x] @i apply apply] apply"
};
function testRedex(x) {
    var vars = Object.keys(lambda_calculus_1.freeVariables(x));
    console.log("Free variables: " + vars);
    // TODO: proper alpha naming 
    // TODO: validate this in isolation 
    //var eta = etaConversion(x);
    //console.log("Eta reduction: " + eta);
    // TODO: valdiate this properly 
    //var lift = lambdaLift(x);
    //console.log("Lambda lifting: " + lift);
    // Convert to SKI combinators
    var elim = combinatory_logic_1.abstractionElimination(x);
    console.log("Abstraction elimination: " + elim);
    // Produces very long terms  
    //var combinator = combinatorToLambdaCalculus(elim);
    //console.log("As combinators: " + combinator);    
}
function testLambdaToCat(s) {
    var redex = lambda_calculus_1.parseRedex(s);
    var xs = lambda_calculus_to_cat_1.lambdaToPureCat(redex);
    console.log("Lambda expression: " + s);
    console.log("Cat expression: " + xs.join(' '));
}
function printCatType(s) {
    try {
        var t = cat_types_1.inferCatType(s);
        console.log("Inferred type: " + t);
    }
    catch (e) {
        console.log("FAILED: " + e.message);
    }
}
function testCombinator(name, def) {
    console.log("Testing combinator " + name);
    var t = combinatory_logic_1.combinators[name];
    var redex = lambda_calculus_1.parseRedex(t);
    console.log("Parsed redex: " + redex);
    testRedex(redex);
    var ys = lambda_calculus_to_cat_1.lambdaToCat(redex);
    console.log("Lambda Cat: " + ys.join(' '));
    var xs = cat_lambda_1.removeVars(ys);
    var cat = xs.join(' ');
    console.log("Pure Cat: " + cat);
    // TODO: test rewriting 
    // TODO: test converting back  
    printCatType(cat);
}
for (var k in combinatory_logic_1.combinators) {
    testCombinator(k, combinatory_logic_1.combinators[k]);
}
testCatTypes();
process.exit();
//# sourceMappingURL=cat-tests.js.map