using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Examines how the engine handles cyclic (infinite) types. It deliberately has
    /// NO occurs check during unification; cycles are detected lazily while
    /// reconstructing the result and reported as a <c>(rec N)</c> marker. Such types
    /// are flagged invalid by <see cref="TypeOps.IsValid"/>. A few terms escape even
    /// this net and throw outright.
    /// </summary>
    [TestFixture]
    public class RecursionTests
    {
        [Test]
        public void Self_application_dup_apply_yields_a_rec_marker_not_a_hang()
        {
            var run = Sandbox.Run(() => Cat.InferNormalized("dup apply"));
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.EqualTo("!t1.(!t0.((((rec 1) t0) -> t1) t0) -> t1)"));

            var valid = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("dup apply")));
            Assert.That(valid.Value, Is.False, "a type containing (rec N) must be reported invalid");
        }

        [Test]
        public void No_occurs_check_but_reconstruction_terminates_with_rec()
        {
            // Unify a with (a b): a classic occurs-check violation. There is no occurs
            // check, so unification succeeds; the cycle is only caught when the unified
            // type is reconstructed, producing a (rec ...) rather than looping forever.
            var run = Sandbox.Run(() =>
            {
                var a = TypeOps.TypeVar("a");
                var b = TypeOps.TypeVar("b");
                var pair = TypeOps.TypeArrayOf(a, b);   // (a b)

                var e = new Unifier();
                e.UnifyTypes(a, pair);                  // no occurs check -> succeeds
                var reconstructed = e.GetUnifiedType(a, new List<string>(), new HashSet<string>());
                return TypeOps.NormalizeVarNames(reconstructed).ToString();
            });

            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Does.Contain("rec"),
                "the cyclic unifier must be surfaced as a (rec N) marker, and must terminate");
        }

        [Test]
        public void Several_variance_terms_produce_rec_types()
        {
            // Captured from the author's own run — these are documented, not surprises.
            var cases = new Dictionary<string, string>
            {
                ["[0] dip apply"]           = "!t1.(!t0.(((Num t0) -> t1) t0) -> t1)",         // clean
                ["dup [0] dip apply"]       = "!t1.(!t0.(((Num ((rec 1) t0)) -> t1) t0) -> t1)", // rec
                ["[] dup [0] dip apply"]    = "!t0.(t0 -> (Num ((rec 1) t0)))",                // rec
            };
            foreach (var kv in cases)
            {
                var run = Sandbox.Run(() => Cat.InferNormalized(kv.Key));
                Assert.That(run.IsOk, Is.True, $"{kv.Key}: {run}");
                Assert.That(run.Value, Is.EqualTo(kv.Value), kv.Key);
            }
        }

        [Test]
        public void StoryYeller_issue_term_throws_differently_sized_lists()
        {
            // Issue #1 reported on the original repo. This is the algorithm's partiality
            // showing through: not a sum type, not a rec marker — a hard exception. The
            // sandbox catches it so the runner is unaffected.
            const string term = "[id] dup 0 swap apply swap [id] swap apply apply";
            var run = Sandbox.Run(() => Cat.InferNormalized(term));

            Assert.That(run.IsFaulted, Is.True, $"expected a thrown error, got: {run}");
            Assert.That(run.FailureMessage, Does.Contain("differently sized lists"));
        }

        [Test]
        public void IsValid_flags_rec_types_and_accepts_ordinary_ones()
        {
            var recType = TypeOps.RecursiveType(0);
            Assert.That(TypeOps.IsValid(recType), Is.False);

            var ok = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("dup")));
            Assert.That(ok.Value, Is.True);
        }
    }
}
