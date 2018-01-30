// A library of algorithms and data-structures for working with the simply untyped call-by-value Lambda calculus 
// extended with integer constants written in TypeScript.
//
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

import { Myna as m } from "myna-parser";

// A Myna grammar for parsing the lambda calculus with integers and boolean constants
// In this grammar abstraction has a higher precedence than application. This means: 
// \a.a \b.b == \a.(a (\b.(b))) 
var grammar = new function() 
{
    var _this = this;
    this.recExpr        = m.delay(() => _this.expr);
    this.var            = m.identifier.ast;
    this.number         = m.digits.ast;
    this.boolean        = m.keyword("true").or(m.keyword("false")).ast;
    this.abstraction    = m.guardedSeq("\\", this.var, ".").then(this.recExpr).ast;
    this.parenExpr      = m.guardedSeq("(", this.recExpr, ")").ast;
    this.expr           = m.choice(this.parenExpr, this.abstraction, this.boolean, this.number, this.var).then(m.ws).oneOrMore.ast;
}
m.registerGrammar('lambda', grammar, grammar.expr);    

// Parser for a lambda expression s
const lcParser    = m.parsers['lambda'];

//=======================================================================
// Helper classes 

export interface StringLookup {
    [name:string] : string;
}

//========================================================================
// Classes representing different types of Lambda expressions 

// A redex stands for reducible expression. It is also called a term.  
// It is any valid expression in our lambda calculus.
export class Redex {
    clone(lookup: StringLookup) : Redex {
        throw new Error("clone needs to be implemented in an derived class");
    }
}

// Represents constants like integers or booleans. 
export class RedexValue<T> extends Redex {
    constructor(
        public readonly value:T) 
    { 
        super();         
    }

    toString() : string {
        return this.value.toString();
    }

    clone(lookup:StringLookup) : RedexValue<T> {
        return new RedexValue<T>(this.value);
    }
}

// Represents names which might be free or bound variables
export class RedexName extends Redex {
    constructor(
        public readonly name:string)
    { 
        super();
    }

    toString() : string {
        return this.name.toString();
    }

    clone(lookup:StringLookup) : RedexName {
        return new RedexName(rename(this.name, lookup));               
    }
}

// Represents the application of a function value to an argument value.
// In the lambda calculus this can be written as `f(x)` or simply `f x`
export class RedexApplication extends Redex {
    constructor(
        public readonly func:Redex,
        public readonly args:Redex)
    { 
        super();
    }

    toString() : string {
        return this.func + "(" + this.args + ")";
    }

    clone(lookup:StringLookup={}) : RedexApplication {
        return new RedexApplication(this.func.clone(lookup), this.args.clone(lookup));
    }
}

// Represents a Lambda abstraction. Also called an anonymous function. 
// In the Lambda calculus all functions take one argument and return one value.
export class RedexAbstraction extends Redex {
    constructor(
        public readonly param:string,
        public readonly body:Redex    
    )
    {
        super();
    }

    toString() : string {
        return "\\" + this.param + "." + "(" + this.body + ")";
    }

    clone(lookup:StringLookup={}) : RedexAbstraction {
        return new RedexAbstraction(rename(this.param, lookup), this.body.clone(lookup));
    }
}

//===============================================================================
// Parsing functions

// Converts a string to a lambda expression (aka a reducible expression)
export function parseRedex(s:string) : Redex {
    var ast = lcParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");    
    return astToRedex(ast);
}

// Converts an abstract syntax tree representation to an expression
function astToRedex(ast:m.AstNode) : Redex {
    switch (ast.rule.name) 
    {
        case "abstraction":
            return new RedexAbstraction(ast.children[0].allText, astToRedex(ast.children[1]));
        case "parenExpr":
            return astToRedex(ast.children[0]);
        case "var":
            return new RedexName(ast.allText);
        case "boolean":
            return new RedexValue(ast.allText.toLowerCase() == 'true');
        case "number":
            return new RedexValue(parseInt(ast.allText));
        case "expr":
            {      
                var r = astToRedex(ast.children[0]);
                for (var i=1; i < ast.children.length; ++i) {
                    var cur = astToRedex(ast.children[i])
                    r = new RedexApplication(r, cur);
                }                
                return r;
            }
        default:
            throw new Error("Unrecognized ast rule " + ast.rule);
    }
}

