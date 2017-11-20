import { Myna as m } from "./node_modules/myna-parser/myna";
import { TypeInference as ti, TypeInference } from "./type_inference";

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

    m.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
    m.registerGrammar('cat', catGrammar, catGrammar.program);
}

RegisterGrammars();

function stringToType(input:string) : ti.TypeExpr {
    var ast = m.parse(m.grammars['type'].typeExpr, input);
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
    console.log("input = " + ti.typeToString(t));
}


TestParseType("abc");
TestParseType("'abc");
TestParseType("[]");
TestParseType("[ ]");
TestParseType("[a]");
TestParseType("[ab cd]");
TestParseType("[ab [cd] [ef]]");
TestParseType("[[][a][[]b]'abc]");

function TestConstraints(a:string, b:string)
{
    var engine = new ti.Engine();
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

declare var process : any;
process.exit();
