"use strict";
// TODO: reject recursion and jump out.  
// TODO: check identities
// TODO: from Cat to Lambda-cat (dup/pop/papply/dip)
// TODO: rewriting rules
// TODO: simplify the type presentation (real parseable version)
// TODO: make type presentation look like TypeScript types 
// TODO: make type presentation look like Haskell types
Object.defineProperty(exports, "__esModule", { value: true });
var ti = require("./type_inference");
var type_parser_1 = require("./type-parser");
var cat_types_1 = require("./cat-types");
var cat_lambda_1 = require("./cat-lambda");
var lambda_calculus_1 = require("./lambda-calculus");
var combinatory_logic_1 = require("./combinatory-logic");
var lambda_calculus_to_cat_1 = require("./lambda-calculus-to-cat");
var type_inference_1 = require("./type_inference");
function flattenFunctionIO(t) {
    if (t instanceof ti.TypeArray) {
        return [t.types[0]].concat(flattenFunctionIO(t.types[1]));
    }
    else {
        return [t];
    }
}
function functionInputToString(t) {
    return flattenFunctionIO(type_inference_1.functionInput(t)).map(typeToString).join(' ');
}
function functionOutputToString(t) {
    return flattenFunctionIO(type_inference_1.functionOutput(t)).map(typeToString).join(' ');
}
function typeToString(t) {
    if (type_inference_1.isFunctionType(t)) {
        return "(" + functionInputToString(t) + " -> " + functionOutputToString(t) + ")";
    }
    else if (t instanceof type_inference_1.TypeVariable) {
        return t.name;
    }
    else if (t instanceof type_inference_1.TypeConstant) {
        return t.name;
    }
    else if (t instanceof type_inference_1.TypeArray) {
        return "[" + t.types.map(typeToString).join(' ') + "]";
    }
}
// Some identities 
// NOTE: the intuitionistic logic part is interesting. 
// https://en.wikipedia.org/wiki/B,_C,_K,_W_system#Connection_to_intuitionistic_logic
exports.combinatorDefs = {
    "B": "S (K S) K",
    "C": "S (B B S)(K K)",
    "D": "B B",
    "E": "B (B B B)",
    "F": "E T T E T",
    "G": "B B C",
    "H": "B W (B C)",
    "I": "S K K",
    "J": "B (B C) (W (B C (B (B B B))))",
    "L": "C B M",
    "M": "S I I",
    "O": "S I",
    "Q": "C B",
    "R": "B B T",
    "T": "C I",
    "U": "L O",
    "V": "B C T",
    "W": "C (B M R)",
    "Y": "S L L",
    "S": "B (B W) (B B C)",
    "I2": "W K",
};
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
    // Basic composition tests
    ["[[pop]]", "!t0.(t0 -> (!t1.(t1 -> (!t3.(!t2.(t2 t3) -> t3) t1)) t0))"],
    ["[pop pop]", "!t0.(t0 -> (!t3.(!t1.(t1 !t2.(t2 t3)) -> t3) t0))"],
    ["pop []", "!t1.(!t0.(t0 t1) -> (!t2.(t2 -> t2) t1))"],
    ["[] pop", "!t0.(t0 -> t0)"],
    ["[pop []]", "!t0.(t0 -> (!t2.(!t1.(t1 t2) -> (!t3.(t3 -> t3) t2)) t0))"],
    ["[] []", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) t0)))"],
    ["[] dup", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) t0)))"],
    ["[] dup dup", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) (!t3.(t3 -> t3) t0))))"],
    ["dup pop", "!t0!t1.((t0 t1) -> (t0 t1))"],
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
    var r = ti.normalizeVarNames(inf);
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
    t = ti.alphabetizeVarNames(t);
    console.log(t.toString());
    t = cat_types_1.inferCatType("[id] dup [0 swap apply] swap quote compose apply [id] swap apply apply swap apply");
    t = ti.alphabetizeVarNames(t);
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
exports.lambdaTests = [
    ["(\\i.(i \\x.x) (i 0)) \\y.y", "Num"],
    ["(\\i.(i \\x.x) (i 0))", "?"],
    ["(\\i.(i 0)) \\y.y", "?"],
    ["(\\i.(i \\x.x)) \\y.y", "?"],
    ["0", "Num"],
    ["\\x.x", "!a.(a -> a)"],
    ["\\i.0", "!a.(a -> Num)"],
    ["\\i.i 0", "!a.((Num -> a) -> a)"],
    ["(\\i.0)", "!a.(a -> Num)"],
    ["(\\i.i 0)", "!a.((Num -> a) -> a)"],
    ["\\i.i (0)", "!a.((Num -> a) -> a)"],
    ["(\\i.0) \\y.y", "Num"],
    ["(\\i.0) (\\y.y)", "Num"],
    ["(\\i.i) \\y.y", "!a.(a -> a)"],
    ["(\\i.i) (\\y.y)", "!a.(a -> a)"],
    ["(\\i.i) (\\x.x) (\\y.y)", "!a.(a -> a)"],
];
function testRedex(x) {
    //var vars = Object.keys(freeVariables(x));
    //console.log("Free variables: " + vars);
    // TODO: proper alpha naming 
    // TODO: validate this in isolation 
    //var eta = etaConversion(x);
    //console.log("Eta reduction: " + eta);
    // TODO: valdiate this properly 
    //var lift = lambdaLift(x);
    //console.log("Lambda lifting: " + lift);
    // Convert to SKI combinators
    //var elim = abstractionElimination(x);
    //console.log("Abstraction elimination: " + elim);
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
function testCombinator(name, term, exp) {
    try {
        console.log("Testing Lambda term " + name);
        var redex = lambda_calculus_1.parseRedex(term);
        console.log("Parsed redex: " + redex);
        testRedex(redex);
        var ys = lambda_calculus_to_cat_1.lambdaToCat(redex);
        //console.log("Lambda Cat: " + ys.join(' '));
        var xs = cat_lambda_1.removeVars(ys);
        var cat = xs.join(' ');
        console.log("Pure Cat: " + cat);
        // TODO: test rewriting 
        // TODO: test converting back  
        var t = cat_types_1.inferCatType(cat);
        console.log("Inferred type: " + t);
        console.log("Simplified type: " + typeToString(t));
        if (exp != null)
            console.log("Expected type: " + exp);
    }
    catch (e) {
        console.log("ERROR: " + e.message);
    }
}
function testCombinators() {
    for (var k in combinatory_logic_1.combinators)
        testCombinator(k, combinatory_logic_1.combinators[k]);
}
function testLambdaTerms() {
    for (var _i = 0, lambdaTests_1 = exports.lambdaTests; _i < lambdaTests_1.length; _i++) {
        var lt = lambdaTests_1[_i];
        testCombinator(lt[0], lt[0], lt[1]);
    }
}
var catTestStrings = [
    "[] dup",
    "[[] dup]",
    "[] [dup]",
    "[] [dup] apply",
    "dup [0] dip apply",
    "dup [[0] dip apply []] dip",
    "[] dup [[0] dip apply []] dip apply",
    "dup [[0] dip apply []] dip apply",
    "dup [[0] dip apply []] dip apply apply",
    "[dup [[0] dip apply []] dip apply apply]",
    "[dup [[0] dip apply []] dip apply apply] apply",
    "[] [dup [[0] dip apply []] dip apply apply] apply",
    "[[0] dip apply []]",
    "[0] dip apply",
    "[0] dip",
    "[] []",
    "[] [0] dip",
    "[] dup [0] dip",
    "[] dup [0] dip apply",
    "[] dup [[0] dip apply []] dip",
    "[] dup [[0] dip apply []] dip apply",
    "[] dup [[0] dip apply []] dip apply apply",
    "[] [dup [[0] dip apply []] dip apply apply]",
    "[] [0] apply",
    "[] [[0] dip] apply",
];
ti.setTrace(true);
for (var _i = 0, catTestStrings_1 = catTestStrings; _i < catTestStrings_1.length; _i++) {
    var ct = catTestStrings_1[_i];
    var t = cat_types_1.inferCatType(ct);
    console.log("Type of " + ct + " : " + typeToString(t));
}
process.exit();
//# sourceMappingURL=cat-tests.js.map