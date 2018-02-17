// https://github.com/burg/glsl-simulator/blob/master/src/glsl.pegjs
// https://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf

import { Myna as m } from "myna-parser";

// Defines a Myna grammar for parsing Cat expressions that support the introduction and usage of scoped variables. 
const g = new function() {
    var _this = this;

    // Helpers
    this.eos            = m.text(";");
    this.untilEol       = m.advanceWhileNot(m.end.or(m.newLine)).then(m.advanceUnless(m.end));

    // Comments and whitespace 
    this.fullComment    = m.guardedSeq("/*", m.advanceUntilPast("*/"));
    this.lineComment    = m.seq("//", this.untilEol);
    this.comment        = this.fullComment.or(this.lineComment).ws.oneOrMore;
    this.ws             = this.comment.or(m.ws);

    // Helper for whitespace delimited sequences that must start with a specific value
    function guardedWsDelimSeq(...rules) {
        return _this.ws.then(m.guardedSeq(...rules.map(r => m.seq(r, _this.ws))));
    }

    function commaDelimited(rule: m.RuleType) {
        return m.delimited(rule, m.seq(_this.ws, ',', _this.ws)).then(_this.ws);
    }
    
    // Recursive definition of an expression
    this.expr = m.delay(function() {
        return _this.expr0;
    });

    // Recursive definition of a statement
    this.recStatement = m.delay(function() {
        return _this.statement;
    });

    // Literals
    this.fraction       = m.seq(".", m.not("."),  m.digit.zeroOrMore);    
    this.plusOrMinus    = m.char("+-");
    this.exponent       = m.seq(m.char("eE"), this.plusOrMinus.opt, m.digits); 
    this.bool           = m.keywords("true", "false").ast;
    this.number         = m.seq(this.plusOrMinus.opt, m.integer, this.fraction.opt, this.exponent.opt).ast;

    /* TODO: if we want to get fancy in the future, we can really support JavaScript string funkiness.  
    this.lf = m.char("\u000a");
    this.cr = m.char("\u000D");
    this.ls = m.char("\u2028");
    this.ps = m.char("\u2029");
    this.lineTerminator = m.choice(this.lf, this.cr, this.ls, this.ps).ast;
    this.lineTerminatorSequence = m.choice(this.lf, this.cr.thenNot(this.lf), this.ls, this.ps, this.cr.then(this.lf));
    this.lineContinuation = m.seq('\\', this.lineTerminatorSequence).ast;
    */

    this.escapeChar = m.char('\'"\\bfnrtv');    
    this.escapedLiteralChar = m.char('\\').then(this.escapeChar);    
    this.stringLiteralChar = m.notChar("\u005C\u000D\u2028\u2029\u000A\\").or(this.escapedLiteralChar).ast;

    this.doubleQuotedStringContents = m.not('"').then(this.stringLiteralChar).zeroOrMore.ast;
    this.singleQuotedStringContents = m.not("'").then(this.stringLiteralChar).zeroOrMore.ast;
    this.doubleQuote = m.seq('"', this.doubleQuotedStringContents, '"');
    this.singleQuote = m.seq("'", this.singleQuotedStringContents, "'");
    this.string = this.doubleQuote.or(this.singleQuote).ast;
    
    this.literal        = m.choice(this.number, this.bool, this.string);
    this.identifier     = m.identifier.ast;

    // Operators 
    this.relationalOp       = m.choice(..."<= >= < >".split(" ")).ast;
    this.equalityOp         = m.choice(..."== !=".split(" ")).ast;
    this.prefixOp           = m.choice(..."++ -- + - !".split(" ")).thenNot('=').ast;
    this.assignmentOp       = m.choice(..."+= -= *= /= %= =".split(" ")).ast;
    this.additiveOp         = m.choice(..."+ -".split(" ")).thenNot('=').ast;
    this.multiplicativeOp   = m.choice(..."* / %".split(" ")).thenNot('=').ast;
    
    // Postfix expressions
    this.funCall = guardedWsDelimSeq("(", commaDelimited(this.expr), ")").ast;
    this.arrayStride = guardedWsDelimSeq(":", this.expr).ast;
    this.arraySlice = guardedWsDelimSeq(":", this.expr, this.arrayStride.opt).ast;
    this.arrayIndex = guardedWsDelimSeq("[", this.expr, this.arraySlice.opt, "]").ast;
    this.fieldSelect = m.seq(m.not(".."), guardedWsDelimSeq(".", this.identifier)).ast;
    this.postfixExpr = m.choice(this.funCall, this.arrayIndex, this.fieldSelect, "++", "--").then(this.ws).ast;

    // Expressions of different precedences 
    this.arrayExpr = guardedWsDelimSeq("[", commaDelimited(this.expr), "]").ast;
    this.parenExpr = guardedWsDelimSeq("(", this.expr, ")").ast;

    // Lambda expression 
    this.recCompoundStatement = m.delay(() => _this.compoundStatement).ast;
    this.lambdaArg = this.identifier.then(this.ws).ast;
    this.lambdaBody = this.recCompoundStatement.or(this.expr).ast;
    this.lambdaArgsNoParen = this.lambdaArg.ast;
    this.lambdaArgsWithParen = m.seq("(", this.ws, commaDelimited(this.lambdaArg), ")", this.ws).ast;
    this.lambdaArgs = m.choice(this.lambdaArgsNoParen, this.lambdaArgsWithParen).ast;
    this.lambdaExpr = m.seq(this.lambdaArgs, guardedWsDelimSeq("=>", this.lambdaBody)).ast;
    
    this.leafExpr = m.choice(this.lambdaExpr, this.parenExpr, this.arrayExpr, this.literal, this.identifier).then(this.ws).ast;
    
    this.multiplicativeExprLeft = this.prefixOp.zeroOrMore.then(this.leafExpr).then(this.postfixExpr.zeroOrMore).ast;
    this.multiplicativeExprRight = guardedWsDelimSeq(this.multiplicativeOp, this.multiplicativeExprLeft).ast
    this.additiveExprLeft = this.multiplicativeExprLeft.then(this.multiplicativeExprRight.zeroOrMore).ast;
    this.additiveExprRight = guardedWsDelimSeq(this.additiveOp, this.additiveExprLeft).ast        
    this.relationalExprLeft = this.additiveExprLeft.then(this.additiveExprRight.zeroOrMore).ast;
    this.relationalExprRight = guardedWsDelimSeq(this.relationalOp, this.relationalExprLeft).ast;
    this.equalityExprLeft = this.relationalExprLeft.then(this.relationalExprRight.zeroOrMore).ast;
    this.equalityExprRight = guardedWsDelimSeq(this.equalityOp, this.equalityExprLeft).ast;
    this.logicalAndExprLeft = this.equalityExprLeft.then(this.equalityExprRight.zeroOrMore).ast;
    this.logicalAndExprRight = guardedWsDelimSeq("&&", this.logicalAndExprLeft).ast;
    this.logicalXOrExprLeft = this.logicalAndExprLeft.then(this.logicalAndExprRight.zeroOrMore).ast;
    this.logicalXOrExprRight = guardedWsDelimSeq("^^", this.logicalXOrExprLeft).ast;
    this.logicalOrExprLeft = this.logicalXOrExprLeft.then(this.logicalXOrExprRight.zeroOrMore).ast;
    this.logicalOrExprRight = guardedWsDelimSeq("||",  this.logicalOrExprLeft).ast;
    this.rangeExprLeft = this.logicalOrExprLeft.then(this.logicalOrExprRight.zeroOrMore).ast;
    this.rangeExprRight = guardedWsDelimSeq("..",  this.rangeExprLeft).ast;
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
    this.varDecl = guardedWsDelimSeq(m.keyword("var"), this.identifier, this.varInitialization, this.eos).ast;        
    this.loopCond = guardedWsDelimSeq("(", this.expr, ")").ast;
    this.forLoop = guardedWsDelimSeq(m.keyword("for"), "(", m.keyword("var"), this.identifier, m.keyword("in"), this.expr, ")", this.recStatement).ast;
    this.whileLoop = guardedWsDelimSeq(m.keyword("while"), this.loopCond, this.recStatement).ast;
    this.doLoop = guardedWsDelimSeq(m.keyword("do"), this.recStatement, m.keyword("while"), this.loopCond).ast;
    this.elseStatement = guardedWsDelimSeq(m.keyword("else"), this.recStatement).ast;
    this.ifCond = guardedWsDelimSeq("(", this.expr, ")").ast;
    this.ifStatement = guardedWsDelimSeq(m.keyword("if"), this.ifCond, this.recStatement, this.elseStatement.zeroOrMore).ast;
    this.compoundStatement = guardedWsDelimSeq("{", this.recStatement.zeroOrMore, "}").ast;
    this.breakStatement = guardedWsDelimSeq(m.keyword("break"), this.eos).ast;
    this.continueStatement = guardedWsDelimSeq(m.keyword("continue"), this.eos).ast;
    this.returnStatement = guardedWsDelimSeq(m.keyword("return"), this.expr.opt, this.eos).ast;
    this.emptyStatement = this.eos.ast;

    this.funcParamName = this.identifier.ast;
    this.funcName = this.identifier.ast;
    this.funcParam = this.identifier.ast;        
    this.funcDef = guardedWsDelimSeq(m.keyword("function"), this.funcName, "(", commaDelimited(this.funcParam), ")", this.compoundStatement).ast;

    this.statement = m.choice(
        this.emptyStatement,
        this.compoundStatement,
        this.ifStatement,
        this.returnStatement, 
        this.continueStatement, 
        this.breakStatement, 
        this.forLoop, 
        this.doLoop, 
        this.whileLoop, 
        this.varDecl,
        this.exprStatement,
        this.funcDef,            
    ).then(this.ws).ast;

    this.topLevelStatement = m.choice(
        this.emptyStatement,
        this.compoundStatement,
        this.ifStatement,
        this.forLoop, 
        this.doLoop, 
        this.whileLoop, 
        this.varDecl,
        this.exprStatement,
        this.funcDef,            
    ).then(this.ws).ast;

    this.moduleName = this.identifier.then(m.seq('.', this.identifier).zeroOrMore).ast;
    this.module = guardedWsDelimSeq(m.keyword('module'), this.moduleName, '{', this.topLevelStatement.zeroOrMore, '}');

    //this.program = m.seq(this.ws, this.topLevelStatement.then(this.ws).zeroOrMore);
};

// Register the grammar, providing a name and the default parse rule
m.registerGrammar('heron', g, g.module);

export const heronGrammar = m.grammars['heron'];
export const heronParser  = m.parsers['heron'];

export function parseHeron(s: string) : m.AstNode {
    var ast = heronParser(s);
    if (ast.end != s.length)
        throw new Error("Whole input was not parsed");        
    return ast;
}
