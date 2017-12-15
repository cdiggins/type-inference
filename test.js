"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_parser_1 = require("./type_parser");
var ti = require("./type_inference");
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
testParse("(function (int (int 'a)) (float (float 'a)))");
function testUnification(a, b) {
    var engine = new ti.Inferer();
    var expr1 = ti.stringToType(a);
    var expr2 = ti.stringToType(b);
    engine.unifyTypes(expr1, expr2);
    engine.logState();
}
testUnification("'a", "int");
testUnification("int", "'a");
testUnification("int", "int");
testUnification("('a)", "(int)");
testUnification("('a (int 'b))", "(int (int (float string)))");
testUnification("'a", "['a int]");
testUnification("('a -> 'b)", "(int int -> float)");
process.exit();
{
    console.log("Constraint Tests");
    {
        console.log("");
        console.log("## Test A");
        var i = new ti.Inferer();
        var f = ti.functionType(["'x"], ["['x 'x 'x]"]);
        var inputs = ti.functionInput(f);
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test B");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeVariable('U'));
        var t2 = te.addVarConstraint('z', new ti.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t1, t2);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test C");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeArray([new ti.TypeConstant('int'), new ti.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new ti.TypeArray([new ti.TypeVariable('V'), new ti.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new ti.TypeArray([new ti.TypeVariable('U'), new ti.TypeVariable('V')]));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t0, t2);
        te.addReturnStatement(t3, null);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Recursion");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeArray([new ti.TypeVariable('T'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Row Variables");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeArray([new ti.TypeVariable('T'), new ti.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new ti.TypeArray([new ti.TypeConstant('int'), new ti.TypeConstant('float'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
}
process.exit();
//# sourceMappingURL=test.js.map