//===============================================================================
// Helper functions

// Returns the expression and all of its sub-expressions as an array 
export function getSubExpressions(exp:Redex, r:Redex[] = []) : Redex[] {
    r.push(exp);
    if (exp instanceof RedexApplication) {
        getSubExpressions(exp.func, r);
        getSubExpressions(exp.args, r);
    }
    else if (exp instanceof RedexAbstraction) {
        getSubExpressions(exp.body, r);
    }
    return r;
}

// Converts an array of strings to a string->string lookup table 
export function stringsToObject(strings:string[]) : StringLookup {
    var r:StringLookup = {};
    for (var s of strings)
        r[s] = s;
    return r;
}

// Converts the keys of an object ot an array of sorted strings 
export function keysAsStrings(object:any) : string[] {        
    return Object.keys(object).sort();
}

// Returns a string corresponding value in the lookup table, if present. 
export function rename(name:string, lookup:StringLookup) : string {
    return name in lookup ? lookup[name] : name;
}

// Returns a reversed copy of a string 
export function reverse<T>(xs:T[]) : T[] {
    return xs.slice(0).reverse();
}

// Returns all variables that are not parameters
export function freeVariables(exp:Redex, r:StringLookup={}, vars:StringLookup={}) : StringLookup {
    if (exp instanceof RedexAbstraction) {
        return freeVariables(exp.body, r, { ...vars, ...stringsToObject([exp.param]) });
    }
    else if (exp instanceof RedexApplication)  {
        freeVariables(exp.func, r, vars);
        return freeVariables(exp.args, r, vars);
    }
    else if (exp instanceof RedexName) {
        if (!(exp.name in vars))
            r[exp.name] = exp.name;                            
        return r;
    }
}

// Returns true if the named variable occurs in the expression
export function isFreeVariableIn(v:string, exp:Redex) : boolean {
    return v in freeVariables(exp);
}

// Converts an expression by lifting a free variable out into an argument of an abstraction
// and applying that abstraction to a variable with the name. (i) => (\i.(i))(i)
// This is a- step of the lambda lift operation
export function lambdaLiftVar(v:string, exp:Redex) : Redex {
    return new RedexApplication(new RedexAbstraction(v, exp), new RedexName(v));
}

// Removes all free variables from an expression
export function lambdaLift(exp:Redex) : Redex {
    if (exp instanceof RedexAbstraction) {
        var r:Redex = new RedexAbstraction(exp.param, lambdaLift(exp.body));
        const freeVars:string[] = keysAsStrings(freeVariables(r));
        for (var v of freeVars) 
            r = lambdaLiftVar(v, r);
        return r;
    } 
    else if (exp instanceof RedexApplication) {
        return new RedexApplication(lambdaLift(exp.func), lambdaLift(exp.args));
    }
    else {
        return exp;
    }
} 

// Returns true is the redex is a variable and if a name is provided, matches the ame 
export function isVar(exp:Redex, name:string = null) : boolean {
    if (exp instanceof RedexName) {
        if (name == null)
            return true;
        return exp.name == name;
    }
    return false;
}

// http://www.lambda-bound.com/book/lambdacalc/node21.html
// https://en.wiktionary.org/wiki/eta_conversion
export function etaConversion(exp:Redex) : Redex {
    if (exp instanceof RedexAbstraction) {
        var body = exp.body;
        if (body instanceof RedexApplication)
            if (isVar(body.args, exp.param)) 
                if (!isFreeVariableIn(exp.param, body.func))
                    return body;
    }
    return exp;
}