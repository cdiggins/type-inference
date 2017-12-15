"use strict";
// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
Object.defineProperty(exports, "__esModule", { value: true });
// This module provides access to the core, a type parser, and a number of helper functions. 
// The core algorithm in encoded entirely in type_core. 
var type_parser_1 = require("./type_parser");
var type_core_1 = require("./type_core");
var type_core_2 = require("./type_core");
exports.Type = type_core_2.Type;
exports.TypeArray = type_core_2.TypeArray;
exports.TypeConstant = type_core_2.TypeConstant;
exports.TypeVariable = type_core_2.TypeVariable;
exports.Inferer = type_core_2.Inferer;
exports.renameTypeVars = type_core_2.renameTypeVars;
function toType(type) {
    return type instanceof type_core_1.Type
        ? type
        : type_parser_1.TypeParser.stringToType(type);
}
exports.toType = toType;
function typeCons(types) {
    if (types.length < 3)
        return typeArray(types);
    else
        return typeArray([types[0], typeCons(types.slice(1))]);
}
exports.typeCons = typeCons;
function typeArray(types) {
    return new type_core_1.TypeArray(types.map(toType));
}
exports.typeArray = typeArray;
function typeConstant(name) {
    return new type_core_1.TypeConstant(name);
}
exports.typeConstant = typeConstant;
function typeVar(name) {
    return new type_core_1.TypeVariable(name);
}
exports.typeVar = typeVar;
function functionType(input, output) {
    return typeArray([typeConstant('function'), typeCons(input), typeCons(output)]);
}
exports.functionType = functionType;
function arrayType(element) {
    return typeArray(['array', element]);
}
exports.arrayType = arrayType;
function isTypeConstant(t, name) {
    return t instanceof type_core_1.TypeConstant && t.name === name;
}
exports.isTypeConstant = isTypeConstant;
function isFunctionType(t) {
    return t instanceof type_core_1.TypeArray && t.types.length == 3 && isTypeConstant(t.types[0], 'function');
}
exports.isFunctionType = isFunctionType;
function functionInput(t) {
    if (!isFunctionType(t))
        throw new Error("Expected a function type");
    return t.types[1];
}
exports.functionInput = functionInput;
function functionOutput(t) {
    if (!isFunctionType(t))
        throw new Error("Expected a function type");
    return t.types[2];
}
exports.functionOutput = functionOutput;
function composeFunctions(f, g) {
    if (!isFunctionType(f))
        throw new Error("Expected a function type for f");
    if (!isFunctionType(g))
        throw new Error("Expected a function type for g");
    var f1 = type_core_1.renameTypeVars(f, 0);
    var g1 = type_core_1.renameTypeVars(g, 1);
    var inF = functionInput(f1);
    var outF = functionInput(f1);
    var inG = functionInput(g1);
    var outG = functionOutput(g1);
    var e = new type_core_1.Inferer();
    e.unifyTypes(outF, inG);
    var input = e.getUnifiedType(inF);
    var output = e.getUnifiedType(outG);
    return new type_core_1.TypeArray([typeConstant('function'), input, output]);
}
exports.composeFunctions = composeFunctions;
function callFunctions(f, args) {
    if (!isFunctionType(f))
        throw new Error("Expected a function type for f");
    var input = functionInput(f);
    var output = functionOutput(f);
    var e = new type_core_1.Inferer();
    e.unifyTypes(input, args);
    return e.getUnifiedType(output);
}
exports.callFunctions = callFunctions;
// An example implementation of a type environment. Used to implement a type inference algorithm
// in a typical language with variable tracking and scopes.
var TypeEnv = (function () {
    function TypeEnv() {
        this.inferer = new type_core_1.Inferer();
        this.scopes = [{}];
        this.contexts = [];
        this.history = [{}];
        this.index = 0;
    }
    TypeEnv.prototype.pushScope = function () {
        var scope = {};
        this.history.push(scope);
        this.scopes.push(scope);
    };
    TypeEnv.prototype.popScope = function () {
        this.scopes.pop();
    };
    TypeEnv.prototype.currentScope = function () {
        return this.scopes[this.scopes.length - 1];
    };
    TypeEnv.prototype.pushFunctionContext = function () {
        this.pushScope();
        this.contexts.push(this.inferer);
        this.inferer = new type_core_1.Inferer();
    };
    TypeEnv.prototype.popFunctionContext = function () {
        this.inferer = this.contexts.pop();
        this.popScope();
    };
    TypeEnv.prototype.addName = function (name) {
        var scope = this.currentScope();
        if (name in scope)
            throw new Error("Name already defined in current scope: " + name);
        return scope[name] = null;
    };
    TypeEnv.prototype.findNameScope = function (name) {
        for (var i = this.scopes.length - 1; i >= 0; ++i) {
            var scope = this.scopes[i];
            if (name in scope)
                return scope;
        }
        throw new Error("Could not find name in any of the scopes: " + name);
    };
    TypeEnv.prototype.addAssignment = function (name, type) {
        var t = type_core_1.renameTypeVars(type, this.index++);
        var scope = this.findNameScope(name);
        if (scope[name] == null)
            return scope[name] = t;
        return scope[name] = this.inferer.unifyTypes(scope[name], t);
    };
    TypeEnv.prototype.getName = function (name) {
        for (var _i = 0, _a = this.scopes; _i < _a.length; _i++) {
            var scope = _a[_i];
            if (name in scope)
                return scope[name];
        }
        throw new Error("Could not find name: " + name);
    };
    TypeEnv.prototype.addFunctionCall = function (name, args) {
        var funcType = this.findNameScope(name)[name];
        if (funcType == null)
            throw new Error("Could not find function type: " + name);
        var argsType = typeCons(args);
        var inputs = functionInput(funcType);
        composeFunctions();
    };
    return TypeEnv;
}());
exports.TypeEnv = TypeEnv;
//# sourceMappingURL=type_inference.js.map