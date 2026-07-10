using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Root-cause + fix for `quote dup apply`.
    ///
    /// SEMANTICS. Executed on a value `a`:  quote: a→[a];  dup: [a]→[a][a];  apply: runs the
    /// top [a] → [a] a. The final stack is `[a] a` — a LEFTOVER quotation with `a` on top.
    /// So the correct type is `(a ([a] S))`, i.e.
    ///     !t0!t1.((t0 t1) -> (t0 (!t2.(t2 -> (t0 t2)) t1)))
    /// It is NOT `dup` (`(t0 (t0 t1))`): only one of the two copies is applied, the other
    /// survives as a quotation. So the README's expected answer was itself wrong.
    ///
    /// WHY THE ENGINE PRODUCED (rec 1). `inferCatType` composes with
    /// `composeFunctionChainReverse`, which folds from the RIGHT: it types the suffix
    /// `dup apply` in ISOLATION. But `dup apply` on its own is `λx. x x` — genuine
    /// self-application, which legitimately needs a recursive type. That spurious `(rec 1)`
    /// is then threaded through the outer composition with `quote`.
    ///
    /// FIX. Type in evaluation order — fold from the LEFT (`composeFunctionChain`) — so `apply`
    /// is composed against the CONCRETE quotation that `quote dup` already produced, never
    /// against a bare self-referential variable. Toggle: <see cref="Cat.UseLeftFold"/>.
    /// This fixes the term and regresses nothing on the canonical corpus.
    /// </summary>
    [TestFixture, NonParallelizable]
    public class RootCauseTests
    {
        private const string CorrectQuoteDupApply =
            "!t0!t1.((t0 t1) -> (t0 (!t2.(t2 -> (t0 t2)) t1)))";
        private const string DupType = "!t0!t1.((t0 t1) -> (t0 (t0 t1)))";
        private const string ReadmeExpected = "!t0!t1.((t0 t1) -> (t0 (t0 t1)))"; // == dup, and wrong

        private static string Eval(string term, bool leftFold)
        {
            var saved = Cat.UseLeftFold;
            try
            {
                Cat.UseLeftFold = leftFold;
                Cat.ResetVocabulary();
                var r = Sandbox.Run(() => Cat.InferNormalized(term));
                return r.IsOk ? r.Value : "THROW: " + r.FailureMessage;
            }
            finally { Cat.UseLeftFold = saved; Cat.ResetVocabulary(); }
        }

        [Test]
        public void Right_fold_default_introduces_a_recursive_type()
        {
            // Right-fold types the suffix `dup apply` (= λx.x x) in isolation, which forces
            // recursion; that now surfaces as a μ-type (previously the invalid (rec 1)).
            Assert.That(Eval("quote dup apply", leftFold: false),
                Is.EqualTo("!t0!t1.((t0 t1) -> μr0.(t0 (μr1.((r1 t1) -> r0) t1)))"));
        }

        [Test]
        public void Left_fold_produces_the_semantically_correct_type()
        {
            var t = Eval("quote dup apply", leftFold: true);
            Assert.That(t, Is.EqualTo(CorrectQuoteDupApply));

            // ... and it is a valid, rec-free, rank-2 type.
            var saved = Cat.UseLeftFold;
            try
            {
                Cat.UseLeftFold = true; Cat.ResetVocabulary();
                var valid = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("quote dup apply")));
                Assert.That(valid.Value, Is.True, "the corrected type must be valid (no rec)");
            }
            finally { Cat.UseLeftFold = saved; Cat.ResetVocabulary(); }
        }

        [Test]
        public void The_correct_type_is_not_dup_and_not_the_readme_claim()
        {
            var t = Eval("quote dup apply", leftFold: true);
            Assert.That(t, Is.Not.EqualTo(DupType),
                "quote dup apply leaves a quotation; it is not dup");
            Assert.That(t, Is.Not.EqualTo(ReadmeExpected),
                "the README's (t0 (t0 t1)) expectation was itself incorrect");
            Assert.That(t, Does.Contain("t2 -> (t0 t2)"),
                "the surviving quotation is visible in the correct type");
        }

        [Test]
        public void dup_apply_needs_real_recursion_under_both_folds()
        {
            // The fix does not wrongly "fix" genuine self-application: `dup apply` = λx.x x
            // is legitimately recursive, so it stays a μ-type either way.
            Assert.That(Eval("dup apply", leftFold: false), Does.Contain("μ"));
            Assert.That(Eval("dup apply", leftFold: true), Does.Contain("μ"));
        }

        // The 60 canonical catTests terms — none of them should change under the fix.
        private static readonly string[] Canonical =
        {
            "", "apply", "compose", "quote", "dup", "swap", "pop",
            "[]", "[apply]", "[pop]", "[dup]", "[compose]", "[quote]", "[swap]",
            "[[pop]]", "[pop pop]", "pop []", "[] pop", "[pop []]", "[] []",
            "[] dup", "[] dup dup", "dup pop",
            "apply apply", "apply compose", "apply quote", "apply dup", "apply swap", "apply pop",
            "compose apply", "compose compose", "compose quote", "compose dup", "compose swap", "compose pop",
            "quote apply", "quote compose", "quote quote", "quote dup", "quote swap", "quote pop",
            "dup apply", "dup compose", "dup quote", "dup dup", "dup swap",
            "swap apply", "swap compose", "swap quote", "swap dup", "swap swap", "swap pop",
            "pop apply", "pop compose", "pop quote", "pop dup", "pop swap", "pop pop",
            "swap quote compose apply", "swap quote compose apply pop",
        };

        [Test]
        public void The_fix_regresses_nothing_on_the_canonical_corpus()
        {
            Dictionary<string, string> RunAll(bool leftFold)
            {
                var saved = Cat.UseLeftFold;
                try
                {
                    Cat.UseLeftFold = leftFold; Cat.ResetVocabulary();
                    var run = Sandbox.Run(() => Canonical.ToDictionary(t => t, t =>
                    {
                        try { return Cat.InferNormalized(t); }
                        catch (Exception e) { return "THROW: " + e.Message; }
                    }));
                    Assert.That(run.IsOk, Is.True, run.ToString());
                    return run.Value;
                }
                finally { Cat.UseLeftFold = saved; Cat.ResetVocabulary(); }
            }

            var right = RunAll(false);
            var left = RunAll(true);
            foreach (var t in Canonical)
                Assert.That(left[t], Is.EqualTo(right[t]),
                    $"left-fold changed the canonical term '{t}' — the fix should not");
        }
    }
}
