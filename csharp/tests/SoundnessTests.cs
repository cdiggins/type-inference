using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Soundness of unification after the sum-type removal.
    ///
    /// The original engine fused conflicting types into a sum `(| ...)` and never rejected a
    /// program. Per an explicit design decision that has been removed: a constant/constructor
    /// clash is now a real <see cref="UnificationError"/>. These tests pin the new behavior and
    /// confirm it is a pure improvement — every well-typed term is unaffected, only genuinely
    /// ill-typed ones are now rejected.
    /// </summary>
    [TestFixture]
    public class SoundnessTests
    {
        private static RunResult<string> Unify(Type a, Type b) =>
            Sandbox.Run(() =>
            {
                var e = new Unifier();
                return TypeOps.NormalizeVarNames(e.UnifyTypes(a, b)).ToString();
            });

        [Test]
        public void Mismatched_constants_are_rejected()
        {
            var r = Unify(TypeOps.TypeConst("Num"), TypeOps.TypeConst("Bool"));
            Assert.That(r.IsFaulted, Is.True, $"expected rejection, got {r}");
            Assert.That(r.Error, Is.TypeOf<UnificationError>());
            Assert.That(r.FailureMessage, Does.Contain("Num").And.Contain("Bool"));
        }

        [Test]
        public void Equal_constants_still_unify()
        {
            var r = Unify(TypeOps.TypeConst("Num"), TypeOps.TypeConst("Num"));
            Assert.That(r.IsOk, Is.True, r.ToString());
            Assert.That(r.Value, Is.EqualTo("Num"));
        }

        [Test]
        public void Applying_a_non_function_is_rejected()
        {
            // `->` vs `[]` — distinct constructors. Previously fused; now an error.
            var r = Unify(TypeOps.TypeConst("->"), TypeOps.TypeConst("[]"));
            Assert.That(r.IsFaulted, Is.True, r.ToString());
            Assert.That(r.Error, Is.TypeOf<UnificationError>());
        }

        [Test]
        public void Constant_versus_structured_type_is_rejected()
        {
            var arr = TypeOps.TypeArrayOf(TypeOps.TypeVar("a"), TypeOps.TypeVar("b"));
            var r = Unify(TypeOps.TypeConst("Num"), arr);
            Assert.That(r.IsFaulted, Is.True, r.ToString());
            Assert.That(r.Error, Is.TypeOf<UnificationError>());
        }

        [Test]
        public void A_genuine_type_error_is_reported_through_the_public_compose_operator()
        {
            // dup feeding a Num+Bool consumer: the value would have to be both Num and Bool.
            // Previously the engine fabricated `(| (Num Bool))`; now it is rejected.
            var run = Sandbox.Run(() =>
            {
                var x = TypeOps.TypeVar("x");
                var s = TypeOps.TypeVar("s");
                var dup = TypeOps.FunctionType(                    //  (x s) -> (x (x s))
                    TypeOps.TypeArrayOf(x, s),
                    TypeOps.TypeArrayOf(x, TypeOps.TypeArrayOf(x, s)));
                dup.ComputeParameters();

                var s2 = TypeOps.TypeVar("s2");
                var consumer = TypeOps.FunctionType(              //  (Num (Bool s2)) -> s2
                    TypeOps.TypeArrayOf(TypeOps.TypeConst("Num"),
                        TypeOps.TypeArrayOf(TypeOps.TypeConst("Bool"), s2)),
                    s2);
                consumer.ComputeParameters();

                return TypeOps.ComposeFunctions(dup, consumer).ToString();
            });

            Assert.That(run.IsFaulted, Is.True, $"expected a type error, got {run}");
            Assert.That(run.Error, Is.TypeOf<UnificationError>());
        }

        [Test]
        public void No_type_ever_contains_a_sum_marker_now()
        {
            string[] terms =
            {
                "dup", "swap", "quote apply", "0 dup", "true dup",
                "0 0 swap", "true 0 swap pop", "dup dup pop pop", "swap quote compose apply",
            };
            foreach (var term in terms)
            {
                var run = Sandbox.Run(() => Cat.InferNormalized(term));
                Assert.That(run.IsOk, Is.True, $"{term}: {run}");
                Assert.That(run.Value, Does.Not.Contain("|"), $"{term} produced a sum type");
            }
        }

        [Test]
        public void Removing_sums_did_not_regress_any_well_typed_term()
        {
            // The proof that removal is safe is that the entire FidelityTests corpus still
            // passes. Here we spot-check that clash-free inference is unchanged and clean.
            var run = Sandbox.Run(() => Cat.InferNormalized("compose dup"));
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.EqualTo(
                "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) ((t2 -> t1) t3)))"));
        }

        [Test]
        public void Rejecting_clashes_is_orthogonal_to_recursion()
        {
            // Orthogonality: `dup apply` is genuine self-application; removing sums (a clash fix)
            // is independent of how recursion is handled. It infers a μ-type either way.
            var run = Sandbox.Run(() => Cat.InferNormalized("dup apply"));
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Does.Contain("μ"));
        }
    }
}
