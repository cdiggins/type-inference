// The Cat Programming language v1.0
// A type-inferred pure functional stack language heavily inspired by the Joy Programming Language
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

// Myna is a parsing library: https://github.com/cdiggins/myna-parser 
import { Myna as m } from "./node_modules/myna-parser/myna";

// A type-inference library: https://github.com/cdiggins/type-inference
import { TypeInference as ti } from "./type_inference";

export module CatLanguage
{
    // Defines a Myna grammar for parsing Cat programs and types
    export var catGrammar = new function() 
    {
        var _this = this;
        this.identifier     = m.identifier.ast;
        this.integer        = m.integer.ast;
        this.true           = m.keyword("true").ast;
        this.false          = m.keyword("false").ast;
        this.typeExprRec    = m.delay(() => { return _this.typeExpr});
        this.typeList       = m.guardedSeq('[', m.ws, this.typeExprRec.ws.zeroOrMore, ']').ast;
        this.funcInput      = this.typeExprRec.ws.zeroOrMore.ast;
        this.funcOutput     = this.typeExprRec.ws.zeroOrMore.ast;
        this.typeFunc       = m.guardedSeq('(', m.ws, this.funcInput, '->', m.ws, this.funcOutput, ')').ast;
        this.typeVar        = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant   = m.identifier.ast;
        this.typeExpr       = m.choice(this.typeList, this.typeFunc, this.typeVar, this.typeConstant).ast;        
        this.recTerm        = m.delay(() => { return _this.term; });
        this.quotation      = m.guardedSeq('[', m.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term           = m.choice(this.quotation, this.integer, this.true, this.false, this.identifier); 
        this.terms          = m.ws.then(this.term.ws.zeroOrMore);
        this.definedName    = m.identifier.ast;
        this.typeSig        = m.guardedSeq(":", m.ws, this.typeExpr).ast;
        this.extern         = m.guardedSeq(m.keyword('extern').ws, this.definedName, m.ws, this.typeSig).ast;
        this.definition     = m.guardedSeq('{', this.term.zeroOrMore, '}').ast;
        this.define         = m.guardedSeq(m.keyword('define').ws, this.definedName, m.ws, this.typeSig.opt, this.definition).ast;
        this.program        = m.choice(this.define, this.extern, this.term).zeroOrMore.ast;
    }    

    // Register the Cat grammar 
    m.registerGrammar('cat', catGrammar, catGrammar.program);

    //====================================================================
    // Helper Functions

    // Creates a flattened representation of type pairs appropriate for usage with Cat
    export function flattenTypePairs(t:ti.TypeExpr) : string {
        return t instanceof ti.TypePair
            ? t.typeA + " " + flattenTypePairs(t.typeB)
            : typeToString(t)
    }
        
    // Returns a string representation of a type designed for Cat
    export function typeToString(t:ti.TypeExpr) : string {
        return t instanceof ti.TypeFunction
            ? "(" + flattenTypePairs(t.inputs) + " -> " + flattenTypePairs(t.outputs) + ")"
            : t.toString();
    }    

    // Converts a string into a type expression
    export function stringToType(input:string) : ti.TypeExpr {
        var ast = m.parse(m.grammars['cat'].typeExpr, input);
        return astToType(ast);
    }

    // Converts a string into a type-list expression
    export function stringToTypeFunction(s:string) : ti.TypeFunction {
        var t = stringToType(s);
        if (t instanceof ti.TypeFunction)
            return t;
        throw new Error("Not a type function: " + s);
    }

    // Converts a series of cat terms into an AST
    export function stringToCatAst(input:string) : m.AstNode {
        return m.parse(m.grammars['cat'].terms, input);
    }

    export function astNodesToType(nodes:m.AstNode[]) : ti.TypeExpr {
        if (nodes.length == 0) 
            throw new Error("Expected at least one element");
        if (nodes.length == 1)
            return astToType(nodes[0]);
        return new ti.TypePair(astToType(nodes[0]), astNodesToType(nodes.slice(1)));
    }
        
    // Converts an AST generated from a parse int o type expression
    export function astToType(ast:m.AstNode) : ti.TypeExpr {
        if (!ast)
            throw new Error("Missing AST node");

        switch (ast.name)
        {
            case "typeVar":
                return new ti.TypeVariable(ast.allText.substr(1));
            case "typeConstant":
                return new ti.TypeConstant(ast.allText);
            case "typeFunc":
                return new ti.TypeFunction(astToType(ast.children[0]), astToType(ast.children[1]));
            case "funcInput":
            case "funcOutput":
                return astNodesToType(ast.children);
            case "typeList":
                return new ti.TypeList(ast.children.map(astToType));
            case "typeExpr":
                return astToType(ast.children[0]);
            default: 
                throw new Error("Unrecognized type expression: " + ast.name);
        }
    }

    // Returns the type of data
    export function dataType(data:CatValue) : ti.TypeExpr {    
        if (typeof(data) == 'number')
            return new ti.TypeConstant('Num');
        if (typeof(data) == 'boolean')
            return new ti.TypeConstant('Bool');
        if (typeof(data) == 'string')        
            return new ti.TypeConstant('Str');
        if (data instanceof CatInstruction)
            return data.type;
        throw new Error("Could not figure out the type of the data: " + data);    
    }

    // Creates a Cat function type: adding the implicit row variable 
    export function createCatFunctionType(inputs:ti.TypeExpr[], outputs:ti.TypeExpr[]) : ti.TypeFunction {
        var row = new ti.TypeVariable('_');
        var input = ti.arrayToTypePair(inputs, row);
        var output = ti.arrayToTypePair(outputs, row);
        return new ti.TypeFunction(input, output);
    }
        
    // Given the type of the current stack, and a function type, returns the type of the resulting stack.
    export function evalType(stack : ti.TypeList, func : ti.TypeList) : ti.TypeList {
        throw new Error("Not implemented yet");
    }

    // Applies a function to a stack transforming its internal state 
    export function applyFunc(stack : CatStack, func : Function) {
        func.apply(stack);
    }

    // Returns the type of the id function 
    export function idType() : ti.TypeFunction {
        return stringToTypeFunction("('S -> 'S)");    
    }

    // Gets the type of a sequence of instructions 
    export function quotationType(q:CatInstruction[]) : ti.TypeFunction {
        if (q.length == 0)
            return idType();    
        var r = q[0].type;
        for (var i=1; i < q.length; ++i) 
            r = ti.getComposedType(r, q[i].type); 
        return r;
    }

    // Given the type of a stack, validates that the stack is in fact compatible with it or throws an error 
    export function validateType(stack : CatStack, type : ti.TypeList) {
        throw new Error("Not implemented");
    }

    // Converts a JavaScript function to a Cat function 
    export function jsFunctionToCat(f:Function) : CatFunction {
        return (stack) => stack._function(f);            
    }

    //======================================================================
    // Classes and interfaces

    // Used for looking up instructions by name
    export interface ICatInstructionLookup {
        [name:string] : CatInstruction;
    }

    // The type of Cat functions in the implementation.
    // The implementation uses a shared mutable structure called a "CatStack".
    export type CatFunction = (CatStack) => void;

    // A Cat instruction (aka word in Forth)
    export class CatInstruction {
        constructor( 
            public name : string,
            public func : CatFunction,
            public type : ti.TypeFunction) 
        { }

        toString() : string {
            return this.name;
        }
    }

    // A list of instructions 
    export class CatQuotation extends CatInstruction {
        constructor(
            public instructions:CatInstruction[])
        { 
            super("_quotation_", 
                (stack) => instructions.forEach(i => i.func(stack)),
                quotationType(instructions)
            ); 
        }

        toString() : string {
            return this.instructions.map(i => i.toString()).join(" ");
        }
    };

    // An instruction that pushes data on the stack
    export class CatConstant extends CatInstruction {
        constructor(
            public data:CatValue)
        { 
            super("_constant_", 
                (stack) => stack.push(data),
                createCatFunctionType([], [dataType(data)]));        
        }

        toString() : string {
            return this.data.toString();
        }
    };

    // The type of things on the Cat stack
    export type CatValue = number | boolean | string | CatInstruction; 

    // Wraps the shared stack used by an executing Cat program 
    export class CatStack 
    {
        stack:CatValue[] = [];

        // Pushes a value onto the stack. 
        push(x:CatValue) {
            this.stack.push(x);
        }

        // Returns the top value on the stack. 
        top() : CatValue {
            return this.stack[this.stack.length-1];
        }

        // Removes the top value from the stack 
        pop() : CatValue {
            return this.stack.pop();    
        }

        // Removes the top valued from the stack, and returns it as the specified type.
        popType<T extends CatValue>() : T {
            return this.pop() as T;
        }

        // Removes the top value from the stack, assuring it is a function 
        popFunc() : CatFunction {
            var i = this.popType<CatInstruction>();
            if (!i) throw new Error("Expected Cat instruction on the top of the stack");
            return i.func;
        }

        // Swaps the top two values of the stack 
        swap() {
            var x = this.pop();
            var y = this.pop();
            this.push(x);
            this.push(y);
        }

        // Duplicates the top value on the stack 
        dup() {
            this.push(this.top());
        }

        // Pops a function from the stack and applies it to the stack.
        apply() {
            this.popFunc()(this);
        }

        // Pops a function from the stack, and then a value, then applies the function to the stack pushing the value afterwards 
        dip() {
            var f = this.popFunc();
            var tmp = this.pop();
            f(this);
            this.push(tmp);        
        }

        // Pops a boolean and two values from the stack, pushing either the top value back on the stack if the boolean is true,
        // or the other value otherwise. 
        cond() {
            var b = this.pop();
            var onTrue = this.pop();
            var onFalse = this.pop();
            this.push(b ? onTrue : onFalse);
        }

        // Executes a conditional function and then a body function repeatedly while the result of the conditional 
        // function is true. 
        while() {
            var cond = this.popFunc();
            var body = this.popFunc();
            cond(this);
            while (this.pop()) {
                body(this);
                cond(this);
            }
        }

        // Creates a function that returns a value
        quote() {
            this.push(new CatConstant(this.pop()));
        }

        // Creates a new quotation by combining two existing quotations 
        compose() {
            var a = this.popType<CatInstruction>();
            var b = this.popType<CatInstruction>();
            this.push(new CatQuotation([a, b]));
        }

        // Calls a plain JavaScript function using arguments from the stack
        // and pushes the result back onto the stack. 
        _function(f:Function) { 
            var args = [];
            for (var i=0; i < f.length; ++i) 
                args.push(this.pop());
            this.push(f.apply(null, args));        
        }
    }

    // A cat environment holds the dictionary of instructions and their types. 
    export class CatEnvironment
    {
        // The list of defined instruction. 
        instructions : ICatInstructionLookup = {};
        
        // Helper function to get the function associated with an instrurction
        getFunction(s:string) : Function {
            return this.instructions[s].func;
        }

        // Helper function to get the type associated with an instruction
        getType(s:string) : ti.TypeList {
            return this.instructions[s].type;
        }

        getInstructions() : CatInstruction[] {
            var r = new Array<CatInstruction>();
            for (var k in this.instructions)
                r.push(this.instructions[k]);
            return r;
        }

        // Creates a new instruction and returns it 
        addInstruction(name:string, func:CatFunction, type:string) {
            return this.instructions[name] = new CatInstruction(name, func, stringToTypeFunction(type));
        }

        // Constructor 
        constructor() 
        {        
            // These are operations directly available on the "stack" object.   
            // They are retrieved by the name. 
            var primOps = {
                apply   : "(('S -> 'R) 'S -> 'R)",
                quote   : "('a 'S -> ('R -> 'a 'R) 'S)",
                compose : "(('A -> 'B) ('B -> 'C) 'S -> ('A -> 'C) 'S)",
                dup     : "('a 'S -> 'a 'a 'S)",
                pop     : "('a 'S -> 'S)",
                swap    : "('a 'b 'S -> 'b 'a 'S)",
                dip     : "(('S -> 'R) 'a 'S -> 'a 'R)",
                cond    : "(Bool 'a 'a 'S -> 'a 'S)",
                while   : "(('S -> Bool 'R) ('R -> 'S) 'S -> 'S)",
            };

            // Register the primitive operations (stack built-in functions)
            for (let k in primOps) 
                this.addInstruction(k, (stack) => stack[k](), primOps[k]);

            // These are additional primitives defined as lambdas
            var primFuncs = {
                eq      : [(x,y) => x == y, "('a 'a 'S -> Bool 'S)"],
                neq     : [(x,y) => x != y, "('a 'a 'S -> Bool 'S)"],
                add     : [(x,y) => x + y,  "(Num Num 'S -> Num 'S)"],
                neg     : [(x) => -x,       "(Num 'S -> Num 'S)"],
                sub     : [(x,y) => x - y,  "(Num Num 'S -> Num 'S)"],
                mul     : [(x,y) => x * y,  "(Num Num 'S -> Num 'S)"],
                div     : [(x,y) => x / y,  "(Num Num 'S -> Num 'S)"],
                mod     : [(x,y) => x % y,  "(Num Num 'S -> Num 'S)"],
                not     : [(x) => !x,       "(Bool 'S -> Bool 'S)"],
                gt      : [(x,y) => x > y,  "(Num Num 'S -> Bool 'S)"],
                gteq    : [(x,y) => x >= y, "(Num Num 'S -> Bool 'S)"],
                lt      : [(x,y) => x < y,  "(Num Num 'S -> Bool 'S)"],
                lteq    : [(x,y) => x <= y, "(Num Num 'S -> Bool 'S)"],       
                and     : [(x,y) => x && y, "(Bool Bool 'S -> Bool 'S)"],       
                or      : [(x,y) => x || y, "(Bool Bool 'S -> Bool 'S)"],       
                xor     : [(x,y) => x ^ y,  "(Bool Bool 'S -> Bool 'S)"],

                // TODO: handle collections. Really: this is a sub-type, what we want is to track the exact type as much as possible. 
                //len     : [(x) => x.length, "(Collection('a) 'S -> Collection('a) 'S)"],
                //at      : [(n, x) => x[n], "(Num Collection('a) 'S -> 'a Collection('a) 'S)"],
            }

            // Register core functions expressed as JavaScript functions 
            for (let k in primFuncs) 
                this.addInstruction(k, jsFunctionToCat(primFuncs[k][0]), primFuncs[k][1]);
        }
    }

    // The evaluator holds a Cat environment containing the dictionary of defined Cat words 
    // It also caches an evaluator function. It contains helper evaluation functions. 
    // The evaluator also maintains the current type of the Cat stack, and predicts it based 
    // on the terms it is about to evaluate.
    export class CatEvaluator 
    {
        env : CatEnvironment = new CatEnvironment();
        stk : CatStack = new CatStack();
        type : ti.TypeList = stringToType('[]') as ti.TypeList;
        
        print() {
            console.log(this.stk);
        }

        eval(s : string) {
            this.evalTerm(stringToCatAst(s));
        }    

        evalTerms(ast : m.AstNode) {
            ast.children.forEach(c => this.evalTerm(c));
        }

        evalInstruction(instruction : string) {
            var type = this.getInstructionType(instruction);
            var f = this.env.getFunction(instruction);
            if (!f) throw new Error("Could not find instruction function " + instruction);
            f(this.stk);
            // TODO: update the current type
        }

        getInstructionType(instruction : string) : ti.TypeList {
            var type = this.env.getType(instruction);
            if (!type) throw new Error("Could not find instruction type " + instruction);
            return type;
        }

        composeFunctionTypes(t1 : ti.TypeList, t2 : ti.TypeList) : ti.TypeList {
            // add all of the t1 variables, add all of the t2 variables. 
            //var ti = new ti.TypeInference.

            throw new Error('todo: not implemented');
        }

        getQuotationType(astNodes : m.AstNode[]) : ti.TypeList {
            throw new Error('todo: not implemented');
        }

        push(value : any, type : ti.TypeExpr) {
            this.type.types.unshift(type);
            this.stk.push(value);
        }

        getType(ast : m.AstNode) : ti.TypeExpr {
            if (!ast) throw new Error("Not a valid AST");        
            switch (ast.name) 
            {
                case "identifier":
                    return this.getInstructionType(ast.allText);
                case "integer":
                    return new ti.TypeConstant("Num");
                case "true":
                case "false":
                    return new ti.TypeConstant("Bool");
                case "quotation":
                    return this.getQuotationType(ast.children);
                default:
                    throw new Error("AST node has no known type: " + ast.name);
            }
        }

        evalTerm(ast : m.AstNode) {
            if (!ast) throw new Error("Not a valid AST");        
            switch (ast.name) 
            {
                case "terms":
                    return this.evalTerms(ast);
                case "identifier":
                    return this.evalInstruction(ast.allText);
                case "integer":
                    return this.push(parseInt(ast.allText), this.getType(ast));
                case "true":
                    return this.push(true, this.getType(ast));
                case "false":
                    return this.push(false, this.getType(ast));
                case "quotation":
                    return this.push((stk) => this.evalTerms(ast), this.getType(ast));
                default:
                    throw new Error("AST node type is not executable: " + ast.name);
            }
        }
    }
}
