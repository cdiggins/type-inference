using System;
using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Investigates a real bug in the original <c>_replaceVarWithType</c>: it built the
    /// substitution table as the JS object literal <c>{varName: replace}</c>, which uses
    /// the LITERAL key "varName" instead of the value of the <c>varName</c> parameter.
    /// On a TypeArray target this makes the substitution a structural no-op.
    ///
    /// Findings (measured, then locked in here):
    ///   * The bug is INERT for every well-typed term in the canonical corpus — buggy and
    ///     corrected substitution agree on all 66 non-cyclic cases.
    ///   * It is NOT inert on cyclic terms: it shifts the reported recursion DEPTH
    ///     (e.g. `dup apply` reports `(rec 1)` buggy vs `(rec 0)` corrected).
    ///   * "Fixing" it in isolation is unsafe: the correction immediately triggers a
    ///     SECOND latent bug — an unconditional cast to TypeVariable in cloneParameters —
    ///     which throws when a type parameter is genuinely replaced by a structured type.
    ///     The original no-op masks that crash.
    /// </summary>
    [TestFixture, NonParallelizable]
    public class ReplaceBugTests
    {
        private static string Eval(string term, bool useFixed)
        {
            var saved = Unifier.UseFixedReplaceDefault;
            try
            {
                Unifier.UseFixedReplaceDefault = useFixed;
                Cat.ResetVocabulary();
                var r = Sandbox.Run(() => Cat.InferNormalized(term));
                return r.IsOk ? r.Value : "FAULT: " + r.FailureMessage;
            }
            finally
            {
                Unifier.UseFixedReplaceDefault = saved;
                Cat.ResetVocabulary();
            }
        }

        [Test]
        public void Bug_is_inert_for_well_typed_terms()
        {
            foreach (var term in new[] { "dup", "quote dup", "swap quote compose apply", "dup dup", "compose compose" })
                Assert.That(Eval(term, useFixed: false), Is.EqualTo(Eval(term, useFixed: true)),
                    $"buggy and corrected substitution must agree on well-typed term '{term}'");
        }

        [Test]
        public void Bug_shifts_recursion_depth_on_cyclic_terms()
        {
            // dup apply: (rec 1) with the original bug, (rec 0) once corrected.
            Assert.That(Eval("dup apply", useFixed: false),
                Is.EqualTo("!t1.(!t0.((((rec 1) t0) -> t1) t0) -> t1)"));
            Assert.That(Eval("dup apply", useFixed: true),
                Is.EqualTo("!t1.(!t0.((((rec 0) t0) -> t1) t0) -> t1)"));

            Assert.That(Eval("quote dup apply", useFixed: false),
                Is.EqualTo("!t0!t1.((t0 t1) -> (t0 ((rec 1) t1)))"));
            Assert.That(Eval("quote dup apply", useFixed: true),
                Is.EqualTo("!t0!t1.((t0 t1) -> (t0 ((rec 0) t1)))"));
        }

        [Test]
        public void Correcting_the_bug_in_isolation_exposes_a_latent_cast_crash()
        {
            // A direct occurs-check-violating unification: a with (a b).
            Type MakeAndReconstruct()
            {
                var a = TypeOps.TypeVar("a");
                var pair = TypeOps.TypeArrayOf(a, TypeOps.TypeVar("b")); // (a b), params [a, b]
                var e = new Unifier();
                e.UnifyTypes(a, pair);
                return e.GetUnifiedType(a, new List<string>(), new HashSet<string>());
            }

            // Original (buggy) engine: reconstructs cleanly as a rec type.
            var saved = Unifier.UseFixedReplaceDefault;
            try
            {
                Unifier.UseFixedReplaceDefault = false;
                var buggy = Sandbox.Run(() => TypeOps.NormalizeVarNames(MakeAndReconstruct()).ToString());
                Assert.That(buggy.IsOk, Is.True, buggy.ToString());
                Assert.That(buggy.Value, Is.EqualTo("((rec 0) t0)"));

                // Corrected substitution: now genuinely substitutes a structured type into a
                // slot that cloneParameters assumes is a TypeVariable -> InvalidCastException.
                Unifier.UseFixedReplaceDefault = true;
                var fixedRun = Sandbox.Run(() => TypeOps.NormalizeVarNames(MakeAndReconstruct()).ToString());
                Assert.That(fixedRun.IsFaulted, Is.True,
                    "correcting one bug should surface the entangled cast bug");
                Assert.That(fixedRun.Error, Is.TypeOf<InvalidCastException>());
            }
            finally
            {
                Unifier.UseFixedReplaceDefault = saved;
            }
        }
    }
}
