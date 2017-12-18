import { TypeInference as ti } from "./type_inference";
import { Myna as m } from "./node_modules/myna-parser/myna";

function registerGrammars() 
{
    // This is a more verbose type grammar than the one used in Cat. 
    var typeGrammar = new function() 
    {
        var _this = this;
        this.typeExprRec            = m.delay(() => { return _this.typeExpr});
        this.typeList               = m.guardedSeq('(', m.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar                = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant           = m.identifier.or("->").or("*").or("[]").ast;
        this.typeExpr               = m.choice(this.typeList, this.typeVar, this.typeConstant).ast;        
    }        

    m.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);    
}

registerGrammars();

var parser = m.parsers['type'];

/*
// Converts a type int a conveneient string representation
export function typeToString(t:ti.Type) : string {
    if (ti.isFunctionType(t) && t instanceof ti.TypeArray) {
        return t.typeSchemeToString() + "(" 
            + typeToString(ti.functionInput(t)) + " -> " 
            + typeToString(ti.functionOutput(t)) + ")";
    }
    else if (t instanceof ti.TypeArray) {
        return t.typeSchemeToString() + "(" + t.types.map(typeToString).join(" ") + ")";
    }
    else {
        return t.toString();
    }
}*/

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

function testClone(input:string, fail:boolean=false) {
    runTest(() => {
        var t = stringToType(input);
        console.log("Original   : " + t);
        t = ti.clone(t);
        console.log("Cloned     : " + t);
        t = ti.generateFreshNames(t, 0);
        console.log("Fresh vars : " + t);
        t = ti.normalizeVarNames(t);
        console.log("Normalized : " + t);
        return true;
    }, input, fail);
}

function runCloneTests() 
{
    testClone("('a)");
    testClone("('a 'b)");
    testClone("('a ('b))");
    testClone("('a ('b) ('a))");
    testClone("('a ('b) ('a ('c) ('c 'd)))");
    testClone("('a -> 'b)");
    testClone("(('a *) -> int)");
    testClone("(('a 'b) -> ('b 'c))");
    testClone("(('a ('b 'c)) -> ('a 'c))");
    for (var k in coreTypes)
        testClone(coreTypes[k]);
}

function testParse(input:string, fail:boolean=false)
{
    runTest(() => stringToType(input), input, fail);
}

var coreTypes = {
    apply   : "((('a -> 'b) 'a) -> 'b)",
    compose : "((('b -> 'c) (('a -> 'b) 'd)) -> (('a -> 'c) 'd))",
    quote   : "(('a 'b) -> (('c -> ('a 'c)) 'b))",
    dup     : "(('a 'b) -> ('a ('a 'b)))",
    swap    : "(('a ('b 'c)) -> ('b ('a 'c)))",
    pop     : "(('a 'b) -> 'b)",
};

function runParseTests()
{
    testParse("abc");
    testParse("'abc");
    testParse("()");

    testParse("( )");
    testParse("(a)");
    testParse("('a)");
    testParse("(array int)");
    testParse("(array 't)");
    testParse("(fun int 't ())");
    testParse("(fun int float)");
    testParse("(()())");
    testParse("(fun (int (int 'a)) (float (float 'a)))");
    testParse("(()()", true);
    testParse("()()", true);
    testParse("()())", true);
    testParse("(a b", true);
    testParse("a b", true);
    testParse("a b)", true);

    for (var k in coreTypes) 
        testParse(coreTypes[k])
}

function testComposition(a:string, b:string, fail:boolean = false)
{
    runTest( () => {        
        var expr1 = stringToType(a);
        console.log("Type A: " + expr1.toString());
        
        var expr2 = stringToType(b);
        console.log("Type B: " + expr2.toString());

        var r = ti.composeFunctions(expr1 as ti.TypeArray, expr2 as ti.TypeArray);
        console.log("Composed type: " + r.toString())

        // Return a prettified version of the function
        r = ti.normalizeVarNames(r) as ti.TypeArray;        
        return r.toString();
    }, 
    "Composing " + a + " with " + b, 
    fail);
}

function testUnifyChain(ops:string[]) {
    var t1 = coreTypes[ops[0]];
    var t2 = coreTypes[ops[1]];
    testComposition(t1, t2);
}

function testComposingCoreOps() {
    for (var op1 in coreTypes) {
        for (var op2 in coreTypes) {
            console.log(op1 + " " + op2);
            testComposition(coreTypes[op1], coreTypes[op2]);
        }
    }
}

function printCoreTypes() {
    for (var k in coreTypes) {
        var ts = coreTypes[k];
        var t = stringToType(ts);
        console.log(k);
        console.log(ts);
        console.log(t.toString());
    }
}

//runParseTests()
//runCloneTests();
//printCoreTypes();
testComposingCoreOps();

declare var process : any;
process.exit();
