"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var myna_parser_1 = require("myna-parser");
var heron_parser_1 = require("./heron-parser");
var heron_to_js_1 = require("./heron-to-js");
var myna_1 = require("myna-parser/myna");
var g = heron_parser_1.heronGrammar;
var assert = require('assert');
// Tests parsing an individual rule against the input input text, and returns an object 
// representing the result of running the test 
function testParse(rule, assert, text, shouldPass) {
    if (shouldPass == undefined)
        shouldPass = true;
    var result = myna_parser_1.Myna.failed;
    var err = undefined;
    try {
        var node = myna_parser_1.Myna.parse(rule, text);
        if (node)
            result = node.end;
    }
    catch (e) {
        err = e;
    }
    var testResult = {
        name: rule.toString() + ' with input "' + text + '"',
        description: result + "/" + text.length,
        negative: !shouldPass,
        success: (result === text.length) !== !shouldPass,
        error: err,
        ruleDescr: rule.type + ": " + rule.toString(),
        rule: rule
    };
    if (!testResult.success)
        console.log(testResult);
    assert.ok(testResult.success, testResult.name + (shouldPass ? "" : " should fail"));
}
var ruleTests = [
    [g.comment, ['/* abc */', '// abc \n', '/* abc */ /* def */ '], ['abc', '', '/*']],
    [g.funCall, ['(a, b)', '(a)', '(F )', '()'], []],
    [g.expr, ['42', '3+4', '3 + 4', '3 * (2 + 4)', '3 * 2 + 4', 'a', 'a++', 'f(1,2)', 'f(3, 5)', 'f()', 'f(12)', 'hx > 0.0'], []],
    [g.expr, ['0..1', '0 .. 1', 'f(a .. b)'], ['xs[0:5]', 'xs[4:0:-1]']],
    [g.expr, ['x => 42', '(x) => 13', 'x=>3', 'x => { return 42; }', '(x, y) => x * y'], []],
    [g.expr, ['(3)', '(3 + 2)', '(c)', '(a)+(b)', 'a+(b)', 'a+b+c', 'a?b:c', 'a?b+c:d', 'a?b:c+d', 'a?(b):c', '(a)?b:c'], []],
    [g.expr, ['a?b:(c)'], ['f > max ? max : (f < min ? min) : f']],
    [g.expr, ['a?b:c', 'a?b:c?d:e', 'a?b:(c<d?e:f)', 'a>3?b:c', 'a > 3 ? b : c', 'f > max ? max : (f < min ? min : f)'], []],
    [g.statement, [
            'var x = 0;',
            'f();',
            'if (x) f();',
            'if (x) f(); else g();',
            'return;',
            ';',
            'var test = 1;\n /* */',
            'return p;',
            'if (hx) return p;',
            'if (hx > 0.0) return p;',
            'if(hx > 0.0) return p;',
        ],
        [
            'f()',
            'return 42',
            'g',
            ';;',
        ]]
];
for (var _i = 0, ruleTests_1 = ruleTests; _i < ruleTests_1.length; _i++) {
    var ruleTest = ruleTests_1[_i];
    var rule = ruleTest[0];
    for (var _a = 0, _b = ruleTest[1]; _a < _b.length; _a++) {
        var passInput = _b[_a];
        testParse(rule, assert, passInput, true);
    }
    for (var _c = 0, _d = ruleTest[2]; _c < _d.length; _c++) {
        var failInput = _d[_c];
        testParse(rule, assert, failInput, false);
    }
}
var fs = require('fs');
function testParseFile(f) {
    var heronTest = fs.readFileSync(f, 'utf-8');
    var ast = heron_parser_1.parseHeron(heronTest);
    var cb = heron_to_js_1.heronToJs(ast);
    console.log(cb.toString());
}
// TEMP: 
console.log(myna_1.Myna.astSchemaToString('heron'));
//testParseFile('.\\tests\\seascape.heron');
//testParseFile('.\\tests\\stdlib.heron');
testParseFile('.\\tests\\geometry-vector3.heron');
process.exit();
//# sourceMappingURL=heron-parser-tests.js.map