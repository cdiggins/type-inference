using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Evaluates the project's headline claim: that it infers higher-rank (rank-N)
    /// polymorphic types which prenex Hindley-Milner cannot represent, using the
    /// term `quote dup` from the README as the witness.
    ///
    /// Verdict from these experiments:
    ///   * TRUE and genuinely interesting: `quote dup` yields TWO independent nested
    ///     forall quantifiers — a rank-2 type. Standard HM would force the two stacked
    ///     quotations to share one variable (the README's Haskell session confirms this
    ///     collapses with an occurs-check error). This system keeps them independent.
    ///   * BUT the README's very next claim is STALE: it states
    ///        quote dup apply : !t0!t1.((t0 t1) -> (t0 (t0 t1)))   [ == dup ]
    ///     The engine as shipped actually produces a RECURSIVE / invalid type
    ///        quote dup apply : !t0!t1.((t0 t1) -> (t0 ((rec 1) t1)))
    ///     so the pedagogical follow-through does not hold for the current code.
    /// </summary>
    [TestFixture]
    public class HigherRankClaimTests
    {
        // Collect every polytype (quantifier-bearing) TypeArray inside a type.
        private static List<TypeArray> PolyTypesIn(Type t) =>
            TypeOps.DescendantTypes(t).OfType<TypeArray>().Where(a => a.IsPolyType).ToList();

        [Test]
        public void QuoteDup_output_has_two_independent_rank2_quantifiers()
        {
            var run = Sandbox.Run(() => Cat.Infer("quote dup"));
            Assert.That(run.IsOk, Is.True, run.ToString());
            var t = run.Value;

            // The output stack holds the two stacked quotations produced by dup-ing a quote.
            var output = TypeOps.FunctionOutput(t);
            var polys = PolyTypesIn(output);

            Assert.That(polys.Count, Is.EqualTo(2),
                "expected exactly two independently-quantified quotations on the output stack");

            // Each is a single-parameter function type ...
            Assert.That(polys.All(p => p.TypeParameterNames.Count == 1), Is.True);
            Assert.That(polys.All(p => TypeOps.IsFunctionType(p)), Is.True);

            // ... their bound variables are DISTINCT (independent quantifiers) ...
            var p0Param = polys[0].TypeParameterNames.Single();
            var p1Param = polys[1].TypeParameterNames.Single();
            Assert.That(p0Param, Is.Not.EqualTo(p1Param),
                "the two quotations must bind different variables to be rank-2 independent");

            // ... yet the two quotations are the SAME shape (two independent copies).
            Assert.That(TypeOps.AreTypesSame(polys[0], polys[1]), Is.True,
                "the two independent quotations should be alpha-equivalent copies");

            // And the printed type shows a quantifier nested to the right of the top arrow,
            // which is the syntactic signature of a rank-2 type (impossible in prenex form).
            var s = TypeOps.NormalizeVarNames(t).ToString();
            Assert.That(s, Is.EqualTo(
                "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))"));
        }

        [Test]
        public void QuoteDup_is_a_valid_type()
        {
            // Unlike the follow-on `quote dup apply`, the rank-2 type itself is well-formed.
            var run = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("quote dup")));
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.True, "quote dup should be a valid (rec-free, well-scoped) type");
        }

        [Test]
        public void README_claim_for_quote_dup_apply_is_stale_actual_is_recursive()
        {
            // README asserts this equals dup: !t0!t1.((t0 t1) -> (t0 (t0 t1)))
            const string readmeClaim = "!t0!t1.((t0 t1) -> (t0 (t0 t1)))";

            var run = Sandbox.Run(() => Cat.InferNormalized("quote dup apply"));
            Assert.That(run.IsOk, Is.True, run.ToString());

            // Actual current behavior: a (rec 1) creeps in — an invalid, recursive type.
            Assert.That(run.Value, Is.EqualTo("!t0!t1.((t0 t1) -> (t0 ((rec 1) t1)))"));
            Assert.That(run.Value, Is.Not.EqualTo(readmeClaim),
                "the README's headline follow-through does not match the shipped engine");

            var valid = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("quote dup apply")));
            Assert.That(valid.Value, Is.False, "the actual result contains (rec 1) and is invalid");
        }

        [Test]
        public void HM_would_link_the_two_quotations_this_system_does_not()
        {
            // Structural demonstration of the difference from prenex HM.
            //
            // In HM, `dup :: (a,s) -> (a,(a,s))` copies ONE monotype `a`; after `quote`
            // pushes a quotation, dup's two outputs share the SAME instantiated variable.
            // That is rank-1: a single top-level binder shared by both copies. The README's
            // GHCi session shows the analogous `dup . quote` producing a shared `b2`, which
            // then fails the occurs check when applied.
            //
            // Here we assert the *positive* property that distinguishes this system: the two
            // copies do NOT share a bound variable. If they shared one, there would be a
            // single common parameter appearing in both quotations; instead each has its own.
            var run = Sandbox.Run(() => Cat.Infer("quote dup"));
            var output = TypeOps.FunctionOutput(run.Value);
            var polys = PolyTypesIn(output);

            var allParams = polys.SelectMany(p => p.TypeParameterNames).ToList();
            Assert.That(allParams.Distinct().Count(), Is.EqualTo(allParams.Count),
                "no bound variable is shared between the two quotations (they are independent)");
        }
    }
}
