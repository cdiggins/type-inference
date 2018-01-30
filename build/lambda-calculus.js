"use strict";
// A library of algorithms and data-structures for working with the simply untyped call-by-value Lambda calculus 
// extended with integer constants written in TypeScript.
//
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
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var myna_parser_1 = require("myna-parser");
// A Myna grammar for parsing the lambda calculus with integers and boolean constants
// In this grammar abstraction has a higher precedence than application. This means: 
// \a.a \b.b == \a.(a (\b.(b))) 
var grammar = new function () {
    var _this = this;
    this.recExpr = myna_parser_1.Myna.delay(function () { return _this.expr; });
    this.var = myna_parser_1.Myna.identifier.ast;
    this.number = myna_parser_1.Myna.digits.ast;
    this.boolean = myna_parser_1.Myna.keyword("true").or(myna_parser_1.Myna.keyword("false")).ast;
    this.abstraction = myna_parser_1.Myna.guardedSeq("\\", this.var, ".").then(this.recExpr).ast;
    this.parenExpr = myna_parser_1.Myna.guardedSeq("(", this.recExpr, ")").ast;
    this.expr = myna_parser_1.Myna.choice(this.parenExpr, this.abstraction, this.boolean, this.number, this.var).then(myna_parser_1.Myna.ws).oneOrMore.ast;
};
myna_parser_1.Myna.registerGrammar('lambda', grammar, grammar.expr);
// Parser for a lambda expression s
var lcParser = myna_parser_1.Myna.parsers['lambda'];
//========================================================================
// Classes representing different types of Lambda expressions 
// A redex stands for reducible expression. It is also called a term.  
// It is any valid expression in our lambda calculus.
var Redex = /** @class */ (function () {
    function Redex() {
    }
    Redex.prototype.clone = function (lookup) {
        throw new Error("clone needs to be implemented in an derived class");
    };
    return Redex;
}());
exports.Redex = Redex;
// Represents constants like integers or booleans. 
var RedexValue = /** @class */ (function (_super) {
    __extends(RedexValue, _super);
    function RedexValue(value) {
        var _this = _super.call(this) || this;
        _this.value = value;
        return _this;
    }
    RedexValue.prototype.toString = function () {
        return this.value.toString();
    };
    RedexValue.prototype.clone = function (lookup) {
        return new RedexValue(this.value);
    };
    return RedexValue;
}(Redex));
exports.RedexValue = RedexValue;
// Represents names which might be free or bound variables
var RedexName = /** @class */ (function (_super) {
    __extends(RedexName, _super);
    function RedexName(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    RedexName.prototype.toString = function () {
        return this.name.toString();
    };
    RedexName.prototype.clone = function (lookup) {
        return new RedexName(rename(this.name, lookup));
    };
    return RedexName;
}(Redex));
exports.RedexName = RedexName;
// Represents the application of a function value to an argument value.
// In the lambda calculus this can be written as `f(x)` or simply `f x`
var RedexApplication = /** @class */ (function (_super) {
    __extends(RedexApplication, _super);
    function RedexApplication(func, args) {
        var _this = _super.call(this) || this;
        _this.func = func;
        _this.args = args;
        return _this;
    }
    RedexApplication.prototype.toString = function () {
        return this.func + "(" + this.args + ")";
    };
    RedexApplication.prototype.clone = function (lookup) {
        if (lookup === void 0) { lookup = {}; }
        return new RedexApplication(this.func.clone(lookup), this.args.clone(lookup));
    };
    return RedexApplication;
}(Redex));
exports.RedexApplication = RedexApplication;
// Represents a Lambda abstraction. Also called an anonymous function. 
// In the Lambda calculus all functions take one argument and return one value.
var RedexAbstraction = /** @class */ (function (_super) {
    __extends(RedexAbstraction, _super);
    function RedexAbstraction(param, body) {
        var _this = _super.call(this) || this;
        _this.param = param;
        _this.body = body;
        return _this;
    }
    RedexAbstraction.prototype.toString = function () {
        return "\\" + this.param + "." + "(" + this.body + ")";
    };
    RedexAbstraction.prototype.clone = function (lookup) {
        if (lookup === void 0) { lookup = {}; }
        return new RedexAbstraction(rename(this.param, lookup), this.body.clone(lookup));
    };
    return RedexAbstraction;
}(Redex));
exports.RedexAbstraction = RedexAbstraction;
//===============================================================================
// Parsing functions
// Converts a string to a lambda expression (aka a reducible expression)
function parseRedex(s) {
    var ast = lcParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");
    return astToRedex(ast);
}
exports.parseRedex = parseRedex;
// Converts an abstract syntax tree representation to an expression
function astToRedex(ast) {
    switch (ast.rule.name) {
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
                for (var i = 1; i < ast.children.length; ++i) {
                    var cur = astToRedex(ast.children[i]);
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
function getSubExpressions(exp, r) {
    if (r === void 0) { r = []; }
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
exports.getSubExpressions = getSubExpressions;
// Converts an array of strings to a string->string lookup table 
function stringsToObject(strings) {
    var r = {};
    for (var _i = 0, strings_1 = strings; _i < strings_1.length; _i++) {
        var s = strings_1[_i];
        r[s] = s;
    }
    return r;
}
exports.stringsToObject = stringsToObject;
// Converts the keys of an object ot an array of sorted strings 
function keysAsStrings(object) {
    return Object.keys(object).sort();
}
exports.keysAsStrings = keysAsStrings;
// Returns a string corresponding value in the lookup table, if present. 
function rename(name, lookup) {
    return name in lookup ? lookup[name] : name;
}
exports.rename = rename;
// Returns a reversed copy of a string 
function reverse(xs) {
    return xs.slice(0).reverse();
}
exports.reverse = reverse;
// Returns all variables that are not parameters
function freeVariables(exp, r, vars) {
    if (r === void 0) { r = {}; }
    if (vars === void 0) { vars = {}; }
    if (exp instanceof RedexAbstraction) {
        return freeVariables(exp.body, r, __assign({}, vars, stringsToObject([exp.param])));
    }
    else if (exp instanceof RedexApplication) {
        freeVariables(exp.func, r, vars);
        return freeVariables(exp.args, r, vars);
    }
    else if (exp instanceof RedexName) {
        if (!(exp.name in vars))
            r[exp.name] = exp.name;
        return r;
    }
}
exports.freeVariables = freeVariables;
// Returns true if the named variable occurs in the expression
function isFreeVariableIn(v, exp) {
    return v in freeVariables(exp);
}
exports.isFreeVariableIn = isFreeVariableIn;
// Converts an expression by lifting a free variable out into an argument of an abstraction
// and applying that abstraction to a variable with the name. (i) => (\i.(i))(i)
// This is a- step of the lambda lift operation
function lambdaLiftVar(v, exp) {
    return new RedexApplication(new RedexAbstraction(v, exp), new RedexName(v));
}
exports.lambdaLiftVar = lambdaLiftVar;
// Removes all free variables from an expression
function lambdaLift(exp) {
    if (exp instanceof RedexAbstraction) {
        var r = new RedexAbstraction(exp.param, lambdaLift(exp.body));
        var freeVars = keysAsStrings(freeVariables(r));
        for (var _i = 0, freeVars_1 = freeVars; _i < freeVars_1.length; _i++) {
            var v = freeVars_1[_i];
            r = lambdaLiftVar(v, r);
        }
        return r;
    }
    else if (exp instanceof RedexApplication) {
        return new RedexApplication(lambdaLift(exp.func), lambdaLift(exp.args));
    }
    else {
        return exp;
    }
}
exports.lambdaLift = lambdaLift;
// Returns true is the redex is a variable and if a name is provided, matches the ame 
function isVar(exp, name) {
    if (name === void 0) { name = null; }
    if (exp instanceof RedexName) {
        if (name == null)
            return true;
        return exp.name == name;
    }
    return false;
}
exports.isVar = isVar;
// http://www.lambda-bound.com/book/lambdacalc/node21.html
// https://en.wiktionary.org/wiki/eta_conversion
function etaConversion(exp) {
    if (exp instanceof RedexAbstraction) {
        var body = exp.body;
        if (body instanceof RedexApplication)
            if (isVar(body.args, exp.param))
                if (!isFreeVariableIn(exp.param, body.func))
                    return body;
    }
    return exp;
}
exports.etaConversion = etaConversion;
//# sourceMappingURL=lambda-calculus.js.map