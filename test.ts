import { TypeInference as ti } from "./type_inference";
import { Myna as m } from "./node_modules/myna-parser/myna";

function registerGrammars() 
{
    var typeGrammar = new function() 
    {
        var _this = this;
        this.typeExprRec            = m.delay(() => { return _this.typeExpr});
        this.typeList               = m.guardedSeq('(', m.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar                = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant           = m.identifier.ast;
        this.typeExpr               = m.choice(this.typeList, this.typeVar, this.typeConstant).ast;        
    }        

    m.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);    
}

registerGrammars();

var parser = m.parsers['type'];

function runTest(f:() => any, testName:string, expectFail:boolean = false) {
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

export function stringToType(input:string) : ti.Type {
    var ast = parser(input);
    if (ast.end != input.length) 
        throw new Error("Only part of input was consumed");
    return astToType(ast);
}

export function astToType(ast:m.AstNode) : ti.Type {
    if (!ast)
        return null;
    switch (ast.name)
    {
        case "typeVar":
            return ti.typeVar(ast.allText.substr(1));
        case "typeConstant":
            return ti.typeConstant(ast.allText);
        case "typeList":
            return ti.typeArray(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1) 
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default: 
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}


function testParse(input:string, fail:boolean=false)
{
    runTest(() => stringToType(input), input, fail);
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
testParse("(()()", true);
testParse("()()", true);
testParse("()())", true);
testParse("(a b", true);
testParse("a b", true);
testParse("a b)", true);

function testUnification(a:string, b:string, fail:boolean = false)
{
    runTest( () => {
        var engine = new ti.Unifier();
        var expr1 = stringToType(a);
        var expr2 = stringToType(b);
        engine.unifyTypes(expr1, expr2);
        return "success";
    }, "Unifying " + a + " with " + b, fail);
}

testUnification("'a", "int");
testUnification("int", "'a");
testUnification("int", "int");
testUnification("('a)", "(int)");
testUnification("('a (int 'b))", "(int (int (float string)))");
testUnification("'a", "('b int)");
testUnification("(function 'a 'b)", "(function (int int) float)");
testUnification("(function ('a 'b) 'b)", "(function (int (int int)) 'c)");
testUnification("(function ('a 'b) 'b)", "(function (int (int int)) ('c))", true);

/*
function testUnification(a:string, b:string, fail:boolean = false)
{
    runTest( () => {
        var engine = new ti.Unifier();
        var expr1 = stringToType(a);
        var expr2 = stringToType(b);
        engine.unifyTypes(expr1, expr2);
        return "success";
    }, "Unifying " + a + " with " + b, fail);
}
*/

/*
{
    console.log("Constraint Tests");

    {
        console.log("");
        console.log("## Test A");
        var i = new ti.Unifier();
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
*/

declare var process : any;
process.exit();
