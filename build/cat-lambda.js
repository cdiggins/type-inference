"use strict";
// Lambda Cat is a variation of cat that supports parameters and variables
// Conversion Rules from Lambda Cat to Pure Cat 
//
// 0) Alpha rename Lambda Cat to assure that all parameters have a unique name
// 1) every variable \x where there is no occurence of @x in scope, is replaced by pop. 
// 2) every variable \x that has two or more references to x in scope, replace "\x" with "dupN \x1 \x2 ... \xN".
// Rename references to \x in order to @x1 @x2 ... @xN
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var cat_parser_1 = require("./cat-parser");
function getVarUsages(xs, usages, depth) {
    if (usages === void 0) { usages = {}; }
    if (depth === void 0) { depth = 0; }
    xs.forEach(function (x) { return getVarUsagesSingle(x, usages, depth); });
    return usages;
}
exports.getVarUsages = getVarUsages;
function getVarUsagesSingle(x, usages, depth) {
    if (usages === void 0) { usages = {}; }
    if (depth === void 0) { depth = 0; }
    if (x instanceof cat_parser_1.CatParam) {
        if (x.name in usages)
            throw new Error("Parameter name used more than once");
        usages[x.name] = [];
    }
    else if (x instanceof cat_parser_1.CatVar) {
        if (!(x.name in usages))
            throw new Error("Variable not associated with parameter");
        usages[x.name].push({ name: x.name, depth: depth });
    }
    else if (x instanceof cat_parser_1.CatQuotation) {
        getVarUsages(x.terms, usages, depth + 1);
    }
    return usages;
}
exports.getVarUsagesSingle = getVarUsagesSingle;
function areVariablesSingleUse(xs) {
    var names = {};
    for (var _i = 0, xs_1 = xs; _i < xs_1.length; _i++) {
        var expr = xs_1[_i];
        for (var _a = 0, _b = leafExprs(expr); _a < _b.length; _a++) {
            var x = _b[_a];
            if (x instanceof cat_parser_1.CatParam) {
                if (x.name in names)
                    throw new Error("Parameter already used");
                else
                    names[x.name] = 0;
            }
            else if (x instanceof cat_parser_1.CatVar) {
                if (x.name in names)
                    names[x.name]++;
                else
                    throw new Error("Variable not accompanied by a parameter");
            }
        }
    }
    for (var k in names)
        if (names[k] != 1)
            return false;
    return true;
}
exports.areVariablesSingleUse = areVariablesSingleUse;
// We assume all variables are already uniquely named. 
// Given a usages analysis, this will run through the variables and assign names to each instance, 
// and increase the number of parameters.  
function makeVarsSingleUse(expr, usages, renaming) {
    if (renaming === void 0) { renaming = {}; }
    var r = [];
    for (var i = 0; i < expr.length; ++i) {
        var t = expr[i];
        if (t instanceof cat_parser_1.CatParam) {
            if (!(t.name in usages))
                throw new Error("Could not find cat variable " + t.name);
            var n = usages[t.name].length;
            if (n == 0) {
                r.push(new cat_parser_1.CatInstruction("pop"));
            }
            for (var j = 0; j < n; ++j) {
                if (j < n - 1) {
                    r.push("dup");
                }
                r.push(new cat_parser_1.CatParam(t.name + '#' + j));
            }
            renaming[t.name] = 0;
        }
        else if (t instanceof cat_parser_1.CatVar) {
            var tmp = t.name + '#' + (renaming[t.name]++).toString();
            r.push(new cat_parser_1.CatVar(tmp));
        }
        else if (t instanceof cat_parser_1.CatQuotation) {
            r.push(new cat_parser_1.CatQuotation(makeVarsSingleUse(t.terms, usages, renaming)));
        }
        else {
            r.push(t);
        }
    }
    return r;
}
exports.makeVarsSingleUse = makeVarsSingleUse;
function makeNameGenerator() {
    var n = 0;
    return function (name) { return name + '$' + n++; };
}
exports.makeNameGenerator = makeNameGenerator;
function quotationContainsVar(q, x) {
    for (var i = 0; i < q.terms.length; ++i) {
        var t = q.terms[i];
        if (t instanceof cat_parser_1.CatVar) {
            if (t.name === x)
                return true;
        }
        else if (t instanceof cat_parser_1.CatQuotation) {
            if (quotationContainsVar(t, x))
                return true;
        }
    }
    return false;
}
exports.quotationContainsVar = quotationContainsVar;
function leafExprs(expr, r) {
    if (r === void 0) { r = []; }
    if (expr instanceof cat_parser_1.CatQuotation) {
        expr.terms.forEach(function (t) { return leafExprs(t, r); });
    }
    else {
        r.push(expr);
    }
    return r;
}
exports.leafExprs = leafExprs;
function areVariablesUniquelyNamed(expr) {
    var names = {};
    for (var _i = 0, _a = leafExprs(expr); _i < _a.length; _i++) {
        var x = _a[_i];
        if (x instanceof cat_parser_1.CatParam) {
            if (x.name in names)
                return false;
            else
                names[x.name] = x.name;
        }
    }
    return true;
}
exports.areVariablesUniquelyNamed = areVariablesUniquelyNamed;
function areVariablesRemoved(x) {
    if (x instanceof cat_parser_1.CatVar)
        return false;
    else if (x instanceof cat_parser_1.CatParam)
        return false;
    else if (x instanceof cat_parser_1.CatQuotation)
        return x.terms.every(areVariablesRemoved);
    return true;
}
exports.areVariablesRemoved = areVariablesRemoved;
// Uniquely names each variable.
function uniquelyNameVarsSingle(t, nameGen, lookup) {
    if (nameGen === void 0) { nameGen = makeNameGenerator(); }
    if (lookup === void 0) { lookup = {}; }
    if (t instanceof cat_parser_1.CatParam) {
        lookup[t.name] = nameGen(t.name);
        return new cat_parser_1.CatParam(lookup[t.name]);
    }
    else if (t instanceof cat_parser_1.CatVar) {
        if (!(t.name in lookup))
            throw new Error("Variable could not be found " + t.name);
        return new cat_parser_1.CatVar(lookup[t.name]);
    }
    else if (t instanceof cat_parser_1.CatQuotation) {
        return new cat_parser_1.CatQuotation(uniquelyNameVars(t.terms, nameGen, __assign({}, lookup)));
    }
    else {
        return t;
    }
}
exports.uniquelyNameVarsSingle = uniquelyNameVarsSingle;
function uniquelyNameVars(xs, nameGen, lookup) {
    if (nameGen === void 0) { nameGen = makeNameGenerator(); }
    if (lookup === void 0) { lookup = {}; }
    return xs.map(function (t) { return uniquelyNameVarsSingle(t, nameGen, lookup); });
}
exports.uniquelyNameVars = uniquelyNameVars;
function isLambdaExpr(x) {
    return x instanceof cat_parser_1.CatParam
        || x instanceof cat_parser_1.CatVar
        || (x instanceof cat_parser_1.CatQuotation && x.terms.some(isLambdaExpr));
}
exports.isLambdaExpr = isLambdaExpr;
// First uniquely names variables and assures that all variables are single usage.
// The last \x will be immediately followed by an expression. 
//   1. \x x => id
//   2. \x [T] be a quotation containing x => [\x T] papply
//   3. \x T where T neither is nor contains an occurence of @x => [T] dip \x
function removeVars(xs) {
    // If none of the child expressions are a lambda-expression, then we are done
    if (!(xs.some(isLambdaExpr)))
        return xs;
    // Make a copy to be safe
    var r = xs.slice();
    // Uniquely name variables
    r = uniquelyNameVars(r);
    // Compute all of the usages 
    var usages = getVarUsages(r);
    // Make sure each variable is used once 
    r = makeVarsSingleUse(r, usages);
    // Double check it worked
    if (!areVariablesSingleUse(r))
        throw new Error('Variables are not only used once');
    // Find the last \param 
    var i = r.length;
    while (i-- > 0) {
        var t = r[i];
        if (t instanceof cat_parser_1.CatParam) {
            if (i == r.length - 1)
                throw new Error("Parameter should never occur at end");
            var next = r[i + 1];
            // \a @a => noop
            if (next instanceof cat_parser_1.CatVar && next.name === t.name) {
                r.splice(i, 2);
            }
            else if (next instanceof cat_parser_1.CatQuotation && quotationContainsVar(next, t.name)) {
                r.splice(i, 2, next.prepend(t), new cat_parser_1.CatInstruction('papply'));
            }
            else {
                // This keeps the generate algorithms simple
                var before = [next];
                var j = i + 2;
                while (j < r.length) {
                    var tmp = r[j];
                    if (tmp instanceof cat_parser_1.CatVar && tmp.name === t.name)
                        break;
                    if (tmp instanceof cat_parser_1.CatQuotation && quotationContainsVar(tmp, t.name))
                        break;
                    before.push(tmp);
                    j++;
                }
                var after = r.slice(j);
                after.splice(0, 0, t);
                r.splice(i, r.length - i, new cat_parser_1.CatQuotation(before), new cat_parser_1.CatInstruction('swap'), new cat_parser_1.CatQuotation(after), new cat_parser_1.CatInstruction("papply"), new cat_parser_1.CatInstruction("compose"), new cat_parser_1.CatInstruction("apply"));
            }
            /*
            // \a T => [T] dip \a
            else {
                // Figure out exactly how many terms we can put in the dip.
                // This keeps the generate algorithms simple
                var skip = [next];
                var j = i + 2;
                while (j < r.length) {
                    var tmp = r[j];
                    if (tmp instanceof CatVar && tmp.name === t.name)
                        break;
                    if (tmp instanceof CatQuotation && quotationContainsVar(tmp, t.name))
                        break;
                    skip.push(tmp);
                    j++;
                }
                r.splice(i, skip.length + 1, new CatQuotation(skip), new CatInstruction('dip'), t);
            }
            */
            i = r.length;
        }
    }
    // Recurisvely remove vars 
    for (var i = 0; i < r.length; ++i) {
        var t = r[i];
        if (t instanceof cat_parser_1.CatQuotation)
            r[i] = new cat_parser_1.CatQuotation(removeVars(t.terms));
    }
    // Create a new quotation 
    if (r.some(function (x) { return !areVariablesRemoved(x); }))
        throw new Error("Failed to remove variables");
    if (!areVariablesSingleUse(r))
        throw new Error("Variables are supposed to be single use");
    return r;
}
exports.removeVars = removeVars;
//# sourceMappingURL=cat-lambda.js.map