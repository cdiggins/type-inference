// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

import { Myna as m } from "./node_modules/myna-parser/myna";
import * as ti from "./type_inference";

export module TypeParser
{    
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

    export function stringToType(input:string) : ti.TypeExpr {
        var ast = parser(input);
        return astToType(ast);
    }

    export function astToType(ast:m.AstNode) : ti.TypeExpr {
        if (!ast)
            return null;
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
}