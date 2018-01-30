"use strict";
// Conversion Rules from Lambda Calculus to Lambda Cat
//
// x T     => T @x apply
// T x     => @x T apply 
// \x.T    => [\x T]
Object.defineProperty(exports, "__esModule", { value: true });
var lambda_calculus_1 = require("./lambda-calculus");
var cat_parser_1 = require("./cat-parser");
var cat_lambda_1 = require("./cat-lambda");
// Converts a lambda calculus term to an array of Cat expressions.
function lambdaToCat(x) {
    var r = [];
    if (x instanceof lambda_calculus_1.RedexAbstraction) {
        r.push(new cat_parser_1.CatQuotation([
            new cat_parser_1.CatParam(x.param)
        ].concat(lambdaToCat(x.body))));
    }
    else if (x instanceof lambda_calculus_1.RedexApplication) {
        r.push.apply(r, lambdaToCat(x.args));
        r.push.apply(r, lambdaToCat(x.func));
        r.push(new cat_parser_1.CatInstruction('apply'));
    }
    else if (x instanceof lambda_calculus_1.RedexName) {
        r.push(new cat_parser_1.CatVar(x.name));
    }
    else if (x instanceof lambda_calculus_1.RedexValue) {
        r.push(new cat_parser_1.CatConstant(x.value));
    }
    else {
        throw new Error("Unrecognized Redex " + x);
    }
    return r;
}
exports.lambdaToCat = lambdaToCat;
function lambdaToPureCat(x) {
    return cat_lambda_1.removeVars(lambdaToCat(x));
}
exports.lambdaToPureCat = lambdaToPureCat;
//# sourceMappingURL=lambda-calculus-to-cat.js.map