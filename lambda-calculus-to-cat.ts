// Conversion Rules from Lambda Calculus to Lambda Cat
//
// x T     => T @x apply
// T x     => @x T apply 
// \x.T    => [\x T]

import { Redex, RedexAbstraction, RedexApplication, RedexName, RedexValue } from "./lambda-calculus";
import { CatExpr, CatParam, CatQuotation, CatInstruction, CatVar, CatConstant } from "./cat-parser";
import { removeVars } from "./cat-lambda";

// Converts a lambda calculus term to an array of Cat expressions.
export function lambdaToCat(x: Redex): CatExpr[] {
    var r: CatExpr[] = [];
    if (x instanceof RedexAbstraction) {
        r.push(new CatQuotation([
            new CatParam(x.param), 
            ...lambdaToCat(x.body)]));
    }
    else if (x instanceof RedexApplication) {
        r.push(...lambdaToCat(x.args));
        r.push(...lambdaToCat(x.func));
        r.push(new CatInstruction('apply'));
    }
    else if (x instanceof RedexName) {
        r.push(new CatVar(x.name));
    }
    else if (x instanceof RedexValue) {
        r.push(new CatConstant(x.value));
    }
    else {
        throw new Error("Unrecognized Redex " + x);
    }
    return r;
}

export function lambdaToPureCat(x: Redex): CatExpr[] {
    return removeVars(lambdaToCat(x));
}