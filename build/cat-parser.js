"use strict";
// A parser for a super-set of the Cat language called Lambda-Cat 
// which includes variables. In Lambda-Cat the introduction of a variable is denoted by \x.
// 
// This is inspired by the work of Brent Kerby, but is modified http://tunes.org/~iepos/joy.html
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
Object.defineProperty(exports, "__esModule", { value: true });
var myna_parser_1 = require("myna-parser");
// Defines a Myna grammar for parsing Cat expressions that support the introduction and usage of scoped variables. 
exports.catGrammar = new function () {
    var _this = this;
    this.identifier = myna_parser_1.Myna.identifier.ast;
    this.param = myna_parser_1.Myna.guardedSeq('\\', this.identifier).ast;
    this.var = myna_parser_1.Myna.guardedSeq('@', this.identifier).ast;
    this.match = myna_parser_1.Myna.guardedSeq('$', this.identifier).ast;
    this.integer = myna_parser_1.Myna.integer.ast;
    this.true = myna_parser_1.Myna.keyword("true").ast;
    this.false = myna_parser_1.Myna.keyword("false").ast;
    this.recTerm = myna_parser_1.Myna.delay(function () { return _this.term; });
    this.recTerms = myna_parser_1.Myna.delay(function () { return _this.terms; });
    this.quotation = myna_parser_1.Myna.guardedSeq('[', myna_parser_1.Myna.ws, this.recTerms, myna_parser_1.Myna.ws, ']').ast;
    this.term = myna_parser_1.Myna.choice(this.param, this.var, this.quotation, this.integer, this.true, this.false, this.identifier);
    this.terms = myna_parser_1.Myna.ws.then(this.term.ws.zeroOrMore);
};
myna_parser_1.Myna.registerGrammar('cat', exports.catGrammar, exports.catGrammar.terms);
exports.catParser = myna_parser_1.Myna.parsers['cat'];
function parseCat(s) {
    var ast = exports.catParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");
    return ast.children.map(astToCat);
}
exports.parseCat = parseCat;
function astToCat(ast) {
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
exports.astToCat = astToCat;
var CatExpr = /** @class */ (function () {
    function CatExpr() {
    }
    return CatExpr;
}());
exports.CatExpr = CatExpr;
var CatParam = /** @class */ (function (_super) {
    __extends(CatParam, _super);
    function CatParam(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    CatParam.prototype.toString = function () {
        return '\\' + this.name;
    };
    return CatParam;
}(CatExpr));
exports.CatParam = CatParam;
var CatVar = /** @class */ (function (_super) {
    __extends(CatVar, _super);
    function CatVar(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    CatVar.prototype.toString = function () {
        return '@' + this.name;
    };
    return CatVar;
}(CatExpr));
exports.CatVar = CatVar;
var CatCapture = /** @class */ (function (_super) {
    __extends(CatCapture, _super);
    function CatCapture(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    CatCapture.prototype.toString = function () {
        return '%' + this.name;
    };
    return CatCapture;
}(CatExpr));
exports.CatCapture = CatCapture;
var CatQuotation = /** @class */ (function (_super) {
    __extends(CatQuotation, _super);
    function CatQuotation(terms) {
        var _this = _super.call(this) || this;
        _this.terms = terms;
        return _this;
    }
    CatQuotation.prototype.toString = function () {
        return "[" + this.terms.join(" ") + "]";
    };
    CatQuotation.prototype.splice = function (pos, delCount) {
        var terms = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            terms[_i - 2] = arguments[_i];
        }
        var r = this.terms.slice();
        r.splice.apply(r, [pos, delCount].concat(terms));
        return new CatQuotation(r);
    };
    CatQuotation.prototype.delete = function (pos, delCount) {
        return this.splice(pos, delCount);
    };
    CatQuotation.prototype.insert = function (pos) {
        var terms = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            terms[_i - 1] = arguments[_i];
        }
        return this.splice.apply(this, [pos, 0].concat(terms));
    };
    CatQuotation.prototype.prepend = function () {
        var terms = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            terms[_i] = arguments[_i];
        }
        return this.insert.apply(this, [0].concat(terms));
    };
    CatQuotation.prototype.append = function () {
        var terms = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            terms[_i] = arguments[_i];
        }
        return this.insert.apply(this, [this.terms.length].concat(terms));
    };
    return CatQuotation;
}(CatExpr));
exports.CatQuotation = CatQuotation;
var CatConstant = /** @class */ (function (_super) {
    __extends(CatConstant, _super);
    function CatConstant(value) {
        var _this = _super.call(this) || this;
        _this.value = value;
        return _this;
    }
    CatConstant.prototype.toString = function () {
        return this.value.toString();
    };
    return CatConstant;
}(CatExpr));
exports.CatConstant = CatConstant;
var CatInstruction = /** @class */ (function (_super) {
    __extends(CatInstruction, _super);
    function CatInstruction(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    CatInstruction.prototype.toString = function () {
        return this.name;
    };
    return CatInstruction;
}(CatExpr));
exports.CatInstruction = CatInstruction;
//# sourceMappingURL=cat-parser.js.map