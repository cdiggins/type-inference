"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ti = require("./type_core");
var th = require("./type_inference");
// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
// An example implementation of a type environment. Used to implement a type inference algorithm
// in a typical language with variable tracking and scopes.
var TypeEnv = (function () {
    function TypeEnv() {
        this.inferer = new ti.Inferer();
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
        this.inferer = new ti.Inferer();
    };
    TypeEnv.prototype.popFunctionContext = function () {
        this.inferer = this.contexts.pop();
        this.popScope();
    };
    TypeEnv.prototype.addName = function (name, location) {
        if (location === void 0) { location = null; }
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
    TypeEnv.prototype.addAssignment = function (name, type, location) {
        if (location === void 0) { location = null; }
        var t = ti.renameTypeVars(type, this.index++);
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
    TypeEnv.prototype.addFunctionCall = function (name, args, location) {
        if (location === void 0) { location = null; }
        var funcType = this.findNameScope(name)[name];
        var argsType = th.typeArray(args);
    };
    return TypeEnv;
}());
exports.TypeEnv = TypeEnv;
//# sourceMappingURL=type_environment.js.map