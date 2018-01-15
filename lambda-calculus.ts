// A library of algorithms and data-structures for working with the Lambda calculus 
// as a programming language written in TypeScript. Includes a parser, evaluator, and 
// a lambda lifting algorithim.  
//
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

import { Myna as m } from "./node_modules/myna-parser/myna";

// This module implements a Lambda calculus parser, evaluator, and helper functions.
// We have extended the lambda calculus with integer and boolean constants.
// This is an untyped, call-by-value lambda calculus extended with constants.
export module LambdaCalculus
{
    export interface IStringLookup {
        [name:string] : string;
    }

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

    // A redex stands for reducible expression. It is also called a term.  It is any valid expression in our lambda calculus.
    export class Redex {
        clone(lookup:IStringLookup) : Redex {
            throw new Error("clone needs to be implemented in an deroved class");
        }
    }

    // Represents constants like integers or booleans. 
    export class ValueExpr<T> extends Redex {
        constructor(
            public readonly value:T) 
        { 
            super();         
        }

        toString() : string {
            return this.value.toString();
        }

        clone(lookup:IStringLookup) : ValueExpr<T> {
            return new ValueExpr<T>(this.value);
        }
    }
    
    // Represents names which might be free or bound variables
    export class NameExpr extends Redex {
        constructor(
            public readonly name:string)
        { 
            super();
        }

        toString() : string {
            return this.name.toString();
        }

        clone(lookup:IStringLookup) : NameExpr {
            return new NameExpr(rename(this.name, lookup));               
        }
    }

    // Represents the application of a function value to an argument value.
    // In the lambda calculus this can be written as `f(x)` or simply `f x`
    export class ApplicationExpr extends Redex {
        constructor(
            public readonly func:Redex,
            public readonly args:Redex)
        { 
            super();
        }

        toString() : string {
            return this.func + "(" + this.args + ")";
        }

        clone(lookup:IStringLookup={}) : ApplicationExpr {
            return new ApplicationExpr(this.func.clone(lookup), this.args.clone(lookup));
        }
    }

    // Represents a Lambda abstraction. Also called an anonymous function. 
    // In the Lambda calculus all functions take one argument and return one value.
    export class AbstractionExpr extends Redex {
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

        clone(lookup:IStringLookup={}) : AbstractionExpr {
            return new AbstractionExpr(this.params.map(p => rename(p, lookup)), this.body.clone(lookup));
        }
    }

    //===============================================================================
    // Helper functions
    
    // Returns the expression and all of its sub-expressions as an array 
    export function getSubExpressions(exp:Redex, r:Redex[] = []) : Redex[] {
        r.push(exp);
        if (exp instanceof ApplicationExpr) {
            getSubExpressions(exp.func, r);
            getSubExpressions(exp.args, r);
        }
        else if (exp instanceof AbstractionExpr) {
            getSubExpressions(exp.body, r);
        }
        return r;
    }

    // Converts an array of strings to a string->string lookup table 
    export function stringsToObject(strings:string[]) : IStringLookup {
        var r:IStringLookup = {};
        for (var s of strings)
            r[s] = s;
        return r;
    }

    // Converts the keys of an object ot an array of sorted strings 
    export function keysAsStrings(object:any) : string[] {        
        return Object.keys(object).sort();
    }

    // Returns a string corresponding value in the lookup table, if present. 
    export function rename(name:string, lookup:IStringLookup) : string {
        return name in lookup ? lookup[name] : name;
    }

    // Returns a reversed copy of a string 
    export function reverse<T>(xs:T[]) : T[] {
        return xs.slice(0).reverse();
    }

    // Returns all variables that are not variables
    export function freeVariables(exp:Redex, r:IStringLookup={}, vars:IStringLookup={}) : IStringLookup {
        if (exp instanceof AbstractionExpr) {
            return freeVariables(exp.body, r, { ...vars, ...stringsToObject(exp.params) });
        }
        else if (exp instanceof ApplicationExpr)  {
            freeVariables(exp.func, r, vars);
            return freeVariables(exp.args, r, vars);
        }
        else if (exp instanceof NameExpr) {
            if (!(exp.name in vars))
                r[exp.name] = exp.name;                            
            return r;
        }
    }

    // Converts an expression by lifting a free variable out into an argument of an abstraction
    // and applying that abstraction to a variable with the name. (i) => (\i.(i))(i)
    // This is a step of the lambda lift operation
    export function lift(v:string, exp:Redex) : Redex {
        return new ApplicationExpr(new AbstractionExpr(v, exp), new NameExpr(v));
    }

    // Removes all free variables from an expression
    export function lambdaLift(exp:Redex) : Redex {
        if (exp instanceof AbstractionExpr) {
            var r:Redex = new AbstractionExpr(exp.param, lambdaLift(exp.body));
            const freeVars:string[] = keysAsStrings(freeVariables(r));
            for (var v of freeVars) 
                r = lift(v, r);
            return r;
        } 
        else if (exp instanceof ApplicationExpr) {
            return new ApplicationExpr(lambdaLift(exp.func), lambdaLift(exp.args));
        }
        else {
            return exp;
        }
    } 

    // TODO: normalize variable names
    // TODO: evaluator 
    // TODO: ast to lambda-calculus
    // TODO: parsing tests 
}
