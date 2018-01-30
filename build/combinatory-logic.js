"use strict";
// http://www.angelfire.com/tx4/cus/combinator/birds.html
// https://www.amazon.com/exec/obidos/tg/detail/-/0394534913/104-1615637-3868724
// https://en.wikipedia.org/wiki/Iota_and_Jot
// https://web.archive.org/web/20160507165333/http://semarch.linguistics.fas.nyu.edu/barker/Iota
// https://en.wikipedia.org/wiki/Combinatory_logic
Object.defineProperty(exports, "__esModule", { value: true });
var lambda_calculus_1 = require("./lambda-calculus");
exports.combinators = {
    I: "\\x.(x)",
    K: "\\x.\\y.(x)",
    S: "\\x.\\y.\\z.(x z (y z))",
    B: "\\x.\\y.\\z.(x (y z))",
    C: "\\x.\\y.\\z.(x y z)",
    W: "\\x.\\y.(x y y)",
    D: "\\a.\\b.\\c.\\d.(a b (c d))",
    E: "\\a.\\b.\\c.\\d.\\e.(a b (c d e))",
    F: "\\a.\\b.\\c.(c b a)",
    G: "\\a.\\b.\\c.\\d.(a d (b c))",
    H: "\\a.\\b.\\c.(a b c b)",
    J: "\\a.\\b.\\c.\\d.(a b (a d c))",
    L: "\\a.\\b.(a (b b))",
    M: "\\x.(x x)",
    M2: "\\a.\\b.(a b (a b))",
    O: "\\a.\\b.(b (a b))",
    Q: "\\a.\\b.\\c.(b (a c))",
    R: "\\a.\\b.\\c.(b (c a))",
    T: "\\a.\\b.(b a)",
    V: "\\a.\\b.\\c.(c a b)",
    Y: "\\f.(\\x.(f (x x) \\x.(f (x x))))",
    SUCC: "\\n.\\f.\\x.(f (n f x))",
    PRED: "\\n.\\f.\\x.(n (\\g.\\h.h (g f)) (\\u.x) (\\t.t))",
    PLUS: "\\m.\\n.\\f.\\x.(m f (n f x))",
    MUL: "\\m.\\n.\\f.(m (n f))",
    ZERO: "\\f.\\x.(x)",
    ONE: "\\f.\\x.(f x)",
    TWO: "\\f.\\x.(f (f x))",
    THREE: "\\f.\\x.(f (f (f x)))",
    TRUE: "\\x.\\y.(x)",
    FALSE: "\\x.\\y.(y)",
    PAIR: "\\x.\\y.\\f.(f x y)",
    FIRST: "\\p.(p \\x.\\y.(x))",
    SECOND: "\\p.(p \\x.\\y.(y))",
    NIL: "\\a.\\x.\\y.(x)",
    NULL: "\\p.(p (\\a.\\b.\\x.\\y.y))",
    IOTA: "\\f.((f \\x.\\y.\\z.(x z (y z))) \\x.\\y.(x))",
};
exports.combinatorRedexes = {};
for (var k in exports.combinators)
    exports.combinatorRedexes[k] = lambda_calculus_1.parseRedex(exports.combinators[k]);
exports.combinatorDefs = {
    B: "S(KS)K",
    C: "S(BBS)(KK)",
    D: "BB",
    E: "B(BBB)",
    F: "ETTET",
    G: "BBC",
    H: "BW(BC)",
    I: "SKK",
    J: "B(BC)(W(BC(B(BBB))))",
    L: "CBM",
    M: "SII",
    O: "SI",
    Q: "CB",
    R: "BBT",
    T: "CI",
    U: "LO",
    V: "BCT",
    W: "C(BMR)",
    Y: "SLL",
};
function parseCombinator(s) {
    // Inject white-spaces
    s = s.split('').join(' ');
    return lambda_calculus_1.parseRedex(s);
}
exports.parseCombinator = parseCombinator;
function combinatorToLambdaCalculus(x) {
    if (x instanceof lambda_calculus_1.RedexName && x.name in exports.combinatorRedexes)
        return exports.combinatorRedexes[x.name];
    else if (x instanceof lambda_calculus_1.RedexAbstraction)
        return new lambda_calculus_1.RedexAbstraction(x.param, combinatorToLambdaCalculus(x.body));
    else if (x instanceof lambda_calculus_1.RedexApplication)
        return new lambda_calculus_1.RedexApplication(combinatorToLambdaCalculus(x.args), combinatorToLambdaCalculus(x.func));
    else
        return x;
}
exports.combinatorToLambdaCalculus = combinatorToLambdaCalculus;
// https://en.wikipedia.org/wiki/Combinatory_logic#Completeness_of_the_S-K_basis
function abstractionElimination(x) {
    // T[(E₁ E₂)] => (T[E₁] T[E₂])
    if (x instanceof lambda_calculus_1.RedexApplication) {
        return new lambda_calculus_1.RedexApplication(abstractionElimination(x.func), abstractionElimination(x.args));
    }
    else if (x instanceof lambda_calculus_1.RedexAbstraction) {
        if (lambda_calculus_1.isFreeVariableIn(x.param, x.body)) {
            // T[λx.x] => I
            if (x.body instanceof lambda_calculus_1.RedexName && x.body.name == x.param) {
                return new lambda_calculus_1.RedexName('I');
            }
            else if (x.body instanceof lambda_calculus_1.RedexAbstraction) {
                return abstractionElimination(new lambda_calculus_1.RedexAbstraction(x.param, abstractionElimination(x.body)));
            }
            else if (x.body instanceof lambda_calculus_1.RedexApplication) {
                return new lambda_calculus_1.RedexApplication(new lambda_calculus_1.RedexApplication(new lambda_calculus_1.RedexName('S'), abstractionElimination(new lambda_calculus_1.RedexAbstraction(x.param, x.body.func))), abstractionElimination(new lambda_calculus_1.RedexAbstraction(x.param, x.body.args)));
            }
        }
        else {
            // T[λx.E] => (K T[E]) (if x does not occur free in E)
            return new lambda_calculus_1.RedexApplication(new lambda_calculus_1.RedexName('K'), abstractionElimination(x.body));
        }
    }
    else {
        // T[x] => x
        return x;
    }
}
exports.abstractionElimination = abstractionElimination;
// TODO:  
//# sourceMappingURL=combinatory-logic.js.map