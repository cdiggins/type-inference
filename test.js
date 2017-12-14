"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_inference_1 = require("./type_inference");
var type_parser_1 = require("./type_parser");
function typeList(types) {
}
function arrayType(type) {
    return;
}
function functionType(input, output) {
    return typeList(['function', input, output]);
}
function composeFunctions(inA, outA, inB, outB) {
}
function testParse(input, fail) {
    if (fail === void 0) { fail = false; }
    try {
        var t = type_parser_1.TypeParser.stringToType(input);
        console.log("input = " + input + " result= " + t);
    }
    catch (e) {
        console.log("input = " + input + " error= " + e);
    }
}
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
testParse("[function ['a 'b] ['c 'd]]");
function TestConstraints(a, b) {
    var engine = new type_inference_1.TypeInferenceCore.Engine();
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
{
    console.log("Constraint Tests");
    {
        console.log("");
        console.log("## Test A");
        var te = new type_inference_1.TypeInferenceCore.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInferenceCore.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInferenceCore.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test B");
        var te = new type_inference_1.TypeInferenceCore.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInferenceCore.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInferenceCore.TypeVariable('U'));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInferenceCore.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t1, t2);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test C");
        var te = new type_inference_1.TypeInferenceCore.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInferenceCore.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeConstant('int'), new type_inference_1.TypeInferenceCore.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeVariable('V'), new type_inference_1.TypeInferenceCore.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeVariable('U'), new type_inference_1.TypeInferenceCore.TypeVariable('V')]));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t0, t2);
        te.addReturnStatement(t3, null);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Recursion");
        var te = new type_inference_1.TypeInferenceCore.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInferenceCore.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeVariable('T'), new type_inference_1.TypeInferenceCore.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Row Variables");
        var te = new type_inference_1.TypeInferenceCore.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeVariable('T'), new type_inference_1.TypeInferenceCore.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInferenceCore.TypeList([new type_inference_1.TypeInferenceCore.TypeConstant('int'), new type_inference_1.TypeInferenceCore.TypeConstant('float'), new type_inference_1.TypeInferenceCore.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
}
process.exit();
//# sourceMappingURL=test.js.map