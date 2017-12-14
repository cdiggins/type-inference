"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var myna_1 = require("./node_modules/myna-parser/myna");
var type_inference_core_1 = require("./type_inference_core");
var TypeParser;
(function (TypeParser) {
    function registerGrammars() {
        var typeGrammar = new function () {
            var _this = this;
            this.typeExprRec = myna_1.Myna.delay(function () { return _this.typeExpr; });
            this.typeList = myna_1.Myna.guardedSeq('(', myna_1.Myna.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
            this.typeVar = myna_1.Myna.guardedSeq("'", myna_1.Myna.identifier).ast;
            this.typeConstant = myna_1.Myna.identifier.ast;
            this.typeExpr = myna_1.Myna.choice(this.typeList, this.typeVar, this.typeConstant).ast;
        };
        myna_1.Myna.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);
    }
    registerGrammars();
    var parser = myna_1.Myna.parsers['type'];
    function stringToType(input) {
        var ast = parser(input);
        return astToType(ast);
    }
    TypeParser.stringToType = stringToType;
    function astToType(ast) {
        if (!ast)
            return null;
        switch (ast.name) {
            case "typeVar":
                return new type_inference_core_1.TypeInferenceCore.TypeVariable(ast.allText.substr(1));
            case "typeConstant":
                return new type_inference_core_1.TypeInferenceCore.TypeConstant(ast.allText);
            case "typeList":
                return new type_inference_core_1.TypeInferenceCore.TypeList(ast.children.map(astToType));
            case "typeExpr":
                if (ast.children.length != 1)
                    throw new Error("Expected only one child of node, not " + ast.children.length);
                return astToType(ast.children[0]);
            default:
                throw new Error("Unrecognized type expression: " + ast.name);
        }
    }
    TypeParser.astToType = astToType;
})(TypeParser = exports.TypeParser || (exports.TypeParser = {}));
//# sourceMappingURL=type_parser.js.map