// A parser for a super-set of the Cat language called Lambda-Cat 
// which includes variables. In Lambda-Cat the introduction of a variable is denoted by \x.
// 
// This is inspired by the work of Brent Kerby, but is modified http://tunes.org/~iepos/joy.html
//
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

import { Myna as m } from "myna-parser";

// Defines a Myna grammar for parsing Cat expressions that support the introduction and usage of scoped variables. 
export const catGrammar = new function() 
{
    var _this = this;
    this.identifier     = m.identifier.ast;
    this.param          = m.guardedSeq('\\', this.identifier).ast;
    this.var            = m.guardedSeq('@', this.identifier).ast;
    this.match          = m.guardedSeq('$', this.identifier).ast;
    this.integer        = m.integer.ast;
    this.true           = m.keyword("true").ast;
    this.false          = m.keyword("false").ast;
    this.recTerm        = m.delay(() => { return _this.term; });
    this.recTerms       = m.delay(() => { return _this.terms; });
    this.quotation      = m.guardedSeq('[', m.ws, this.recTerms, m.ws, ']').ast;
    this.term           = m.choice(this.param, this.var, this.quotation, this.integer, this.true, this.false, this.identifier); 
    this.terms          = m.ws.then(this.term.ws.zeroOrMore).ast;
}    

m.registerGrammar('cat', catGrammar, catGrammar.terms);    
export const catParser  = m.parsers['cat'];

export function parseCat(s:string) : CatExpr[] {
    var ast = catParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");        
    return ast.children.map(astToCat);
}

export function astToCat(ast:m.AstNode) : CatExpr {
    switch (ast.name) {
        case "param":
            return new CatParam(ast.allText.slice(1));
        case "identifier":
            return new CatInstruction(ast.allText);
        case "var":
            return new CatVar(ast.allText.slice(1));
        case "match":
            return new CatCapture(ast.allText.slice(1));
        case "true":
            return new CatConstant(true);
        case "false":
            return new CatConstant(false);
        case "integer":
            return new CatConstant(parseInt(ast.allText));
        case "quotation":
            return new CatQuotation(ast.children.map(astToCat));
        default:
            throw new Error("Unrecognized AST type " + ast.name);
    }
}

export class CatExpr {
}

export class CatParam extends CatExpr {
    constructor(public readonly name:string) { 
        super(); 
    }
    public toString() : string {
        return '\\' + this.name;
    }
}

export class CatVar extends CatExpr {
    constructor(public readonly name:string) { 
        super(); 
    }
    public toString() : string {
        return '@' + this.name;
    }
}

export class CatCapture extends CatExpr {
    constructor(public readonly name:string) { 
        super(); 
    }
    public toString() : string {
        return '%' + this.name;
    }
}

export class CatQuotation extends CatExpr {    
    constructor(public readonly terms:CatExpr[]) { 
        super(); 
    }
    public toString() : string {
        return "[" + this.terms.join(" ") + "]";
    }
    splice(pos: number, delCount: number, ...terms: CatExpr[]): CatQuotation {
        var r = this.terms.slice();
        r.splice(pos, delCount, ...terms);
        return new CatQuotation(r);
    }    
    delete(pos: number, delCount: number): CatQuotation {
        return this.splice(pos, delCount);
    }
    insert(pos: number, ...terms: CatExpr[]): CatQuotation {
        return this.splice(pos, 0, ...terms);
    }
    prepend(...terms: CatExpr[]): CatQuotation {
        return this.insert(0, ...terms);
    }    
    append(...terms: CatExpr[]): CatQuotation {
        return this.insert(this.terms.length, ...terms)
    }
}

export class CatConstant<T> extends CatExpr {    
    constructor(public readonly value:T) {
        super();
    }
    public toString() : string {
        return this.value.toString();
    }
}

export class CatInstruction extends CatExpr {
    constructor(public readonly name:string) { 
        super(); 
    }
    public toString() : string {
        return this.name;
    }
}