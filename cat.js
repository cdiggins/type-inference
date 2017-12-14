"use strict";
// The Cat Programming language v1.0
// A type-inferred pure functional stack language heavily inspired by the Joy Programming Language
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Myna is a parsing library: https://github.com/cdiggins/myna-parser 
var myna_1 = require("./node_modules/myna-parser/myna");
// A type-inference library: https://github.com/cdiggins/type-inference
var type_inference_1 = require("./type_inference");
var CatLanguage;
(function (CatLanguage) {
    // Defines a Myna grammar for parsing Cat programs and types
    CatLanguage.catGrammar = new function () {
        var _this = this;
        this.identifier = myna_1.Myna.identifier.ast;
        this.integer = myna_1.Myna.integer.ast;
        this.true = myna_1.Myna.keyword("true").ast;
        this.false = myna_1.Myna.keyword("false").ast;
        this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ']').ast;
        this.funcInput = this.typeExprRec.ws.zeroOrMore.ast;
        this.funcOutput = this.typeExprRec.ws.zeroOrMore.ast;
        this.typeFunc = myna_1.Myna.guardedSeq('(', myna_1.Myna.ws, this.funcInput, '->', myna_1.Myna.ws, this.funcOutput, ')').ast;
        this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
        this.typeConstant = myna_1.Myna.identifier.ast;
        this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeFunc, this.typeVar, this.typeConstant).ast;
        this.recTerm = myna_1.Myna.delay(function () { return _this.term; });
        this.quotation = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term = myna_1.Myna.choice(this.quotation, this.integer, this.true, this.false, this.identifier);
        this.terms = myna_1.Myna.ws.then(this.term.ws.zeroOrMore);
        this.definedName = myna_1.Myna.identifier.ast;
        this.typeSig = myna_1.Myna.guardedSeq(":", myna_1.Myna.ws, this.typeExpr).ast;
        this.extern = myna_1.Myna.guardedSeq(myna_1.Myna.keyword('extern').ws, this.definedName, myna_1.Myna.ws, this.typeSig).ast;
        this.definition = myna_1.Myna.guardedSeq('{', this.term.zeroOrMore, '}').ast;
        this.define = myna_1.Myna.guardedSeq(myna_1.Myna.keyword('define').ws, this.definedName, myna_1.Myna.ws, this.typeSig.opt, this.definition).ast;
        this.program = myna_1.Myna.choice(this.define, this.extern, this.term).zeroOrMore.ast;
    };
    // Register the Cat grammar 
    myna_1.Myna.registerGrammar('cat', CatLanguage.catGrammar, CatLanguage.catGrammar.program);
    //====================================================================
    // Helper Functions
    // Creates a flattened representation of type pairs appropriate for usage with Cat
    function flattenTypePairs(t) {
        return t instanceof type_inference_1.TypeInference.TypePair
            ? t.typeA + " " + flattenTypePairs(t.typeB)
            : typeToString(t);
    }
    CatLanguage.flattenTypePairs = flattenTypePairs;
    // Returns a string representation of a type designed for Cat
    function typeToString(t) {
        return t instanceof type_inference_1.TypeInference.TypeFunction
            ? "(" + flattenTypePairs(t.inputs) + " -> " + flattenTypePairs(t.outputs) + ")"
            : t.toString();
    }
    CatLanguage.typeToString = typeToString;
    // Converts a string into a type expression
    function stringToType(input) {
        var ast = myna_1.Myna.parse(myna_1.Myna.grammars['cat'].typeExpr, input);
        return astToType(ast);
    }
    CatLanguage.stringToType = stringToType;
    // Converts a string into a type-list expression
    function stringToTypeFunction(s) {
        var t = stringToType(s);
        if (t instanceof type_inference_1.TypeInference.TypeFunction)
            return t;
        throw new Error("Not a type function: " + s);
    }
    CatLanguage.stringToTypeFunction = stringToTypeFunction;
    // Converts a series of cat terms into an AST
    function stringToCatAst(input) {
        return myna_1.Myna.parse(myna_1.Myna.grammars['cat'].terms, input);
    }
    CatLanguage.stringToCatAst = stringToCatAst;
    function astNodesToType(nodes) {
        if (nodes.length == 0)
            throw new Error("Expected at least one element");
        if (nodes.length == 1)
            return astToType(nodes[0]);
        return new type_inference_1.TypeInference.TypePair(astToType(nodes[0]), astNodesToType(nodes.slice(1)));
    }
    CatLanguage.astNodesToType = astNodesToType;
    // Converts an AST generated from a parse int o type expression
    function astToType(ast) {
        if (!ast)
            throw new Error("Missing AST node");
        switch (ast.name) {
            case "typeVar":
                return new type_inference_1.TypeInference.TypeVariable(ast.allText.substr(1));
            case "typeConstant":
                return new type_inference_1.TypeInference.TypeConstant(ast.allText);
            case "typeFunc":
                return new type_inference_1.TypeInference.TypeFunction(astToType(ast.children[0]), astToType(ast.children[1]));
            case "funcInput":
            case "funcOutput":
                return astNodesToType(ast.children);
            case "typeList":
                return new type_inference_1.TypeInference.TypeList(ast.children.map(astToType));
            case "typeExpr":
                return astToType(ast.children[0]);
            default:
                throw new Error("Unrecognized type expression: " + ast.name);
        }
    }
    CatLanguage.astToType = astToType;
    // Returns the type of data
    function dataType(data) {
        if (typeof (data) == 'number')
            return new type_inference_1.TypeInference.TypeConstant('Num');
        if (typeof (data) == 'boolean')
            return new type_inference_1.TypeInference.TypeConstant('Bool');
        if (typeof (data) == 'string')
            return new type_inference_1.TypeInference.TypeConstant('Str');
        if (data instanceof CatInstruction)
            return data.type;
        throw new Error("Could not figure out the type of the data: " + data);
    }
    CatLanguage.dataType = dataType;
    // Creates a Cat function type: adding the implicit row variable 
    function createCatFunctionType(inputs, outputs) {
        var row = new type_inference_1.TypeInference.TypeVariable('_');
        var input = type_inference_1.TypeInference.arrayToTypePair(inputs, row);
        var output = type_inference_1.TypeInference.arrayToTypePair(outputs, row);
        return new type_inference_1.TypeInference.TypeFunction(input, output);
    }
    CatLanguage.createCatFunctionType = createCatFunctionType;
    // Given the type of the current stack, and a function type, returns the type of the resulting stack.
    function evalType(stack, func) {
        throw new Error("Not implemented yet");
    }
    CatLanguage.evalType = evalType;
    // Applies a function to a stack transforming its internal state 
    function applyFunc(stack, func) {
        func.apply(stack);
    }
    CatLanguage.applyFunc = applyFunc;
    // Returns the type of the id function 
    function idType() {
        return stringToTypeFunction("('S -> 'S)");
    }
    CatLanguage.idType = idType;
    // Gets the type of a sequence of instructions 
    function quotationType(q) {
        if (q.length == 0)
            return idType();
        var r = q[0].type;
        for (var i = 1; i < q.length; ++i)
            r = type_inference_1.TypeInference.getComposedType(r, q[i].type);
        return r;
    }
    CatLanguage.quotationType = quotationType;
    // Given the type of a stack, validates that the stack is in fact compatible with it or throws an error 
    function validateType(stack, type) {
        throw new Error("Not implemented");
    }
    CatLanguage.validateType = validateType;
    // Converts a JavaScript function to a Cat function 
    function jsFunctionToCat(f) {
        return function (stack) { return stack._function(f); };
    }
    CatLanguage.jsFunctionToCat = jsFunctionToCat;
    // A Cat instruction (aka word in Forth)
    var CatInstruction = (function () {
        function CatInstruction(name, func, type) {
            this.name = name;
            this.func = func;
            this.type = type;
        }
        CatInstruction.prototype.toString = function () {
            return this.name;
        };
        return CatInstruction;
    }());
    CatLanguage.CatInstruction = CatInstruction;
    // A list of instructions 
    var CatQuotation = (function (_super) {
        __extends(CatQuotation, _super);
        function CatQuotation(instructions) {
            var _this = _super.call(this, "_quotation_", function (stack) { return instructions.forEach(function (i) { return i.func(stack); }); }, quotationType(instructions)) || this;
            _this.instructions = instructions;
            return _this;
        }
        CatQuotation.prototype.toString = function () {
            return this.instructions.map(function (i) { return i.toString(); }).join(" ");
        };
        return CatQuotation;
    }(CatInstruction));
    CatLanguage.CatQuotation = CatQuotation;
    ;
    // An instruction that pushes data on the stack
    var CatConstant = (function (_super) {
        __extends(CatConstant, _super);
        function CatConstant(data) {
            var _this = _super.call(this, "_constant_", function (stack) { return stack.push(data); }, createCatFunctionType([], [dataType(data)])) || this;
            _this.data = data;
            return _this;
        }
        CatConstant.prototype.toString = function () {
            return this.data.toString();
        };
        return CatConstant;
    }(CatInstruction));
    CatLanguage.CatConstant = CatConstant;
    ;
    // Wraps the shared stack used by an executing Cat program 
    var CatStack = (function () {
        function CatStack() {
            this.stack = [];
        }
        // Pushes a value onto the stack. 
        CatStack.prototype.push = function (x) {
            this.stack.push(x);
        };
        // Returns the top value on the stack. 
        CatStack.prototype.top = function () {
            return this.stack[this.stack.length - 1];
        };
        // Removes the top value from the stack 
        CatStack.prototype.pop = function () {
            return this.stack.pop();
        };
        // Removes the top valued from the stack, and returns it as the specified type.
        CatStack.prototype.popType = function () {
            return this.pop();
        };
        // Removes the top value from the stack, assuring it is a function 
        CatStack.prototype.popFunc = function () {
            var i = this.popType();
            if (!i)
                throw new Error("Expected Cat instruction on the top of the stack");
            return i.func;
        };
        // Swaps the top two values of the stack 
        CatStack.prototype.swap = function () {
            var x = this.pop();
            var y = this.pop();
            this.push(x);
            this.push(y);
        };
        // Duplicates the top value on the stack 
        CatStack.prototype.dup = function () {
            this.push(this.top());
        };
        // Pops a function from the stack and applies it to the stack.
        CatStack.prototype.apply = function () {
            this.popFunc()(this);
        };
        // Pops a function from the stack, and then a value, then applies the function to the stack pushing the value afterwards 
        CatStack.prototype.dip = function () {
            var f = this.popFunc();
            var tmp = this.pop();
            f(this);
            this.push(tmp);
        };
        // Pops a boolean and two values from the stack, pushing either the top value back on the stack if the boolean is true,
        // or the other value otherwise. 
        CatStack.prototype.cond = function () {
            var b = this.pop();
            var onTrue = this.pop();
            var onFalse = this.pop();
            this.push(b ? onTrue : onFalse);
        };
        // Executes a conditional function and then a body function repeatedly while the result of the conditional 
        // function is true. 
        CatStack.prototype.while = function () {
            var cond = this.popFunc();
            var body = this.popFunc();
            cond(this);
            while (this.pop()) {
                body(this);
                cond(this);
            }
        };
        // Creates a function that returns a value
        CatStack.prototype.quote = function () {
            this.push(new CatConstant(this.pop()));
        };
        // Creates a new quotation by combining two existing quotations 
        CatStack.prototype.compose = function () {
            var a = this.popType();
            var b = this.popType();
            this.push(new CatQuotation([a, b]));
        };
        // Calls a plain JavaScript function using arguments from the stack
        // and pushes the result back onto the stack. 
        CatStack.prototype._function = function (f) {
            var args = [];
            for (var i = 0; i < f.length; ++i)
                args.push(this.pop());
            this.push(f.apply(null, args));
        };
        return CatStack;
    }());
    CatLanguage.CatStack = CatStack;
    // A cat environment holds the dictionary of instructions and their types. 
    var CatEnvironment = (function () {
        // Constructor 
        function CatEnvironment() {
            // The list of defined instruction. 
            this.instructions = {};
            // These are operations directly available on the "stack" object.   
            // They are retrieved by the name. 
            var primOps = {
                apply: "(('S -> 'R) 'S -> 'R)",
                quote: "('a 'S -> ('R -> 'a 'R) 'S)",
                compose: "(('A -> 'B) ('B -> 'C) 'S -> ('A -> 'C) 'S)",
                dup: "('a 'S -> 'a 'a 'S)",
                pop: "('a 'S -> 'S)",
                swap: "('a 'b 'S -> 'b 'a 'S)",
                dip: "(('S -> 'R) 'a 'S -> 'a 'R)",
                cond: "(Bool 'a 'a 'S -> 'a 'S)",
                while: "(('S -> Bool 'R) ('R -> 'S) 'S -> 'S)",
            };
            var _loop_1 = function (k) {
                this_1.addInstruction(k, function (stack) { return stack[k](); }, primOps[k]);
            };
            var this_1 = this;
            // Register the primitive operations (stack built-in functions)
            for (var k in primOps) {
                _loop_1(k);
            }
            // These are additional primitives defined as lambdas
            var primFuncs = {
                eq: [function (x, y) { return x == y; }, "('a 'a 'S -> Bool 'S)"],
                neq: [function (x, y) { return x != y; }, "('a 'a 'S -> Bool 'S)"],
                add: [function (x, y) { return x + y; }, "(Num Num 'S -> Num 'S)"],
                neg: [function (x) { return -x; }, "(Num 'S -> Num 'S)"],
                sub: [function (x, y) { return x - y; }, "(Num Num 'S -> Num 'S)"],
                mul: [function (x, y) { return x * y; }, "(Num Num 'S -> Num 'S)"],
                div: [function (x, y) { return x / y; }, "(Num Num 'S -> Num 'S)"],
                mod: [function (x, y) { return x % y; }, "(Num Num 'S -> Num 'S)"],
                not: [function (x) { return !x; }, "(Bool 'S -> Bool 'S)"],
                gt: [function (x, y) { return x > y; }, "(Num Num 'S -> Bool 'S)"],
                gteq: [function (x, y) { return x >= y; }, "(Num Num 'S -> Bool 'S)"],
                lt: [function (x, y) { return x < y; }, "(Num Num 'S -> Bool 'S)"],
                lteq: [function (x, y) { return x <= y; }, "(Num Num 'S -> Bool 'S)"],
                and: [function (x, y) { return x && y; }, "(Bool Bool 'S -> Bool 'S)"],
                or: [function (x, y) { return x || y; }, "(Bool Bool 'S -> Bool 'S)"],
                xor: [function (x, y) { return x ^ y; }, "(Bool Bool 'S -> Bool 'S)"],
            };
            // Register core functions expressed as JavaScript functions 
            for (var k in primFuncs)
                this.addInstruction(k, jsFunctionToCat(primFuncs[k][0]), primFuncs[k][1]);
        }
        // Helper function to get the function associated with an instrurction
        CatEnvironment.prototype.getFunction = function (s) {
            return this.instructions[s].func;
        };
        // Helper function to get the type associated with an instruction
        CatEnvironment.prototype.getType = function (s) {
            return this.instructions[s].type;
        };
        CatEnvironment.prototype.getInstructions = function () {
            var r = new Array();
            for (var k in this.instructions)
                r.push(this.instructions[k]);
            return r;
        };
        // Creates a new instruction and returns it 
        CatEnvironment.prototype.addInstruction = function (name, func, type) {
            return this.instructions[name] = new CatInstruction(name, func, stringToTypeFunction(type));
        };
        return CatEnvironment;
    }());
    CatLanguage.CatEnvironment = CatEnvironment;
    // The evaluator holds a Cat environment containing the dictionary of defined Cat words 
    // It also caches an evaluator function. It contains helper evaluation functions. 
    // The evaluator also maintains the current type of the Cat stack, and predicts it based 
    // on the terms it is about to evaluate.
    var CatEvaluator = (function () {
        function CatEvaluator() {
            this.env = new CatEnvironment();
            this.stk = new CatStack();
            this.type = stringToType('[]');
        }
        CatEvaluator.prototype.print = function () {
            console.log(this.stk);
        };
        CatEvaluator.prototype.eval = function (s) {
            this.evalTerm(stringToCatAst(s));
        };
        CatEvaluator.prototype.evalTerms = function (ast) {
            var _this = this;
            ast.children.forEach(function (c) { return _this.evalTerm(c); });
        };
        CatEvaluator.prototype.evalInstruction = function (instruction) {
            var type = this.getInstructionType(instruction);
            var f = this.env.getFunction(instruction);
            if (!f)
                throw new Error("Could not find instruction function " + instruction);
            f(this.stk);
            // TODO: update the current type
        };
        CatEvaluator.prototype.getInstructionType = function (instruction) {
            var type = this.env.getType(instruction);
            if (!type)
                throw new Error("Could not find instruction type " + instruction);
            return type;
        };
        CatEvaluator.prototype.composeFunctionTypes = function (t1, t2) {
            // add all of the t1 variables, add all of the t2 variables. 
            //var ti = new ti.TypeInference.
            throw new Error('todo: not implemented');
        };
        CatEvaluator.prototype.getQuotationType = function (astNodes) {
            throw new Error('todo: not implemented');
        };
        CatEvaluator.prototype.push = function (value, type) {
            this.type.types.unshift(type);
            this.stk.push(value);
        };
        CatEvaluator.prototype.getType = function (ast) {
            if (!ast)
                throw new Error("Not a valid AST");
            switch (ast.name) {
                case "identifier":
                    return this.getInstructionType(ast.allText);
                case "integer":
                    return new type_inference_1.TypeInference.TypeConstant("Num");
                case "true":
                case "false":
                    return new type_inference_1.TypeInference.TypeConstant("Bool");
                case "quotation":
                    return this.getQuotationType(ast.children);
                default:
                    throw new Error("AST node has no known type: " + ast.name);
            }
        };
        CatEvaluator.prototype.evalTerm = function (ast) {
            var _this = this;
            if (!ast)
                throw new Error("Not a valid AST");
            switch (ast.name) {
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
                    return this.push(function (stk) { return _this.evalTerms(ast); }, this.getType(ast));
                default:
                    throw new Error("AST node type is not executable: " + ast.name);
            }
        };
        return CatEvaluator;
    }());
    CatLanguage.CatEvaluator = CatEvaluator;
})(CatLanguage = exports.CatLanguage || (exports.CatLanguage = {}));
//# sourceMappingURL=cat.js.map