// Lambda Cat is a variation of cat that supports parameters and variables
// Conversion Rules from Lambda Cat to Pure Cat 
//
// 0) Alpha rename Lambda Cat to assure that all parameters have a unique name
// 1) every variable \x where there is no occurence of @x in scope, is replaced by pop. 
// 2) every variable \x that has two or more references to x in scope, replace "\x" with "dupN \x1 \x2 ... \xN".
// Rename references to \x in order to @x1 @x2 ... @xN

import { CatExpr, CatQuotation, CatInstruction, CatParam, CatVar, CatCapture, CatConstant } from './cat-parser';
    
export type Usage = {
    name:string;
    depth:number;    
}

export type Declaration = {
    name:string;
    depth:number;    
}

export interface IUsages {
    [name:string] : Usage[];
}

export interface INameLookup {
    [name:string] : string;    
}

export interface NameCount {
    [name:string] : number;    
}

export function getVarUsages(xs:CatExpr[], usages:IUsages={}, depth:number=0) : IUsages {
    xs.forEach(x => getVarUsagesSingle(x, usages, depth));
    return usages;
}


export function getVarUsagesSingle(x:CatExpr, usages:IUsages={}, depth:number=0)  : IUsages {
    if (x instanceof CatParam) {
        if (x.name in usages) 
            throw new Error("Parameter name used more than once");
        usages[x.name] = [];
    }
    else if (x instanceof CatVar) {
        if (!(x.name in usages))
            throw new Error("Variable not associated with parameter")
        usages[x.name].push({name:x.name, depth});
    }
    else if (x instanceof CatQuotation) {
        getVarUsages(x.terms, usages, depth+1);
    }
    return usages;
}

export function areVariablesSingleUse(xs: CatExpr[]): boolean {
    var names: NameCount = {};
    for (var expr of xs) {
        for (var x of leafExprs(expr)) {
            if (x instanceof CatParam) {            
                if (x.name in names)
                    throw new Error("Parameter already used")
                else
                    names[x.name] = 0;                
            }
            else if (x instanceof CatVar) {
                if (x.name in names)
                    names[x.name]++;
                else 
                    throw new Error("Variable not accompanied by a parameter")
            }
        }
    }
    for (var k in names)
        if (names[k] != 1)
            return false;
    return true;    
}

// We assume all variables are already uniquely named. 
// Given a usages analysis, this will run through the variables and assign names to each instance, 
// and increase the number of parameters.  
export function makeVarsSingleUse(expr: CatExpr[], usages:IUsages, renaming:NameCount={}) : CatExpr[] {    
    let r:CatExpr[] = [];
    for (let i=0; i < expr.length; ++i) {
        let t = expr[i];
        if (t instanceof CatParam) {
            if (!(t.name in usages))
                throw new Error("Could not find cat variable " + t.name);
            let n = usages[t.name].length;
            if (n == 0) {
                r.push(new CatInstruction("pop"));
            }
            for (let j=0; j < n; ++j) {
                if (j < n-1) {
                    r.push("dup");
                }
                r.push(new CatParam(t.name + '#' + j));                
            }
            renaming[t.name] = 0;
        }
        else if (t instanceof CatVar) {
            var tmp = t.name + '#' + (renaming[t.name]++).toString();            
            r.push(new CatVar(tmp));
        }
        else if (t instanceof CatQuotation) {
            r.push(new CatQuotation(makeVarsSingleUse(t.terms, usages, renaming)));
        }
        else {
            r.push(t);
        }
    }
    return r;
}

export interface StringLookup {
    [name: string] : string;
}

export interface NameGenerator {
    (name: string) : string;
}

export function makeNameGenerator() {
    var n = 0;
    return (name: string) => name + '$' + n++;
}

