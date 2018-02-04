// This is a set of tests for the type-inference algorithm applied to lambda Calculus and the Concatenative calculus.
// Running these tests require installation of the Myna parsing module. 

// TODO: reject recursion and jump out.  
// TODO: check identities
// TODO: from Cat to Lambda-cat (dup/pop/papply/dip)
// TODO: rewriting rules
// TODO: simplify the type presentation (real parseable version)
// TODO: make type presentation look like TypeScript types 
// TODO: make type presentation look like Haskell types

import * as ti from "./type_inference";
import { compareTypes } from "./test";
import { parseType } from "./type-parser";
import { parseCat, CatExpr, CatQuotation } from "./cat-parser";
import { catTypes, inferCatType } from "./cat-types";
import { uniquelyNameVars, getVarUsages, removeVars, makeVarsSingleUse } from "./cat-lambda";
import { parseRedex, freeVariables, etaConversion, Redex, lambdaLift } from "./lambda-calculus";
import { abstractionElimination, combinators, combinatorToLambdaCalculus } from "./combinatory-logic";
import { lambdaToPureCat, lambdaToCat } from "./lambda-calculus-to-cat";
import { catStdOps } from "./cat-library";
import { Type, isFunctionType, functionInput, TypeArray, TypeVariable, TypeConstant, functionOutput } from "./type_inference";

//==========================================================================================
// Testing helper functions 

export function testParse(input:string, fail:boolean=false) {
    runTest(() => parseType(input), input, fail);
}

export function runTest(f:() => any, testName:string, expectFail:boolean = false) {
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

export function typeToString(t:ti.Type) : string {
    if (t instanceof ti.TypeVariable) 
        return "'" + t.name;
    else if (t instanceof ti.TypeArray) 
        return "(" + t.types.map(typeToString).join(" ") + ")";
    else 
        return t.toString();
}

export function compareTypes(t1:ti.Type, t2:ti.Type) {
    {
        var r1 = ti.normalizeVarNames(t1).toString();
        var r2 = ti.normalizeVarNames(t2).toString();
        if (r1 != r2) {
            throw new Error("Types are not the same when normalized: " + r1 + " and " + r2);
        }
    }
    {
        var r1 = ti.alphabetizeVarNames(t1).toString();
        var r2 = ti.alphabetizeVarNames(t2).toString();
        if (r1 != r2) {
            throw new Error("Types are not the same when alphabetized: " + r1 + " and " + r2);
        }
    } 
}

function flattenFunctionIO(t: Type): Type[] {
    if (t instanceof ti.TypeArray) {
        return [t.types[0], ...flattenFunctionIO(t.types[1])];
    }
    else {
        return [t];
    }
}

function functionInputToString(t: Type): string {
    return flattenFunctionIO(functionInput(t)).map(typeToString).join(' ')
}

function functionOutputToString(t: Type): string {
    return flattenFunctionIO(functionOutput(t)).map(typeToString).join(' ')
}

function typeToString(t: Type): string {
    if (isFunctionType(t)) {
        return "(" + functionInputToString(t) + " -> " + functionOutputToString(t) + ")";
    }    
    else if (t instanceof TypeVariable) {
        return t.name; 
    }
    else if (t instanceof TypeConstant) {
        return t.name;
    }
    else if (t instanceof TypeArray) {
        return "[" + t.types.map(typeToString).join(' ') + "]";
    }
}

// Some identities 
// NOTE: the intuitionistic logic part is interesting. 
// https://en.wikipedia.org/wiki/B,_C,_K,_W_system#Connection_to_intuitionistic_logic
export const combinatorDefs = {    
    "B" : "S (K S) K",
    "C" : "S (B B S)(K K)",
    "D" : "B B",
    "E" : "B (B B B)",
    "F" : "E T T E T",
    "G" : "B B C",
    "H" : "B W (B C)",
    "I" : "S K K",
    "J" : "B (B C) (W (B C (B (B B B))))",
    "L" : "C B M",
    "M" : "S I I",
    "O" : "S I",
    "Q" : "C B",
    "R" : "B B T",
    "T" : "C I",
    "U" : "L O",
    "V" : "B C T",
    "W" : "C (B M R)",
    "Y" : "S L L", 
    "S" : "B (B W) (B B C)",
    "I2" : "W K",

    // TODO: test the arithmetic identities 
}


const catTests = [
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

export const lambdaTests = [    
    ["(\\i.(i \\x.x) (i 0)) \\y.y", "Num"], // This cu\rrently fails: just like it does with HM
    ["(\\i.(i \\x.x) (i 0))", "?"], // This cu\rrently fails: just like it does with HM
    ["(\\i.(i 0)) \\y.y", "?"], // This cu\rrently fails: just like it does with HM
    ["(\\i.(i \\x.x)) \\y.y", "?"], // This cu\rrently fails: just like it does with HM
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
    ["(\\i.i) (\\x.x) (\\y.y)","!a.(a -> a)"],
];

function testRedex(x: Redex) 
{
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

function testCombinator(name: string, term: string, exp?: string) {
    try {
        console.log("Testing Lambda term " + name);
        const redex = parseRedex(term);
        console.log("Parsed redex: " + redex);
        testRedex(redex);
        const ys = lambdaToCat(redex);
        //console.log("Lambda Cat: " + ys.join(' '));
        const xs = removeVars(ys);
        const cat = xs.join(' '); 
        console.log("Pure Cat: " + cat);
        // TODO: test rewriting 
        // TODO: test converting back  
        const t = inferCatType(cat);
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
    for (var k in combinators) 
        testCombinator(k, combinators[k]);
}

function testLambdaTerms() {
    for (var lt of lambdaTests) 
        testCombinator(lt[0], lt[0], lt[1]);
}

const catTestStrings = [
    "[] dup",
    "[[] dup]",
    "[] [dup]",
    "[] [dup] apply",
    "dup [0] dip apply", // Is recursive. Not surprising. 
    "dup [[0] dip apply []] dip", // what is type?
    "[] dup [[0] dip apply []] dip apply", // Should not fail
    "dup [[0] dip apply []] dip apply", // fails
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

function testCatTerms() {
    for (var ct of catTestStrings) {
        const t = inferCatType(ct);
        console.log("Type of " + ct + " : " + typeToString(t));
    }
}

//testCatTypes();
//testCombinators();
//testLambdaTerms();
// A B => A [B] apply 
// A B => [A] apply B 
// A B => A B apply 
//ti.setTrace(true);

// Type of [dup [[0] dip apply []] dip apply apply] apply : !t1.((((Num !t0.((t0 -> t1) t0)) -> !t2.((t2 -> t1) t2)) !t3.((t3 -> t1) t3)) -> t1)
// Type of [] [dup [[0] dip apply []] dip apply apply] : !t0.(t0 -> (!t2.((((Num !t1.((t1 -> t2) t1)) -> !t3.((t3 -> t2) t3)) !t4.((t4 -> t2) t4)) -> t2) (!t5.(t5 -> t5) t0)))

declare var process;
process.exit();


