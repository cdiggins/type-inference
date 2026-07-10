using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// How the engine handles cyclic (infinite) types. There is no FAILING occurs check:
    /// a cycle is detected lazily during reconstruction and turned into an explicit
    /// equirecursive μ-type (the old positional <c>(rec N)</c> marker is retired). Such
    /// types are well-formed; a few terms are genuinely ill-typed and throw.
    /// </summary>
    [TestFixture]
    public class RecursionTests
    {
        [Test]
        public void Self_application_dup_apply_infers_a_valid_mu_type_not_a_hang()
        {
            var run = Sandbox.Run(() => Cat.InferNormalized("dup apply"));
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.EqualTo("!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)"));

            var valid = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("dup apply")));
            Assert.That(valid.Value, Is.True, "the μ-type is well-formed");
        }

        [Test]
        public void No_failing_occurs_check_reconstruction_yields_a_mu()
        {
            // Unify a with (a b): a classic occurs-check violation. There is no failing occurs
            // check, so unification succeeds; the cycle is caught during reconstruction and
            // surfaced as μr0.(r0 t0) rather than looping forever.
            var run = Sandbox.Run(() =>
            {
                var a = TypeOps.TypeVar("a");
                var b = TypeOps.TypeVar("b");
                var pair = TypeOps.TypeArrayOf(a, b);   // (a b)

                var e = new Unifier();
                e.UnifyTypes(a, pair);
                var reconstructed = e.GetUnifiedType(a, new List<string>(), new HashSet<string>());
                return TypeOps.NormalizeVarNames(reconstructed).ToString();
            });

            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.EqualTo("μr0.(r0 t0)"));
        }

        [Test]
        public void Variance_terms_infer_recursive_mu_or_clean_types()
        {
            // A term with no self-application types cleanly; the self-applying ones infer μ-types.
            var clean = Sandbox.Run(() => Cat.InferNormalized("[0] dip apply"));
            Assert.That(clean.Value, Is.EqualTo("!t1.(!t0.(((Num t0) -> t1) t0) -> t1)"));

            var rec = Sandbox.Run(() => Cat.InferNormalized("dup [0] dip apply"));
            Assert.That(rec.Value, Is.EqualTo("!t1.(!t0.(μr0.((Num (r0 t0)) -> t1) t0) -> t1)"));

            foreach (var term in new[] { "dup [0] dip apply", "[] dup [0] dip apply" })
            {
                var r = Sandbox.Run(() => (Equi.IsRecursive(Cat.Infer(term)), TypeOps.IsValid(Cat.Infer(term))));
                Assert.That(r.Value.Item1, Is.True, $"{term} is recursive");
                Assert.That(r.Value.Item2, Is.True, $"{term} is a valid μ-type");
            }
        }

        [Test]
        public void StoryYeller_issue_term_is_a_genuine_type_error()
        {
            // Issue #1 on the original repo. With the old (rec N) marker this threw the confusing
            // "differently sized lists" (a rec 2-array vs a function 3-array). Now the μ is
            // unfolded and consumed, exposing the term's GENUINE clash: a Num used as a function.
            const string term = "[id] dup 0 swap apply swap [id] swap apply apply";
            var run = Sandbox.Run(() => Cat.InferNormalized(term));

            Assert.That(run.IsFaulted, Is.True, $"expected a thrown error, got: {run}");
            Assert.That(run.Error, Is.TypeOf<UnificationError>());
            Assert.That(run.FailureMessage, Does.Not.Contain("differently sized lists"));
        }

        [Test]
        public void The_legacy_rec_constant_is_still_rejected_defensively()
        {
            // The engine no longer produces it, but if a (rec N) marker were constructed it is
            // still flagged invalid; ordinary types remain valid.
            Assert.That(TypeOps.IsValid(TypeOps.RecursiveType(0)), Is.False);
            var ok = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("dup")));
            Assert.That(ok.Value, Is.True);
        }
    }
}
