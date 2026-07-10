using System;
using System.Collections.Generic;
using System.Linq;

namespace TypeInference
{
    // =========================================================================================
    //  Equi-recursive (μ-type) unification — a DELIBERATE DIVERGENCE from the original algorithm.
    //
    //  THE ORIGINAL.  type-system.ts has no occurs check. During reconstruction (getUnifiedType)
    //  a cycle is detected and emitted as a positional marker `(rec N)`, where N counts
    //  reconstruction steps. That marker was
    //    (a) not self-contained — N is not a tree address, so two `(rec 0)` in one type can denote
    //        different binders;
    //    (b) not stable — the `_replaceVarWithType` bug shifts it (rec 1 vs rec 0);
    //    (c) not consumable — the unifier treats `(rec N)` as a dumb 2-array, so feeding it back
    //        in silently mangles the type or throws.
    //
    //  THE DIVERGENCE.  This module represents recursion with an EXPLICIT binder, μX.T (RMu / RRec),
    //  and unifies such types with the standard COINDUCTIVE fold/unfold algorithm. Recursion
    //  becomes a first-class type the unifier can both PRODUCE (via the occurs check) and CONSUME.
    //
    //  THE ALGORITHM (fold / unfold + a memo set).
    //
    //   * μX.T denotes the solution of X = T — the infinite ("rational") tree you get by unfolding
    //     forever. The defining law is   μX.T ≡ T[X := μX.T]   (one UNFOLD step); FOLD is the
    //     reverse, recognizing an unfolded type as a μ.
    //
    //   * The trees are infinite, so naive structural unification would loop. But they are REGULAR:
    //     a finite μ-expression has only finitely many distinct subtrees. So we keep a memo set of
    //     pairs (A,B) we have already BEGUN to unify. When asked to unify (A,B):
    //         - if (A,B) is in the set  -> succeed immediately: we ASSUME it, because we are
    //           mid-proof of it. This is COINDUCTION — the right principle for infinite/circular
    //           objects (as opposed to induction, which needs a decreasing measure that does not
    //           exist here).
    //         - otherwise add (A,B), unfold any μ on either side, and recurse structurally.
    //     The occurs check is repurposed: unifying `a` with a type T that contains `a` introduces
    //     `a := μa.T` instead of failing, making the cycle explicit and finite.
    //
    //   * DECIDABLE.  Only finitely many distinct pairs can arise (both types are regular), so the
    //     memo set grows finitely often; every step either hits the memo (stop) or enlarges a
    //     bounded set. Hence it terminates.
    //
    //  WORKED EXAMPLE.  μX.(Num->X)  ≡  μY.(Num->(Num->Y))   (both denote Num->Num->…):
    //      goal t1≡t2         : assume it; unfold both -> recurse  t1 ≡ (Num->t2)
    //      goal t1≡(Num->t2)  : assume it; unfold t1   -> recurse  t1 ≡ t2
    //      goal t1≡t2         : already assumed -> succeed.
    //  The memo hit is the "fold" that closes the loop.
    //
    //  REFERENCES.  Amadio & Cardelli, "Subtyping Recursive Types" (POPL'91 / TOPLAS'93);
    //  Brandt & Henglein, "Coinductive Axiomatization of Recursive Type Equality and Subtyping"
    //  (1998). For pure equality this is unification of rational/cyclic terms (Huet;
    //  Colmerauer's Prolog II). Pierce's TAPL ch. 20–21 is an accessible treatment.
    //
    //  SCOPE.  This is the self-contained, tested core. Wiring it into the main engine — producing
    //  correctly-scoped μ during the engine's positional reconstruction, and teaching
    //  computeParameters / normalizeVarNames about μ/rec binders — is a larger follow-on that
    //  this module is designed to drop into.
    // =========================================================================================

    /// <summary>A recursive-type term: constant, variable, application/tuple, μ-binder, or bound
    /// recursion variable. Kept separate from <see cref="Type"/> so it cannot disturb the faithful
    /// port; the positional `(rec N)` the engine emits is not convertible to a μ without first
    /// producing μ during reconstruction (see SCOPE above).</summary>
    public abstract class RType { }

    /// <summary>A type constant, e.g. Num, Bool, -&gt;.</summary>
    public sealed class RCon : RType
    {
        public readonly string Name;
        public RCon(string name) { Name = name; }
        public override string ToString() => Name;
    }

    /// <summary>A unification variable.</summary>
    public sealed class RVar : RType
    {
        public readonly string Name;
        public RVar(string name) { Name = name; }
        public override string ToString() => Name;
    }

    /// <summary>An applied constructor / tuple, e.g. a function <c>(a -&gt; b)</c> or a pair.</summary>
    public sealed class RApp : RType
    {
        public readonly RType[] Parts;
        public RApp(params RType[] parts) { Parts = parts; }
        public override string ToString() => "(" + string.Join(" ", Parts.Select(p => p.ToString())) + ")";
    }

    /// <summary>A recursive binder, μX.Body.</summary>
    public sealed class RMu : RType
    {
        public readonly string Bound;
        public readonly RType Body;
        public RMu(string bound, RType body) { Bound = bound; Body = body; }
        public override string ToString() => "μ" + Bound + "." + Body;
    }

    /// <summary>A reference back to an enclosing μ binder (the X in μX.T).</summary>
    public sealed class RRec : RType
    {
        public readonly string Bound;
        public RRec(string bound) { Bound = bound; }
        public override string ToString() => Bound;
    }

