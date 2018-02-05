import { Type, typeConstant, typeVariable, typeArray } from "./type-system";
import { Myna as m } from "myna-parser"

// Defines syntax parsers for type expression, the lambda calculus, and Cat 
function registerGrammars() 
{
    // A simple grammar for parsing type expressions
    var typeGrammar = new function() 
    {
        var _this = this;
        this.typeExprRec    = m.delay(() => { return _this.typeExpr});        
        this.typeList       = m.guardedSeq('(', m.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar        = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant   = m.identifier.or(m.digits).or("->").or("*").or("[]").ast;
        this.typeExpr       = m.choice(this.typeList, this.typeVar, this.typeConstant).ast;        
    }      
    m.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);    
    
}

registerGrammars();

export const typeParser  = m.parsers['type'];

export function parseType(input:string) : Type {
    var ast = typeParser(input);
    if (ast.end != input.length) 
        throw new Error("Only part of input was consumed");
    return astToType(ast);
}

function astToType(ast) : Type {
    if (!ast)
        return null;
    switch (ast.name)
    {
        case "typeVar":
            return typeVariable(ast.allText.substr(1));
        case "typeConstant":
            return typeConstant(ast.allText);
        case "typeList":
            return typeArray(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1) 
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default: 
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}