export function quotationContainsVar(q: CatQuotation, x: string) {
    for (var i=0; i < q.terms.length; ++i) {
        var t = q.terms[i];
        if (t instanceof CatVar) {
            if (t.name === x)
                return true;
        }
        else if (t instanceof CatQuotation) {
            if (quotationContainsVar(t, x))
                return true;
        }
    }
    return false;
}

export function leafExprs(expr: CatExpr, r: CatExpr[] = []): CatExpr[] {
    if (expr instanceof CatQuotation) {
        expr.terms.forEach(t => leafExprs(t, r));
    }
    else {
        r.push(expr);
    }
    return r;
}

export function areVariablesUniquelyNamed(expr: CatQuotation): boolean {
    var names: { [name:string] : string } = {};
    for (var x of leafExprs(expr)) {
        if (x instanceof CatParam) {
            if (x.name in names)
                return false;
            else
                names[x.name] = x.name;                
        }
    }
    return true;
}

export function areVariablesRemoved(x: CatExpr): boolean {
    if (x instanceof CatVar)
        return false;
    else if (x instanceof CatParam)
        return false;
    else if (x instanceof CatQuotation)
        return x.terms.every(areVariablesRemoved);
    return true;
}

// Uniquely names each variable.
export function uniquelyNameVarsSingle(t:CatExpr, nameGen:NameGenerator = makeNameGenerator(), lookup:StringLookup={}) : CatExpr {
    if (t instanceof CatParam) {
        lookup[t.name] = nameGen(t.name);
        return new CatParam(lookup[t.name]);
    }
    else if (t instanceof CatVar) {
        if (!(t.name in lookup))
            throw new Error("Variable could not be found " + t.name);
        return new CatVar(lookup[t.name]);
    }
    else if (t instanceof CatQuotation) {
        return new CatQuotation(uniquelyNameVars(t.terms, nameGen, {...lookup}));
    }
    else {
        return t;
    }
}

export function uniquelyNameVars(xs: CatExpr[], nameGen: NameGenerator = makeNameGenerator(), lookup:StringLookup={}) : CatExpr[] {
    return xs.map(t => uniquelyNameVarsSingle(t, nameGen, lookup));
}

export function isLambdaExpr(x: CatExpr) {
    return x instanceof CatParam 
        || x instanceof CatVar 
        || (x instanceof CatQuotation && x.terms.some(isLambdaExpr));
}

// First uniquely names variables and assures that all variables are single usage.
// The last \x will be immediately followed by an expression. 
//   1. \x x => id
//   2. \x [T] be a quotation containing x => [\x T] papply
//   3. \x T where T neither is nor contains an occurence of @x => [T] dip \x
export function removeVars(xs: CatExpr[]): CatExpr[] { 
    // If none of the child expressions are a lambda-expression, then we are done
    if (!(xs.some(isLambdaExpr)))
        return xs;

    // Make a copy to be safe
    var r = [...xs];
    
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
    while (i-- > 0) 
    {
        var t = r[i];
        if (t instanceof CatParam) {
            if (i == r.length-1) 
                throw new Error("Parameter should never occur at end");
            
            var next = r[i+1];

            // \a @a => noop
            if (next instanceof CatVar && next.name === t.name) {
                r.splice(i, 2);
            }
            // \a [.. @a ...] => [\a ... @a ...] papply
            // Note: this might not happen if we do lambda-lifting first.
            else if (next instanceof CatQuotation && quotationContainsVar(next, t.name)) {
                r.splice(i, 2, next.prepend(t), new CatInstruction('papply'));
            }
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
            i = r.length;
        } 
    }

    // Recurisvely remove vars 
    for (var i=0; i < r.length; ++i)
    {
        var t = r[i];
        if (t instanceof CatQuotation)
            r[i] = new CatQuotation(removeVars(t.terms));
    }
    
    // Create a new quotation 
    if (r.some(x => !areVariablesRemoved(x)))
        throw new Error("Failed to remove variables");
    
    if (!areVariablesSingleUse(r)) 
        throw new Error("Variables are supposed to be single use");

    return r;
}
