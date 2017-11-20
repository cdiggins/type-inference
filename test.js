"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_inference_1 = require("./type_inference");
var myna_1 = require("./node_modules/myna-parser/myna");
function typeToString(t) {
    if (t instanceof type_inference_1.TypeInference.TypeVariable)
        return "'" + t.name;
    else if (t instanceof type_inference_1.TypeInference.TypeConstant)
        return t.name;
    else if (t instanceof type_inference_1.TypeInference.TypeList)
        return "[" + t.types.map(typeToString).join(" ") + "]";
    else
        throw new Error("Can't recognize type " + t);
}
exports.typeToString = typeToString;
function RegisterGrammars() {
    var typeGrammar = new function () {
        var _this = this;
        this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
        this.typeList = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ']').ast;
        this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
        this.typeConstant = myna_1.Myna.identifier.ast;
        this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeVar, this.typeConstant).ast;
    };
    var catGrammar = new function () {
        var _this = this;
        this.recTerm = myna_1.Myna.delay(function () { return _this.term; });
        this.quotation = myna_1.Myna.guardedSeq('[', myna_1.Myna.ws, this.recTerm.ws.zeroOrMore, ']').ast;
        this.term = myna_1.Myna.choice(this.quotation, myna_1.Myna.identifier, myna_1.Myna.integer).ast;
        this.definedName = myna_1.Myna.identifier.ast;
        this.definition = myna_1.Myna.guardedSeq(myna_1.Myna.keyword('define').ws, this.definedName, myna_1.Myna.guardedSeq('{', this.term.zeroOrMore, '}')).ast;
        this.program = myna_1.Myna.choice(this.definition, this.term).zeroOrMore.ast;
    };
    myna_1.Myna.registerGrammar("type", typeGrammar, typeGrammar.typeExpr);
    myna_1.Myna.registerGrammar("cat", catGrammar, catGrammar.program);
    function stringToType(input) {
        var ast = myna_1.Myna.parse(typeGrammar.typeExpr, input);
        return astToType(ast);
    }
    function astToType(ast) {
        if (!ast)
            throw new Error("Missing AST node");
        switch (ast.name) {
            case "typeVar":
                return new type_inference_1.TypeInference.TypeVariable(ast.allText.substr(1));
            case "typeConstant":
                return new type_inference_1.TypeInference.TypeConstant(ast.allText);
            case "typeList":
                return new type_inference_1.TypeInference.TypeList(ast.children.map(astToType));
            case "typeExpr":
                if (ast.children.length != 1)
                    throw new Error("Expected only one child of node, not " + ast.children.length);
                return astToType(ast.children[0]);
            default:
                throw new Error("Unrecognized type expression: " + ast.name);
        }
    }
    function TestParseType(input) {
        var ast = myna_1.Myna.parsers["type"](input);
        // console.log(ast);
        var t = astToType(ast);
        console.log("input = " + typeToString(t));
    }
    TestParseType("abc");
    TestParseType("'abc");
    TestParseType("[]");
    TestParseType("[ ]");
    TestParseType("[a]");
    TestParseType("[ab cd]");
    TestParseType("[ab [cd] [ef]]");
    TestParseType("[[][a][[]b]'abc]");
}
RegisterGrammars();
function printVarType(name, t) {
    console.log(name + " : " + typeToString(t));
}
function printConstraint(tc) {
    console.log("type constraint " + typeToString(tc.typeSrc) + " <=> " + typeToString(tc.typeDest));
}
function printUnifier(name, u, te) {
    var t = te.getUnifiedType(u.unifier);
    console.log("Type unifier for " + name
        + ", variable " + typeToString(u.variable)
        + ", unifier " + typeToString(t)
        + ", raw type " + typeToString(u.unifier));
}
function printEngineState(te) {
    console.log("# Type Inference Engine State");
    console.log("## Variables");
    for (var v in te.varToType)
        printVarType(v, te.varToType[v]);
    console.log("## Constraints");
    for (var _i = 0, _a = te.constraints; _i < _a.length; _i++) {
        var tc = _a[_i];
        printConstraint(tc);
    }
    console.log("## Type Unifiers");
    for (var k in te.unifiers)
        printUnifier(k, te.unifiers[k], te);
}
{
    console.log("Constraint Tests");
    {
        console.log("");
        console.log("# Test A");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test B");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeVariable('U'));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInference.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t1, t2);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test C");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeConstant('int'), new type_inference_1.TypeInference.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('V'), new type_inference_1.TypeInference.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('U'), new type_inference_1.TypeInference.TypeVariable('V')]));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t0, t2);
        te.addReturnStatement(t3, null);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test Recursion");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('T'), new type_inference_1.TypeInference.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }
    {
        console.log("");
        console.log("# Test Row Variables");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('T'), new type_inference_1.TypeInference.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeConstant('int'), new type_inference_1.TypeInference.TypeConstant('float'), new type_inference_1.TypeInference.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        printEngineState(te);
    }
}
process.exit();
//# sourceMappingURL=test.js.map