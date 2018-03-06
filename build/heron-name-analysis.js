"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var VarUsage = /** @class */ (function () {
    function VarUsage() {
    }
    return VarUsage;
}());
var VarDef = /** @class */ (function () {
    function VarDef() {
    }
    return VarDef;
}());
var Scope = /** @class */ (function () {
    function Scope() {
        this.children = [];
    }
    Scope.prototype.findDef = function (name) {
        if (name in this.defs)
            return this.defs[name];
        if (parent == null)
            return null;
        return this.parent.findDef(name);
    };
    return Scope;
}());
var State = /** @class */ (function () {
    function State() {
    }
    State.prototype.pushScope = function (ast) {
        var tmp = new Scope();
        this.curScope.children.push(tmp);
        tmp.parent = this.curScope;
        tmp.node = ast;
        this.curScope = tmp;
    };
    State.prototype.popScope = function () {
        this.curScope = this.curScope.parent;
    };
    State.prototype.findDef = function (name) {
        return this.curScope.findDef(name);
    };
    State.prototype.addVarDef = function (name, node) {
        if (name in this.curScope.defs)
            throw new Error("Rdefining variable " + name);
        this.curScope.defs[name];
    };
    State.prototype.addVarUsage = function (name, node) {
        var usage = new VarUsage();
        usage.name = name;
        usage.node = node;
        usage.def = this.findDef(name);
    };
    return State;
}());
var HeronVisitor = /** @class */ (function () {
    function HeronVisitor() {
    }
    HeronVisitor.prototype.visitNode = function (ast, state) {
        var fnName = 'visit_' + ast.name;
        if (fnName in this)
            this[fnName](ast, state);
        else
            this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visitChildren = function (ast, state) {
        for (var _i = 0, _a = ast.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.visitNode(child, state);
        }
    };
    HeronVisitor.prototype.visit_fieldSelect = function (ast, state) {
        state.addVarUsage(ast.allText, state);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_funcDef = function (ast, state) {
        state.pushScope();
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_funcName = function (ast, state) {
        state.addVarDef(ast.allText, ast);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_funcParam = function (ast, state) {
        state.addVarDef(ast.allText, ast);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_identifier = function (ast, state) {
        state.addVarUsage(ast.allText, ast);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_lambdaArg = function (ast, state) {
        // TODO: when types are introduced, we will have to update this
        state.addVarDef(ast.allText, ast);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_lambdaBody = function (ast, state) {
        state.pushScope(ast);
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_lambdaExpr = function (ast, state) {
        state.pushScope(ast);
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_moduleName = function (ast, state) {
        state.addVarDef(ast.allText, ast);
        this.visitChildren(ast, state);
    };
    HeronVisitor.prototype.visit_recCompoundStatement = function (ast, state) {
        state.pushScope(ast);
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_statement = function (ast, state) {
        state.pushScope(ast);
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_topLevelStatement = function (ast, state) {
        state.pushScope(ast);
        this.visitChildren(ast, state);
        state.popScope();
    };
    HeronVisitor.prototype.visit_varDecl = function (ast, state) {
        state.addVarDef(ast.children[0].allText, ast);
        this.visitChildren(ast, state);
    };
    return HeronVisitor;
}());
//# sourceMappingURL=heron-name-analysis.js.map