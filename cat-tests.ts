import { TypeInference as ti } from "./type_inference";
import { compareTypes } from "./test";
import { parseType } from "./type-parser";
import { parseCat, CatExpr, CatQuotation } from "./cat-parser";
import { catTypes, inferCatType } from "./cat-types";
import { uniquelyNameVars, getVarUsages, removeVars, makeVarsSingleUse } from "./cat-lambda";
import { parseRedex, freeVariables, etaConversion, Redex, lambdaLift } from "./lambda-calculus";
import { abstractionElimination, combinators, combinatorToLambdaCalculus } from "./combinatory-logic";
import { lambdaToPureCat, lambdaToCat } from "./lambda-calculus-to-cat";
import { catStdOps } from "./cat-library";

const catTests = [
    // Primitive forms 
    ["", "!t0.(t0 -> t0)"],
    ["id", "!t0!t1.((t0 t1) -> (t0 t1))"],
    ["apply", "!t1.(!t0.((t0 -> t1) t0) -> t1)"],
    ["compose", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) t3))"],
    ["quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) t1))"],
    ["dup", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))"],
    ["swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t0 t2)))"],
    ["pop", "!t1.(!t0.(t0 t1) -> t1)"],

    // Quotations of Primitives 
    ["[]", "!t0.(t0 -> (!t1.(t1 -> t1) t0))"],
    ["[id]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (t1 t2)) t0))"],
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
    ["swap quote compose apply", "!t1!t2.(!t0.((t0 -> t1) (t2 t0)) -> (t2 t1))"], // Dip

    // Various tests
    ["swap quote compose apply pop", "!t1.(!t0.((t0 -> t1) !t2.(t2 t0)) -> t1)"], // Dip pop == pop apply 
    ["[id] dup 0 swap apply swap [id] swap apply apply", "!t0.(t0 -> (Num t0))"], // Issue reported by StoryYeller
];

function printCatTypes() {
    for (var k in catTypes) {
        var ts = catTypes[k];
        var t = parseType(ts);
        console.log(k);
        console.log(ts);
        console.log(t.toString());
    }
}

function testCatType(term:string, type:string) {
    var exp = type;
    var inf = inferCatType(term);
    var r = ti.normalizeVarNames(inf) as ti.TypeArray;
    if (r.toString() != exp) {
        console.log("FAILED: " + term + " + expected " + exp + " got " + r);
    }
    else {
        console.log("PASSED: " + term + " : " + exp);
    }
}

function testCatTypes() {
    console.log("Testing Cat expression inference")
    for (var xs of catTests) 
        testCatType(xs[0], xs[1]);
}

function issue1InCat() {
    var t = inferCatType("");
    t = ti.alphabetizeVarNames(t) as ti.TypeArray;
    console.log(t.toString());

    t = inferCatType("[id] dup [0 swap apply] swap quote compose apply [id] swap apply apply swap apply")
    t = ti.alphabetizeVarNames(t) as ti.TypeArray;
    console.log(t.toString());
}

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

const lambdaCatTests = [
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
const lambdaCatCombinators = {
    i       : "\\x @x", 
    k       : "\\x [\\y @x]", 
    s       : "\\x [\\y [\\z @y @z apply @z @x apply apply]]",
    b       : "\\x [\\y [\\z @z @y apply @x apply]]",
    c       : "\\x [\\y [\\z @z @y @x apply apply]]",
    w       : "\\x [\\y [@y @y @x apply apply]]",
    m       : "\\x [@x @x apply]",
    issue   : "[\\x @x] [\\i 0 @i apply [\\x @x] @i apply apply] apply"
}

function testRedex(x: Redex) 
{
    var vars = Object.keys(freeVariables(x));
    console.log("Free variables: " + vars);

    // TODO: proper alpha naming 
    
    // TODO: validate this in isolation 
    //var eta = etaConversion(x);
    //console.log("Eta reduction: " + eta);
    
    // TODO: valdiate this properly 
    //var lift = lambdaLift(x);
    //console.log("Lambda lifting: " + lift);

    // Convert to SKI combinators
    var elim = abstractionElimination(x);
    console.log("Abstraction elimination: " + elim);

    // Produces very long terms  
    //var combinator = combinatorToLambdaCalculus(elim);
    //console.log("As combinators: " + combinator);    
}

function testLambdaToCat(s: string) {
    const redex = parseRedex(s);
    const xs = lambdaToPureCat(redex);
    console.log("Lambda expression: " + s);
    console.log("Cat expression: "  + xs.join(' '));
}

function printCatType(s: string) {
    try {
        var t = inferCatType(s);
        console.log("Inferred type: " + t);
    }
    catch (e) {
        console.log("FAILED: " + e.message);
    }
}

function testCombinator(name: string, def: string) {
    console.log("Testing combinator " + name);
    const t = combinators[name];
    const redex = parseRedex(t);
    console.log("Parsed redex: " + redex);
    testRedex(redex);
    const ys = lambdaToCat(redex);
    console.log("Lambda Cat: " + ys.join(' '));
    const xs = removeVars(ys);
    var cat = xs.join(' '); 
    console.log("Pure Cat: " + cat);
    // TODO: test rewriting 
    // TODO: test converting back  
    printCatType(cat);
}

for (var k in combinators) 
{
    testCombinator(k, combinators[k]);
}

testCatTypes();

// TODO: list the Cat core operators 

declare var process;
process.exit();