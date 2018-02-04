"use strict";
// This is a set of tests for the type-inference algorithm applied to lambda Calculus and the Concatenative calculus.
// Running these tests require installation of the Myna parsing module. 
Object.defineProperty(exports, "__esModule", { value: true });
var ti = require("./type_inference");
var type_parser_1 = require("./type-parser");
//==========================================================================================
// Testing helper functions 
function testParse(input, fail) {
    if (fail === void 0) { fail = false; }
    runTest(function () { return type_parser_1.parseType(input); }, input, fail);
}
exports.testParse = testParse;
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
exports.runTest = runTest;
function typeToString(t) {
    if (t instanceof ti.TypeVariable)
        return "'" + t.name;
    else if (t instanceof ti.TypeArray)
        return "(" + t.types.map(typeToString).join(" ") + ")";
    else
        return t.toString();
}
exports.typeToString = typeToString;
function compareTypes(t1, t2) {
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
exports.compareTypes = compareTypes;
/*
testCatTypes();
testLambdaCalculus();
testCombinators();
testCloning();
*/
// Passes in Cat!
//issue1InCat();
//issue1b();
//issue1();
//declare var process : any;
//process.exit();
//# sourceMappingURL=test.js.map