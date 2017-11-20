import { TypeInference as ti } from "./type_inference";
import { Myna as m } from "./node_modules/myna-parser/myna";

export function typeToString(t:ti.TypeExpr) : string {
    if (t instanceof ti.TypeVariable) 
        return "'" + t.name;
    else if (t instanceof ti.TypeConstant) 
        return t.name;
    else if (t instanceof ti.TypeList)
        return "[" + t.types.map(typeToString).join(" ") + "]";
    else 
        throw new Error("Can't recognize type " + t);
}

function RegisterGrammars() 
{
    var typeGrammar = new function() 
    {
        var _this = this;
        this.typeExprRec            = m.delay(() => { return _this.typeExpr});
        this.typeList               = m.guardedSeq('[', m.ws, this.typeExprRec.ws.zeroOrMore, ']').ast;
        this.typeVar                = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant           = m.identifier.ast;
        this.typeExpr               = m.choice(this.typeList, this.typeVar, this.typeConstant).ast;        
    }        

    var catGrammar = new function() 
    {
        var _this = this;
        this.recTerm = m.delay(() => { return _this.term; });
        this.quotation = m.guardedSeq('[', m.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term = m.choice(this.quotation, m.identifier, m.integer).ast; 
        this.definedName = m.identifier.ast;
        this.definition = m.guardedSeq(m.keyword('define').ws, this.definedName, m.guardedSeq('{', this.term.zeroOrMore, '}')).ast;
        this.program = m.choice(this.definition, this.term).zeroOrMore.ast;
    }    

    m.registerGrammar("type", typeGrammar, typeGrammar.typeExpr);
    m.registerGrammar("cat", catGrammar, catGrammar.program);

    function stringToType(input:string) : ti.TypeExpr {
        var ast = m.parse(typeGrammar.typeExpr, input);
        return astToType(ast);
    }

    function astToType(ast:m.AstNode) : ti.TypeExpr {
        if (!ast)
            throw new Error("Missing AST node");
        switch (ast.name)
        {
            case "typeVar":
                return new ti.TypeVariable(ast.allText.substr(1));
            case "typeConstant":
                return new ti.TypeConstant(ast.allText);
            case "typeList":
                return new ti.TypeList(ast.children.map(astToType));
            case "typeExpr":
                if (ast.children.length != 1) 
                    throw new Error("Expected only one child of node, not " + ast.children.length);
                return astToType(ast.children[0]);
            default: 
                throw new Error("Unrecognized type expression: " + ast.name);
        }
    }

    function TestParseType(input:string)
    {        
        var ast = m.parsers["type"](input);
        // console.log(ast);
        var t = astToType(ast);
        console.log("input = " + typeToString(t));
    }

    TestParseType("abc");
    TestParseType("'abc");
    TestParseType("[]");
    TestParseType("[ ]");
    TestParseType("[a]");
    TestParseType("[ab cd]");
    TestParseType("[ab [cd] [ef]]");
    TestParseType("[[][a][[]b]'abc]");
}

RegisterGrammars();

function printVarType(name:string, t:ti.TypeExpr) {
    console.log(name + " : " + typeToString(t));
}

function printConstraint(tc:ti.TypeConstraint) {
    console.log("type constraint " + typeToString(tc.typeSrc) + " <=> " + typeToString(tc.typeDest));
}

function printUnifier(name:string, u:ti.TypeUnifier, te:ti.Engine) {
    var t = te.getUnifiedType(u.unifier);
    console.log("Type unifier for " + name 
        + ", variable " + typeToString(u.variable) 
        + ", unifier " + typeToString(t)
        + ", raw type " + typeToString(u.unifier));
    }

function printEngineState(te:ti.Engine) {
    console.log("# Type Inference Engine State");
    console.log("## Variables");
    for (var v in te.varToType) 
        printVarType(v, te.varToType[v]);    
    console.log("## Constraints");
    for (var tc of te.constraints) 
        printConstraint(tc);
    console.log("## Type Unifiers");
    for (var k in te.unifiers) 
        printUnifier(k, te.unifiers[k], te);
}

{
    console.log("Constraint Tests");

    {
        console.log("");
        console.log("# Test A");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test B");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeVariable('U'));
        var t2 = te.addVarConstraint('z', new ti.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t1, t2);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test C");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeConstant('int'), new ti.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new ti.TypeList([new ti.TypeVariable('V'), new ti.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new ti.TypeList([new ti.TypeVariable('U'), new ti.TypeVariable('V')]));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t0, t2);
        te.addReturnStatement(t3, null);
        te.resolve();
        printEngineState(te);
    }

    {
        console.log("");
        console.log("# Test Recursion");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeVariable('T'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }

    {
        console.log("");
        console.log("# Test Row Variables");
        var te = new ti.Engine();
        var t0 = te.addVarConstraint('x', new ti.TypeList([new ti.TypeVariable('T'), new ti.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new ti.TypeList([new ti.TypeConstant('int'), new ti.TypeConstant('float'), new ti.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }
}

declare var process : any;
process.exit();
