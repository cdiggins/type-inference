import { TypeCore } from "./type_core";
import { TypeParser as tp } from "./type_parser";
import * as ti from "./type_inference";

function testParse(input:string, fail:boolean=false)
{        
    try
    {
        var t = tp.stringToType(input);
        console.log("input = " + input + " result= " + t);
    }
    catch (e)
    {
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

function TestConstraints(a:string, b:string)
{
    var engine = new ti.Inferer();
    var expr1 = ti.stringToType(a);
    var expr2 = ti.stringToType(b);
    engine.unifyTypes(expr1, expr2);
    engine.logState();
}

TestConstraints("'a", "int");
TestConstraints("int", "'a");
TestConstraints("int", "int");
TestConstraints("['a]", "[int]");
TestConstraints("['a int 'b]", "[int int float string]");
TestConstraints("'a", "['a int]");
TestConstraints("('a -> 'b)", "(int int -> float)");

declare var process : any;
process.exit();

{
    console.log("Constraint Tests");

    {
        console.log("");
        console.log("## Test A");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeConstant('int'));
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
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeConstant('int'), new ti.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new ti.TypeList([new ti.TypeVariable('V'), new ti.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new ti.TypeList([new ti.TypeVariable('U'), new ti.TypeVariable('V')]));
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
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeVariable('T'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }

    {
        console.log("");
        console.log("## Test Row Variables");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeList([new ti.TypeVariable('T'), new ti.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeConstant('int'), new ti.TypeConstant('float'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
}

declare var process : any;
process.exit();
