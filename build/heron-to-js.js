"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var heron_ast_rewrite_1 = require("./heron-ast-rewrite");
//=====================================
// Main entry function 
function heronToJs(ast) {
    ast = heron_ast_rewrite_1.transformAst(ast);
    var js = new HeronToJs();
    var cb = new CodeBuilder();
    js.visitNode(ast, cb);
    return cb;
}
exports.heronToJs = heronToJs;
//=====================================
// Helper functions 
function generateAccessor(ast, state) {
    var name = ast.children[0].allText;
    state.pushLine("function " + name + "(obj) { return obj." + name + "; }");
}
exports.generateAccessor = generateAccessor;
function generateAccessors(ast, state) {
    var objs = findAllNodesNamed(ast, "objectExpr");
    for (var _i = 0, objs_1 = objs; _i < objs_1.length; _i++) {
        var obj = objs_1[_i];
        for (var _a = 0, _b = obj.children; _a < _b.length; _a++) {
            var field = _b[_a];
            generateAccessor(field, state);
        }
    }
}
exports.generateAccessors = generateAccessors;
function findAllNodes(ast, f, r) {
    if (r === void 0) { r = []; }
    if (f(ast))
        r.push(ast);
    ast.children.forEach(function (c) { return findAllNodes(c, f, r); });
    return r;
}
exports.findAllNodes = findAllNodes;
function findAllNodesNamed(ast, name) {
    return findAllNodes(ast, function (node) { return node.name === name; });
}
exports.findAllNodesNamed = findAllNodesNamed;
//=====================================
// Helper class for constructing code 
var CodeBuilder = /** @class */ (function () {
    function CodeBuilder() {
        this.lines = [];
        this.indent = 0;
    }
    Object.defineProperty(CodeBuilder.prototype, "indentString", {
        get: function () {
            var r = '';
            for (var i = 0; i < this.indent; ++i)
                r += '  ';
            return r;
        },
        enumerable: true,
        configurable: true
    });
    CodeBuilder.prototype.pushLine = function (s) {
        if (s === void 0) { s = ''; }
        this.lines.push(s + '\n');
        this.lines.push(this.indentString);
    };
    CodeBuilder.prototype.push = function (s) {
        this.lines.push(s);
    };
    CodeBuilder.prototype.toString = function () {
        return this.lines.join('');
    };
    return CodeBuilder;
}());
//=====================================
// A class for generating JavaScript code from a transformed Heron AST
var HeronToJs = /** @class */ (function () {
    function HeronToJs() {
    }
    // Helper functions 
    HeronToJs.prototype.delimited = function (astNodes, state, delim) {
        for (var i = 0; i < astNodes.length; ++i) {
            if (i > 0)
                state.push(delim);
            this.visitNode(astNodes[i], state);
        }
    };
    HeronToJs.prototype.visitNode = function (ast, state) {
        var fnName = 'visit_' + ast.name;
        if (fnName in this)
            this[fnName](ast, state);
        else
            this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visitChildren = function (ast, state) {
        if (!ast.children)
            return;
        for (var _i = 0, _a = ast.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.visitNode(child, state);
        }
    };
    // Individual node visiting functions
    HeronToJs.prototype.visit_bool = function (ast, state) {
        // bool
        state.push(' ' + ast.allText + ' ');
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_breakStatement = function (ast, state) {
        // breakStatement
        state.pushLine('break;');
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_compoundStatement = function (ast, state) {
        // recStatement[0,Infinity]
        state.indent++;
        state.pushLine('{');
        this.visitChildren(ast, state);
        state.indent--;
        if (state.lines[state.lines.length - 1].trim() === '') {
            state.lines.pop();
            state.pushLine();
        }
        state.pushLine('}');
    };
    HeronToJs.prototype.visit_continueStatement = function (ast, state) {
        // continueStatement
        state.pushLine('continue;');
    };
    HeronToJs.prototype.visit_doLoop = function (ast, state) {
        // seq(recStatement,loopCond)
        state.pushLine('do');
        this.visitNode(ast.children[0], state);
        state.push('while (');
        this.visitNode(ast.children[1], state);
        state.pushLine(')');
    };
    HeronToJs.prototype.visit_elseStatement = function (ast, state) {
        // recStatement
        state.pushLine("else");
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_emptyStatement = function (ast, state) {
        // emptyStatement
        state.pushLine(";");
    };
    HeronToJs.prototype.visit_exprStatement = function (ast, state) {
        // expr
        this.visitChildren(ast, state);
        state.pushLine(";");
    };
    HeronToJs.prototype.visit_forLoop = function (ast, state) {
        // seq(identifier,expr,recStatement)
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_funcBody = function (ast, state) {
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_funcBodyExpr = function (ast, state) {
        state.pushLine('{');
        state.push('return ');
        this.visitChildren(ast, state);
        state.pushLine(';');
        state.pushLine('}');
    };
    HeronToJs.prototype.visit_funcBodyStatement = function (ast, state) {
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_funcDef = function (ast, state) {
        // seq(funcName,funcParams,compoundStatement)
        state.push("function ");
        state.push(heron_ast_rewrite_1.identifierToString(ast.children[0].allText));
        this.visitNode(ast.children[1], state);
        state.pushLine();
        this.visitNode(ast.children[2], state);
    };
    HeronToJs.prototype.visit_funcName = function (ast, state) {
        // funcName
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_funcParam = function (ast, state) {
        // funcParam
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_funcParams = function (ast, state) {
        // funcParam[0, Infinity]
        state.push("(");
        this.delimited(ast.children, state, ", ");
        state.push(")");
    };
    HeronToJs.prototype.visit_funcParamName = function (ast, state) {
        // funcParamName
        state.push(ast.allText);
    };
    HeronToJs.prototype.visit_identifier = function (ast, state) {
        // identifier
        state.push(heron_ast_rewrite_1.identifierToString(ast.allText));
    };
    HeronToJs.prototype.visit_ifCond = function (ast, state) {
        // expr
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_ifStatement = function (ast, state) {
        // seq(ifCond,recStatement,elseStatement[0,Infinity])
        state.push("if (");
        this.visitNode(ast.children[0], state);
        state.pushLine(")");
        this.visitNode(ast.children[1], state);
        for (var i = 2; i < ast.children.length; ++i)
            this.visitNode(ast.children[i], state);
    };
    HeronToJs.prototype.visit_loopCond = function (ast, state) {
        // expr
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_moduleBody = function (ast, state) {
        // topLevelStatement[0, infinity]
        state.pushLine('{');
        generateAccessors(ast, state);
        this.visitChildren(ast, state);
        state.pushLine('}');
    };
    HeronToJs.prototype.visit_moduleName = function (ast, state) {
        // seq(identifier,identifier[0,Infinity])
        state.push(ast.allText);
    };
    HeronToJs.prototype.visit_module = function (ast, state) {
        state.pushLine('module ');
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_recCompoundStatement = function (ast, state) {
        // recCompoundStatement
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_returnStatement = function (ast, state) {
        // expr[0,1]
        state.push('return ');
        this.visitChildren(ast, state);
        state.pushLine(';');
    };
    HeronToJs.prototype.visit_statement = function (ast, state) {
        // choice(emptyStatement,compoundStatement,ifStatement,returnStatement,continueStatement,breakStatement,forLoop,doLoop,whileLoop,varDecl,exprStatement,funcDef)
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_topLevelStatement = function (ast, state) {
        // choice(emptyStatement,compoundStatement,ifStatement,forLoop,doLoop,whileLoop,varDecl,exprStatement,funcDef)
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_varDecl = function (ast, state) {
        // seq(identifier,varInitialization)
        state.push("let ");
        state.push(ast.children[0].allText);
        state.push(' = ');
        this.visitNode(ast.children[1], state);
        state.pushLine(';');
    };
    HeronToJs.prototype.visit_varDeclStatement = function (ast, state) {
        // varDecls
        var vds = ast.children[0];
        if (vds.name !== "varDecls")
            throw new Error("Expected varDecls as children");
        for (var _i = 0, vds_1 = vds; _i < vds_1.length; _i++) {
            var vd = vds_1[_i];
            state.push("let ");
            state.push(vd.children[0].allText);
            state.push(' = ');
            this.visitNode(vd.children[1], state);
            state.pushLine(';');
        }
    };
    HeronToJs.prototype.visit_whileLoop = function (ast, state) {
        // seq(loopCond,recStatement)
        state.push("while (");
        this.visitNode(ast.children[0], state);
        state.pushLine(")");
        this.visitNode(ast.children[1], state);
    };
    //== 
    // Expressions
    HeronToJs.prototype.visit_arrayExpr = function (ast, state) {
        // seq(expr,expr[0,Infinity])[0,1]
        state.push('$.array(');
        this.delimited(ast.children, state, ", ");
        state.push(')');
    };
    HeronToJs.prototype.visit_arrayIndex = function (ast, state) {
        // expr 
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_assignmentExpr = function (ast, state) {
        this.visitNode(ast.children[0], state);
        state.push(' = ');
        this.visitNode(ast.children[1], state);
    };
    HeronToJs.prototype.visit_conditionalExpr = function (ast, state) {
        if (ast.children.length != 2)
            throw new Error("Expected two children for a conditional expression");
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_conditionalExprRight = function (ast, state) {
        state.push(' ? ');
        this.visitNode(ast.children[0], state);
        state.push(' : ');
        this.visitNode(ast.children[1], state);
    };
    HeronToJs.prototype.visit_funCall = function (ast, state) {
        // seq(expr,expr[0,Infinity])[0,1]
        this.delimited(ast.children, state, ", ");
    };
    HeronToJs.prototype.visit_lambdaArg = function (ast, state) {
        // identifier
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_lambdaArgs = function (ast, state) {
        // choice(lambdaArgsNoParen,lambdaArgsWithParen)
        state.push("(");
        this.visitNode(ast.children[0], state);
        state.push(")");
    };
    HeronToJs.prototype.visit_lambdaArgsNoParen = function (ast, state) {
        // identifier
        state.push(ast.allText);
    };
    HeronToJs.prototype.visit_lambdaArgsWithParen = function (ast, state) {
        // seq(lambdaArg,lambdaArg[0,Infinity])[0,1]
        this.delimited(ast.children, state, ", ");
    };
    HeronToJs.prototype.visit_lambdaBody = function (ast, state) {
        // choice(recCompoundStatement,expr)
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_lambdaExpr = function (ast, state) {
        // seq(lambdaArgs,lambdaBody)
        this.visitNode(ast.children[0], state);
        state.push(" => ");
        this.visitNode(ast.children[1], state);
    };
    HeronToJs.prototype.visit_leafExpr = function (ast, state) {
        // choice(lambdaExpr,parenExpr,arrayExpr,number,bool,string,identifier)
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_number = function (ast, state) {
        // number
        state.push(ast.allText);
    };
    HeronToJs.prototype.visit_objectExpr = function (ast, state) {
        state.push(' { ');
        this.delimited(ast.children, state, ", ");
        state.push(' } ');
    };
    HeronToJs.prototype.visit_objectField = function (ast, state) {
        // identifier, expr
        this.visitNode(ast.children[0], state);
        state.push(' : ');
        this.visitNode(ast.children[1], state);
    };
    HeronToJs.prototype.visit_parenExpr = function (ast, state) {
        // expr
        state.push('(');
        this.visitChildren(ast, state);
        state.push(')');
    };
    HeronToJs.prototype.visit_postfixExpr = function (ast, state) {
        // seq(leafExpr, postfixOp[0,Infinity])
        if (ast.children.length != 2)
            throw new Error("Expected two children for a postfix expression");
        var astFirst = ast.children[0];
        var astLast = ast.children[1];
        switch (astLast.name) {
            case "fieldSelect":
                // Field selects are transformed into function calls. 
                state.push(astLast.children[0].allText);
                state.push("(");
                this.visitNode(astFirst, state);
                state.push(")");
                break;
            case "funCall":
                state.push("(");
                this.visitNode(astFirst, state);
                state.push(")(");
                this.visitNode(astLast, state);
                state.push(")");
                break;
            case "arrayIndex":
                state.push("$.at((");
                this.visitNode(astFirst, state);
                state.push("), ");
                this.visitNode(astLast, state);
                state.push(")");
                break;
            case "postIncOp":
                state.push("(");
                this.visitNode(astFirst, state);
                state.push(")++");
                break;
            case "postDecOp":
                state.push("(");
                this.visitNode(astFirst, state);
                state.push(")--");
                break;
            default:
                throw new Error("Unrecognized child node type: " + astLast.name);
        }
    };
    HeronToJs.prototype.visit_prefixExpr = function (ast, state) {
        this.visitChildren(ast, state);
    };
    HeronToJs.prototype.visit_prefixOp = function (ast, state) {
        state.push(ast.allText);
    };
    HeronToJs.prototype.visit_rangeExpr = function (ast, state) {
        if (ast.children.length != 2)
            throw new Error("Range expression should have two children");
        state.push("$.range(");
        this.visitNode(ast.children[0], state);
        state.push(", ");
        this.visitNode(ast.children[1], state);
        state.push(")");
    };
    HeronToJs.prototype.visit_string = function (ast, state) {
        // choice(doubleQuotedStringContents,singleQuotedStringContents)
        state.push(ast.allText);
    };
    // This is a classic transformation from Lisp/Scheme of a "let" form into a 
    // lambda-expression with immediate application. What is gives us is the ability 
    // is to use variable declarations in an expression.
    // (let ((x y)) expr) => ((lambda (x) expr)(y))
    // Heron is not pretentious about it though, and just uses familiar syntax:
    // (var x = y in expr)
    HeronToJs.prototype.visit_varExpr = function (ast, state) {
        var vds = ast.children[0];
        if (vds.name !== "varDecls")
            throw new Error("Expected varDecls as children");
        state.push("(function(");
        for (var i = 0; i < vds.children.length; ++i) {
            if (i > 0)
                state.push(", ");
            var vd = vds.children[i];
            state.push(vd.children[0].allText);
        }
        state.push(") { return ");
        this.visitNode(ast.children[1], state);
        state.push("; })(");
        for (var i = 0; i < vds.children.length; ++i) {
            if (i > 0)
                state.push(", ");
            var vd = vds.children[i];
            this.visitNode(vd.children[1], state);
        }
        state.push(")");
    };
    return HeronToJs;
}());
//# sourceMappingURL=heron-to-js.js.map