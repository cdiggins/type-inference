// http://www.angelfire.com/tx4/cus/combinator/birds.html
// https://www.amazon.com/exec/obidos/tg/detail/-/0394534913/104-1615637-3868724
// https://en.wikipedia.org/wiki/Iota_and_Jot
// https://web.archive.org/web/20160507165333/http://semarch.linguistics.fas.nyu.edu/barker/Iota
// https://en.wikipedia.org/wiki/Combinatory_logic


import * as lc from './lambda-calculus';
import { parseRedex, Redex, RedexName, RedexAbstraction, RedexApplication, isFreeVariableIn } from './lambda-calculus';

export const combinators = {
    I       : "\\x.(x)", 
    K       : "\\x.\\y.(x)", 
    S       : "\\x.\\y.\\z.(x z (y z))",
    B       : "\\x.\\y.\\z.(x (y z))",
    C       : "\\x.\\y.\\z.(x y z)",
    W       : "\\x.\\y.(x y y)",
    D       : "\\a.\\b.\\c.\\d.(a b (c d))",       
    E       : "\\a.\\b.\\c.\\d.\\e.(a b (c d e))",
    F       : "\\a.\\b.\\c.(c b a)",
    G       : "\\a.\\b.\\c.\\d.(a d (b c))",
    H       : "\\a.\\b.\\c.(a b c b)",
    J       : "\\a.\\b.\\c.\\d.(a b (a d c))",
    L       : "\\a.\\b.(a (b b))",
    M       : "\\x.(x x)",
    M2      : "\\a.\\b.(a b (a b))",
    O       : "\\a.\\b.(b (a b))",
    Q       : "\\a.\\b.\\c.(b (a c))",
    R       : "\\a.\\b.\\c.(b (c a))",
    T       : "\\a.\\b.(b a)",
    V       : "\\a.\\b.\\c.(c a b)",
    Y       : "\\f.(\\x.(f (x x) \\x.(f (x x))))",
    SUCC    : "\\n.\\f.\\x.(f (n f x))",
    PRED    : "\\n.\\f.\\x.(n (\\g.\\h.h (g f)) (\\u.x) (\\t.t))",
    PLUS    : "\\m.\\n.\\f.\\x.(m f (n f x))",
    MUL     : "\\m.\\n.\\f.(m (n f))",
    ZERO    : "\\f.\\x.(x)",
    ONE     : "\\f.\\x.(f x)",
    TWO     : "\\f.\\x.(f (f x))",
    THREE   : "\\f.\\x.(f (f (f x)))",
    TRUE    : "\\x.\\y.(x)",
    FALSE   : "\\x.\\y.(y)",
    PAIR    : "\\x.\\y.\\f.(f x y)",
    FIRST   : "\\p.(p \\x.\\y.(x))",
    SECOND  : "\\p.(p \\x.\\y.(y))",
    NIL     : "\\a.\\x.\\y.(x)",
    NULL    : "\\p.(p (\\a.\\b.\\x.\\y.y))", 
    IOTA    : "\\f.((f \\x.\\y.\\z.(x z (y z))) \\x.\\y.(x))",
};

export const combinatorRedexes = {};
for (var k in combinators)
    combinatorRedexes[k] = parseRedex(combinators[k]);

export const combinatorDefs = {
    B : "S(KS)K",
    C : "S(BBS)(KK)",
    D : "BB",
    E : "B(BBB)",
    F : "ETTET",
    G : "BBC",
    H : "BW(BC)",
    I : "SKK",
    J : "B(BC)(W(BC(B(BBB))))",
    L : "CBM",
    M : "SII",
    O : "SI",
    Q : "CB",
    R : "BBT",
    T : "CI",
    U : "LO",
    V : "BCT",
    W : "C(BMR)",
    Y : "SLL", 
}

export function parseCombinator(s: string) : Redex {
    // Inject white-spaces
    s = s.split('').join(' ');
    return parseRedex(s);
}

export function combinatorToLambdaCalculus(x: Redex) : Redex {
    if (x instanceof RedexName && x.name in combinatorRedexes) 
        return combinatorRedexes[x.name];
    else if (x instanceof RedexAbstraction) 
        return new RedexAbstraction(x.param, combinatorToLambdaCalculus(x.body))
    else if (x instanceof RedexApplication) 
        return new RedexApplication(combinatorToLambdaCalculus(x.args), combinatorToLambdaCalculus(x.func));
    else
        return x;
}

// https://en.wikipedia.org/wiki/Combinatory_logic#Completeness_of_the_S-K_basis
export function abstractionElimination(x: Redex): Redex {
    // T[(E₁ E₂)] => (T[E₁] T[E₂])
    if (x instanceof RedexApplication) 
    {
        return new RedexApplication(abstractionElimination(x.func), abstractionElimination(x.args));
    }
    else if (x instanceof RedexAbstraction) 
    {
        if (isFreeVariableIn(x.param, x.body)) 
        {
            // T[λx.x] => I
            if (x.body instanceof RedexName && x.body.name == x.param) 
            {
                return new RedexName('I');
            }
            //T[λx.λy.E] => T[λx.T[λy.E]] (if x occurs free in E)
            else if (x.body instanceof RedexAbstraction) 
            {
                return abstractionElimination(
                    new RedexAbstraction(
                        x.param, 
                        abstractionElimination(x.body)));
            }
            // T[λx.(E₁ E₂)] => (S T[λx.E₁] T[λx.E₂]) (if x occurs free in E₁ or E₂)
            else if (x.body instanceof RedexApplication) 
            {
                return new RedexApplication(
                    new RedexApplication(
                        new RedexName('S'), 
                        abstractionElimination(new RedexAbstraction(x.param, x.body.func))), 
                    abstractionElimination(new RedexAbstraction(x.param, x.body.args))); 
            }
        } 
        else 
        {
            // T[λx.E] => (K T[E]) (if x does not occur free in E)
            return new RedexApplication(
                new RedexName('K'), abstractionElimination(x.body));
        }
    }
    else {
        // T[x] => x
        return x;
    }
}

// TODO: 