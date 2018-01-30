"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cat_parser_1 = require("./cat-parser");
// Rewriting rules 
exports.catRewriteRuleDefs = {
    "id": "",
    "swap swap": "",
    "dup pop": "",
    "quote apply": "",
    "quote pop": "",
    "$1 pop": "",
    "$1 dup": "$1 $1",
    "$1 $2 swap": "$2 $1",
    "$1 quote": "[$1]",
    "[$1] apply": "$1",
    "[$1] [$2] compose": "[$1 $2]",
    "[$1] [$2] papply": "[[$1] $2]",
    "[$1] dip [$2] dip": "[$1 $2] dip",
    "$1 $2 dip": "$2 apply $1",
};
var RewriteRule = /** @class */ (function () {
    function RewriteRule(src, target) {
        this.src = src;
        this.target = target;
    }
    return RewriteRule;
}());
exports.catRewriteRules = Object.keys(exports.catRewriteRuleDefs).map(function (k) { return new RewriteRule(cat_parser_1.parseCat(k), cat_parser_1.parseCat(exports.catRewriteRuleDefs[k])); });
function isValue(expr) {
    return expr instanceof cat_parser_1.CatQuotation || expr instanceof cat_parser_1.CatVar || expr instanceof cat_parser_1.CatConstant;
}
// Given a Cat expression representing a pattern, returns true if the array of expressions matches 
// from the given position. All captures are added to the matches object. 
function matchPattern(expr, pattern, matches, pos) {
    if (pos === void 0) { pos = 0; }
    // Check that there are enough terms to match the pattern 
    if (pos + pattern.length > expr.length)
        return false;
    for (var i = 0; i < pattern.length; ++i) {
        var p = pattern[i];
        var x = expr[i + pos];
        if (p instanceof cat_parser_1.CatCapture) {
            if (p.name in matches)
                throw new Error("Match variable repeated twice: " + p.name);
            if (!isValue(x))
                return false; // Can't match non-values 
            matches[p.name] = x;
        }
        else if (p instanceof cat_parser_1.CatQuotation && x instanceof cat_parser_1.CatQuotation) {
            // Recurse into patterns 
            if (!matchPattern(x.terms, p.terms, matches))
                return false;
        }
        else if (p instanceof cat_parser_1.CatConstant && x instanceof cat_parser_1.CatConstant) {
            if (p.value !== x.value)
                return false;
        }
        else if (p instanceof cat_parser_1.CatInstruction && x instanceof cat_parser_1.CatInstruction) {
            if (p.name != x.name)
                return false;
        }
    }
    return true;
}
function applyMatches(x, matches) {
    if (x instanceof cat_parser_1.CatCapture) {
        if (!(x.name in matches))
            throw new Error("Match could not be found");
        return matches[x.name];
    }
    else if (x instanceof cat_parser_1.CatQuotation) {
        return new cat_parser_1.CatQuotation(x.terms.map(function (t) { return applyMatches(t, matches); }));
    }
    else {
        return x;
    }
}
function rewrite(expr, targetPattern, matches, pos, length) {
    var newPattern = targetPattern.map(function (x) { return applyMatches(x, matches); });
    var r = expr.slice();
    r.splice.apply(r, [pos, length].concat(newPattern));
    return r;
}
// If the pattern matches at the specified position, returns a rewritten expression, or the same expression otherwise 
function rewriteIfMatch(expr, pos, rule) {
    var matches = {};
    if (matchPattern(expr, rule.src, matches, pos)) {
        return rewrite(expr, rule.target, matches, pos, rule.src.length);
    }
    return null;
}
// Keeps applying rewrite rules as possible 
function applyRewriteRules(expr) {
    var i = 0;
    while (i < expr.length) {
        for (var _i = 0, catRewriteRules_1 = exports.catRewriteRules; _i < catRewriteRules_1.length; _i++) {
            var r = catRewriteRules_1[_i];
            var tmp = rewriteIfMatch(expr, i, r);
            if (tmp != null) {
                expr = tmp;
                // We back up three places, to look for new patterns that might have emerged 
                i -= 3;
                // Don't back up too much 
                if (i < 0)
                    i = 0;
            }
            else {
                i++;
            }
        }
    }
    return expr;
}
//# sourceMappingURL=cat-rewrite.js.map