
import { parseCat, CatExpr, CatQuotation, CatInstruction, CatParam, CatVar, CatCapture, CatConstant } from './cat-parser';

// Rewriting rules 
export const catRewriteRuleDefs = {
    "id" : "",
    "swap swap" : "",
    "dup pop" : "",
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
}

class RewriteRule {
    constructor(
        public readonly src: CatExpr[],
        public readonly target: CatExpr[])
    { }    
}

export const catRewriteRules: RewriteRule[] = 
    Object.keys(catRewriteRuleDefs).map(
        k => new RewriteRule(parseCat(k), parseCat(catRewriteRuleDefs[k]))
    );

interface Matches {
    [name: string] : CatExpr;
}

function isValue(expr: CatExpr) {
    return expr instanceof CatQuotation || expr instanceof CatVar || expr instanceof CatConstant;
}

// Given a Cat expression representing a pattern, returns true if the array of expressions matches 
// from the given position. All captures are added to the matches object. 
function matchPattern(expr:CatExpr[], pattern:CatExpr[], matches: Matches, pos:number=0) : boolean {
    // Check that there are enough terms to match the pattern 
    if (pos + pattern.length > expr.length) 
        return false; 
    for (var i=0; i < pattern.length; ++i) {
        const p = pattern[i];    
        const x = expr[i + pos];
        if (p instanceof CatCapture) {
            if (p.name in matches) 
                throw new Error("Match variable repeated twice: " + p.name);
            if (!isValue(x))
                return false; // Can't match non-values 
            matches[p.name] = x;
        }
        else if (p instanceof CatQuotation && x instanceof CatQuotation) {
            // Recurse into patterns 
            if (!matchPattern(x.terms, p.terms, matches)) 
                return false; 
        } 
        else if (p instanceof CatConstant && x instanceof CatConstant) {
            if (p.value !== x.value)
                return false;
        }
        else if (p instanceof CatInstruction && x instanceof CatInstruction) {
            if (p.name != x.name) 
                return false;
        }
    }  
    return true; 
}

function applyMatches(x: CatExpr, matches: Matches) : CatExpr {
    if (x instanceof CatCapture) {
        if (!(x.name in matches)) 
            throw new Error("Match could not be found");
        return matches[x.name]; 
    }
    else if (x instanceof CatQuotation) {
        return new CatQuotation(x.terms.map(t => applyMatches(t, matches)));
    } 
    else {
        return x;
    }
}

function rewrite(expr: CatExpr[], targetPattern: CatExpr[], matches: Matches, pos: number, length: number): CatExpr[] {
    const newPattern = targetPattern.map(x => applyMatches(x, matches));
    var r = [...expr];
    r.splice(pos, length, ...newPattern);
    return r;
}

// If the pattern matches at the specified position, returns a rewritten expression, or the same expression otherwise 
function rewriteIfMatch(expr:CatExpr[], pos:number, rule: RewriteRule) : CatExpr[] {
    var matches: Matches = {};
    if (matchPattern(expr, rule.src, matches, pos)) {
        return rewrite(expr, rule.target, matches, pos, rule.src.length);  
    }
    return null;
}

// Keeps applying rewrite rules as possible 
function applyRewriteRules(expr:CatExpr[]): CatExpr {
    var i=0; 
    while (i < expr.length) {
        for (var r of catRewriteRules) {
            var tmp = rewriteIfMatch(expr, i, r);
            if (tmp != null) {
                expr = tmp;
                // We back up three places, to look for new patterns that might have emerged 
                i -= 3;
                // Don't back up too much 
                if (i < 0) i = 0;
            }
            else {
                i++;
            }
        }
    }
    return expr;
}