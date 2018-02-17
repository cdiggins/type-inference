"use strict";
// https://github.com/burg/glsl-simulator/blob/master/src/glsl.pegjs
// https://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf
Object.defineProperty(exports, "__esModule", { value: true });
var myna_parser_1 = require("myna-parser");
// Defines a Myna grammar for parsing Cat expressions that support the introduction and usage of scoped variables. 
var g = new function () {
    var _this = this;
    // Helpers
    this.eos = myna_parser_1.Myna.text(";");
    this.untilEol = myna_parser_1.Myna.advanceWhileNot(myna_parser_1.Myna.end.or(myna_parser_1.Myna.newLine)).then(myna_parser_1.Myna.advanceUnless(myna_parser_1.Myna.end));
    // Comments and whitespace 
    this.fullComment = myna_parser_1.Myna.guardedSeq("/*", myna_parser_1.Myna.advanceUntilPast("*/"));
    this.lineComment = myna_parser_1.Myna.seq("//", this.untilEol);
    this.comment = this.fullComment.or(this.lineComment).ws.oneOrMore;
    this.ws = this.comment.or(myna_parser_1.Myna.ws);
    // Helper for whitespace delimited sequences that must start with a specific value
    function guardedWsDelimSeq() {
        var rules = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            rules[_i] = arguments[_i];
        }
        return _this.ws.then(myna_parser_1.Myna.guardedSeq.apply(myna_parser_1.Myna, rules.map(function (r) { return myna_parser_1.Myna.seq(r, _this.ws); })));
    }
    function commaDelimited(rule) {
        return myna_parser_1.Myna.delimited(rule, myna_parser_1.Myna.seq(_this.ws, ',', _this.ws)).then(_this.ws);
    }
    // Recursive definition of an expression
    this.expr = myna_parser_1.Myna.delay(function () {
        return _this.expr0;
    });
    // Recursive definition of a statement
    this.recStatement = myna_parser_1.Myna.delay(function () {
        return _this.statement;
    });
    // Literals
    this.fraction = myna_parser_1.Myna.seq(".", myna_parser_1.Myna.not("."), myna_parser_1.Myna.digit.zeroOrMore);
    this.plusOrMinus = myna_parser_1.Myna.char("+-");
    this.exponent = myna_parser_1.Myna.seq(myna_parser_1.Myna.char("eE"), this.plusOrMinus.opt, myna_parser_1.Myna.digits);
    this.bool = myna_parser_1.Myna.keywords("true", "false").ast;
    this.number = myna_parser_1.Myna.seq(this.plusOrMinus.opt, myna_parser_1.Myna.integer, this.fraction.opt, this.exponent.opt).ast;
    /* TODO: if we want to get fancy in the future, we can really support JavaScript string funkiness.
    this.lf = m.char("\u000a");
    this.cr = m.char("\u000D");
    this.ls = m.char("\u2028");
    this.ps = m.char("\u2029");
    this.lineTerminator = m.choice(this.lf, this.cr, this.ls, this.ps).ast;
    this.lineTerminatorSequence = m.choice(this.lf, this.cr.thenNot(this.lf), this.ls, this.ps, this.cr.then(this.lf));
    this.lineContinuation = m.seq('\\', this.lineTerminatorSequence).ast;
    */
    this.escapeChar = myna_parser_1.Myna.char('\'"\\bfnrtv');
    this.escapedLiteralChar = myna_parser_1.Myna.char('\\').then(this.escapeChar);
    this.stringLiteralChar = myna_parser_1.Myna.notChar("\u005C\u000D\u2028\u2029\u000A\\").or(this.escapedLiteralChar).ast;
    this.doubleQuotedStringContents = myna_parser_1.Myna.not('"').then(this.stringLiteralChar).zeroOrMore.ast;
    this.singleQuotedStringContents = myna_parser_1.Myna.not("'").then(this.stringLiteralChar).zeroOrMore.ast;
    this.doubleQuote = myna_parser_1.Myna.seq('"', this.doubleQuotedStringContents, '"');
    this.singleQuote = myna_parser_1.Myna.seq("'", this.singleQuotedStringContents, "'");
    this.string = this.doubleQuote.or(this.singleQuote).ast;
    this.literal = myna_parser_1.Myna.choice(this.number, this.bool, this.string);
    this.identifier = myna_parser_1.Myna.identifier.ast;
    // Operators 
    this.relationalOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "<= >= < >".split(" ")).ast;
    this.equalityOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "== !=".split(" ")).ast;
    this.prefixOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "++ -- + - !".split(" ")).thenNot('=').ast;
    this.assignmentOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "+= -= *= /= %= =".split(" ")).ast;
    this.additiveOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "+ -".split(" ")).thenNot('=').ast;
    this.multiplicativeOp = myna_parser_1.Myna.choice.apply(myna_parser_1.Myna, "* / %".split(" ")).thenNot('=').ast;
    // Postfix expressions
    this.funCall = guardedWsDelimSeq("(", commaDelimited(this.expr), ")").ast;
    this.arrayStride = guardedWsDelimSeq(":", this.expr).ast;
    this.arraySlice = guardedWsDelimSeq(":", this.expr, this.arrayStride.opt).ast;
    this.arrayIndex = guardedWsDelimSeq("[", this.expr, this.arraySlice.opt, "]").ast;
    this.fieldSelect = myna_parser_1.Myna.seq(myna_parser_1.Myna.not(".."), guardedWsDelimSeq(".", this.identifier)).ast;
    this.postfixExpr = myna_parser_1.Myna.choice(this.funCall, this.arrayIndex, this.fieldSelect, "++", "--").then(this.ws).ast;
    // Expressions of different precedences 
    this.arrayExpr = guardedWsDelimSeq("[", commaDelimited(this.expr), "]").ast;
    this.parenExpr = guardedWsDelimSeq("(", this.expr, ")").ast;
    // Lambda expression 
    this.recCompoundStatement = myna_parser_1.Myna.delay(function () { return _this.compoundStatement; }).ast;
    this.lambdaArg = this.identifier.then(this.ws).ast;
    this.lambdaBody = this.recCompoundStatement.or(this.expr).ast;
    this.lambdaArgsNoParen = this.lambdaArg;
    this.lambdaArgsWithParen = myna_parser_1.Myna.seq("(", this.ws, commaDelimited(this.lambdaArg), ")", this.ws);
    this.lambdaArgs = myna_parser_1.Myna.choice(this.lambdaArgsNoParen, this.lambdaArgsWithParen).ast;
    this.lambdaExpr = myna_parser_1.Myna.seq(this.lambdaArgs, guardedWsDelimSeq("=>", this.lambdaBody)).ast;
    this.leafExpr = myna_parser_1.Myna.choice(this.lambdaExpr, this.parenExpr, this.arrayExpr, this.literal, this.identifier).then(this.ws).ast;
    this.multiplicativeExprLeft = this.prefixOp.zeroOrMore.then(this.leafExpr).then(this.postfixExpr.zeroOrMore).ast;
    this.multiplicativeExprRight = guardedWsDelimSeq(this.multiplicativeOp, this.multiplicativeExprLeft).ast;
    this.additiveExprLeft = this.multiplicativeExprLeft.then(this.multiplicativeExprRight.zeroOrMore).ast;
    this.additiveExprRight = guardedWsDelimSeq(this.additiveOp, this.additiveExprLeft).ast;
    this.relationalExprLeft = this.additiveExprLeft.then(this.additiveExprRight.zeroOrMore).ast;
    this.relationalExprRight = guardedWsDelimSeq(this.relationalOp, this.relationalExprLeft).ast;
    this.equalityExprLeft = this.relationalExprLeft.then(this.relationalExprRight.zeroOrMore).ast;
    this.equalityExprRight = guardedWsDelimSeq(this.equalityOp, this.equalityExprLeft).ast;
    this.logicalAndExprLeft = this.equalityExprLeft.then(this.equalityExprRight.zeroOrMore).ast;
    this.logicalAndExprRight = guardedWsDelimSeq("&&", this.logicalAndExprLeft).ast;
    this.logicalXOrExprLeft = this.logicalAndExprLeft.then(this.logicalAndExprRight.zeroOrMore).ast;
    this.logicalXOrExprRight = guardedWsDelimSeq("^^", this.logicalXOrExprLeft).ast;
    this.logicalOrExprLeft = this.logicalXOrExprLeft.then(this.logicalXOrExprRight.zeroOrMore).ast;
    this.logicalOrExprRight = guardedWsDelimSeq("||", this.logicalOrExprLeft).ast;
    this.rangeExprLeft = this.logicalOrExprLeft.then(this.logicalOrExprRight.zeroOrMore).ast;
    this.rangeExprRight = guardedWsDelimSeq("..", this.rangeExprLeft).ast;
    this.conditionalExprLeft = this.rangeExprLeft.then(this.rangeExprRight.opt).ast;
    this.conditionalExprRight = guardedWsDelimSeq("?", this.expr, ":", this.expr).ast;
    this.assignmentExprLeft = this.conditionalExprLeft.then(this.conditionalExprRight.opt).ast;
    this.assignmentExprRight = guardedWsDelimSeq(this.assignmentOp, this.assignmentExprLeft).ast;
    this.sequenceExprLeft = this.assignmentExprLeft.then(this.assignmentExprRight.zeroOrMore).ast;
    this.sequenceExprRight = guardedWsDelimSeq(",", this.sequenceExprLeft).ast;
    this.expr0 = this.sequenceExprLeft.then(this.sequenceExprRight.zeroOrMore);
    // Statements 
    this.exprStatement = this.expr.then(this.ws).then(this.eos).ast;
    this.varNameDecl = this.identifier.ast;
    this.varInitialization = guardedWsDelimSeq("=", this.expr).ast;
    this.varDecl = guardedWsDelimSeq(myna_parser_1.Myna.keyword("var"), this.identifier, this.varInitialization, this.eos).ast;
    this.loopCond = guardedWsDelimSeq("(", this.expr, ")").ast;
    this.forLoop = guardedWsDelimSeq(myna_parser_1.Myna.keyword("for"), "(", myna_parser_1.Myna.keyword("var"), this.identifier, myna_parser_1.Myna.keyword("in"), this.expr, ")", this.recStatement).ast;
    this.whileLoop = guardedWsDelimSeq(myna_parser_1.Myna.keyword("while"), this.loopCond, this.recStatement).ast;
    this.doLoop = guardedWsDelimSeq(myna_parser_1.Myna.keyword("do"), this.recStatement, myna_parser_1.Myna.keyword("while"), this.loopCond).ast;
    this.elseStatement = guardedWsDelimSeq(myna_parser_1.Myna.keyword("else"), this.recStatement).ast;
    this.ifCond = guardedWsDelimSeq("(", this.expr, ")").ast;
    this.ifStatement = guardedWsDelimSeq(myna_parser_1.Myna.keyword("if"), this.ifCond, this.recStatement, this.elseStatement.zeroOrMore).ast;
    this.compoundStatement = guardedWsDelimSeq("{", this.recStatement.zeroOrMore, "}").ast;
    this.breakStatement = guardedWsDelimSeq(myna_parser_1.Myna.keyword("break"), this.eos).ast;
    this.continueStatement = guardedWsDelimSeq(myna_parser_1.Myna.keyword("continue"), this.eos).ast;
    this.returnStatement = guardedWsDelimSeq(myna_parser_1.Myna.keyword("return"), this.expr.opt, this.eos).ast;
    this.emptyStatement = this.eos.ast;
    this.funcParamName = this.identifier.ast;
    this.funcName = this.identifier.ast;
    this.funcParam = this.identifier.ast;
    this.funcDef = guardedWsDelimSeq(myna_parser_1.Myna.keyword("function"), this.funcName, "(", commaDelimited(this.funcParam), ")", this.compoundStatement).ast;
    this.statement = myna_parser_1.Myna.choice(this.emptyStatement, this.compoundStatement, this.ifStatement, this.returnStatement, this.continueStatement, this.breakStatement, this.forLoop, this.doLoop, this.whileLoop, this.varDecl, this.exprStatement, this.funcDef).then(this.ws).ast;
    this.topLevelStatement = myna_parser_1.Myna.choice(this.emptyStatement, this.compoundStatement, this.ifStatement, this.forLoop, this.doLoop, this.whileLoop, this.varDecl, this.exprStatement, this.funcDef).then(this.ws).ast;
    this.moduleName = this.identifier.then(myna_parser_1.Myna.seq('.', this.identifier).zeroOrMore).ast;
    this.module = guardedWsDelimSeq(myna_parser_1.Myna.keyword('module'), this.moduleName, '{', this.topLevelStatement.zeroOrMore, '}');
    //this.program = m.seq(this.ws, this.topLevelStatement.then(this.ws).zeroOrMore);
};
// Register the grammar, providing a name and the default parse rule
myna_parser_1.Myna.registerGrammar('heron', g, g.module);
exports.heronGrammar = myna_parser_1.Myna.grammars['heron'];
exports.heronParser = myna_parser_1.Myna.parsers['heron'];
function parseHeron(s) {
    var ast = exports.heronParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");
    return ast;
}
exports.parseHeron = parseHeron;
//# sourceMappingURL=heron-parser.js.map