    /// <summary>Terse constructors for building recursive types in tests.</summary>
    public static class R
    {
        public static RCon Con(string n) => new RCon(n);
        public static RVar Var(string n) => new RVar(n);
        public static RApp App(params RType[] p) => new RApp(p);
        public static RApp Fun(RType a, RType b) => new RApp(a, Con("->"), b); // (a -> b)
        public static RMu Mu(string x, RType body) => new RMu(x, body);
        public static RRec Rec(string x) => new RRec(x);
    }

    /// <summary>
    /// Coinductive fold/unfold unification for equi-recursive types. See the file header for the
    /// algorithm, worked example, rationale, and references.
    /// </summary>
    public static class RecursiveUnifier
    {
        /// <summary>Unify two types, returning success and the resulting substitution.</summary>
        public static (bool ok, Dictionary<string, RType> subst) Unify(RType a, RType b)
        {
            var subst = new Dictionary<string, RType>();
            var ok = Go(a, b, subst, new HashSet<string>());
            return (ok, subst);
        }

        /// <summary>True iff the two (possibly recursive) types denote the same infinite tree /
        /// are unifiable. For closed types this is exactly equi-recursive equivalence.</summary>
        public static bool Equivalent(RType a, RType b) =>
            Go(a, b, new Dictionary<string, RType>(), new HashSet<string>());

        /// <summary>One unfold step: μX.T  ->  T[X := μX.T].</summary>
        public static RType Unfold(RMu mu) => Replace(mu.Body, mu.Bound, mu);

        /// <summary>Fully apply a substitution (μ makes every cycle explicit, so this terminates).</summary>
        public static RType Resolve(RType t, Dictionary<string, RType> s)
        {
            using var _ = Guard.Enter();
            t = Prune(t, s);
            return t switch
            {
                RApp a => new RApp(a.Parts.Select(p => Resolve(p, s)).ToArray()),
                RMu m => new RMu(m.Bound, Resolve(m.Body, s)),
                _ => t
            };
        }

        // --- the coinductive core ------------------------------------------------------------

        private static bool Go(RType a, RType b, Dictionary<string, RType> s, HashSet<string> assume)
        {
            using var _ = Guard.Enter();
            a = Prune(a, s);
            b = Prune(b, s);

            // Coinductive hypothesis: this exact comparison is already in progress -> assume it.
            var key = Resolve(a, s) + " ≟ " + Resolve(b, s);
            if (assume.Contains(key)) return true;

            if (a is RVar va) return BindVar(va, b, s);
            if (b is RVar vb) return BindVar(vb, a, s);

            // Unfold a μ on either side, remembering the pair so the loop can close.
            if (a is RMu ma) { assume.Add(key); return Go(Unfold(ma), b, s, assume); }
            if (b is RMu mb) { assume.Add(key); return Go(a, Unfold(mb), s, assume); }

            if (a is RRec rra && b is RRec rrb) return rra.Bound == rrb.Bound;
            if (a is RCon ca && b is RCon cb) return ca.Name == cb.Name;

            if (a is RApp aa && b is RApp bb)
            {
                if (aa.Parts.Length != bb.Parts.Length) return false;
                assume.Add(key); // assume the compound pair, then check components
                for (var i = 0; i < aa.Parts.Length; i++)
                    if (!Go(aa.Parts[i], bb.Parts[i], s, assume)) return false;
                return true;
            }

            return false;
        }

        private static bool BindVar(RVar v, RType t, Dictionary<string, RType> s)
        {
            using var _ = Guard.Enter();
            t = Prune(t, s);
            if (t is RVar tv && tv.Name == v.Name) return true;
            // Occurs check repurposed: a var that occurs in its own binding becomes an explicit μ.
            s[v.Name] = Occurs(v.Name, t, s) ? new RMu(v.Name, Close(t, v.Name)) : t;
            return true;
        }

        // --- helpers -------------------------------------------------------------------------

        private static RType Prune(RType t, Dictionary<string, RType> s)
        {
            var n = 0;
            while (t is RVar v && s.TryGetValue(v.Name, out var bound))
            {
                t = bound;
                if (++n > 100000) throw new Exception("variable-binding cycle");
            }
            return t;
        }

        private static bool Occurs(string name, RType t, Dictionary<string, RType> s)
        {
            using var _ = Guard.Enter();
            t = Prune(t, s);
            return t switch
            {
                RVar v => v.Name == name,
                RApp a => a.Parts.Any(p => Occurs(name, p, s)),
                RMu m => Occurs(name, m.Body, s),
                _ => false
            };
        }

        /// <summary>Replace free RVar(name) with the recursion variable RRec(name) (used when
        /// forming μname. …). Avoids capture under a same-named μ.</summary>
        private static RType Close(RType t, string name)
        {
            using var _ = Guard.Enter();
            return t switch
            {
                RVar v => v.Name == name ? new RRec(name) : v,
                RApp a => new RApp(a.Parts.Select(p => Close(p, name)).ToArray()),
                RMu m => m.Bound == name ? m : new RMu(m.Bound, Close(m.Body, name)),
                _ => t
            };
        }

        /// <summary>Replace the recursion variable RRec(recName) with <paramref name="with"/>.</summary>
        private static RType Replace(RType t, string recName, RType with)
        {
            using var _ = Guard.Enter();
            return t switch
            {
                RRec r => r.Bound == recName ? with : r,
                RApp a => new RApp(a.Parts.Select(p => Replace(p, recName, with)).ToArray()),
                RMu m => m.Bound == recName ? m : new RMu(m.Bound, Replace(m.Body, recName, with)),
                _ => t
            };
        }
    }
}
