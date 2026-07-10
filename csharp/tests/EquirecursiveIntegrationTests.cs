using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// End-to-end tests of equirecursive inference, which is now the engine's ONLY behavior:
    /// recursion is produced as an explicit μ-type at reconstruction and consumed by fold/unfold
    /// in later compositions. The positional `(rec N)` marker has been retired (see Equirecursive.cs).
    /// </summary>
    [TestFixture]
    public class EquirecursiveIntegrationTests
    {
        private static (string norm, bool valid, bool recursive) Infer(string term)
        {
            var r = Sandbox.Run(() =>
            {
                var t = Cat.Infer(term);
                return (TypeOps.NormalizeVarNames(t).ToString(), TypeOps.IsValid(t), Equi.IsRecursive(t));
            });
            Assert.That(r.IsOk, Is.True, $"'{term}': {r}");
            return r.Value;
        }

        [Test]
        public void Self_application_infers_a_valid_mu_type()
        {
            // dup apply = λx.x x. The recursive type is μr0.((r0 t0) -> t1): x is a function that
            // takes (a stack with x on top of t0) and returns t1.
            var (norm, valid, recursive) = Infer("dup apply");
            Assert.That(norm, Is.EqualTo("!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)"));
            Assert.That(valid, Is.True, "the μ-type is well-formed (no rec constant, params on input)");
            Assert.That(recursive, Is.True);
            Assert.That(norm, Does.Contain("μ").And.Not.Contain("rec "));
        }

        [Test]
        public void quote_dup_apply_infers_a_valid_recursive_type()
        {
            var (norm, valid, recursive) = Infer("quote dup apply");
            Assert.That(norm, Is.EqualTo("!t0!t1.((t0 t1) -> μr0.(t0 (μr1.((r1 t1) -> r0) t1)))"));
            Assert.That(valid, Is.True);
            Assert.That(recursive, Is.True);
        }

        [Test]
        public void Doubly_self_applying_term_is_also_a_valid_mu_type()
        {
            var (_, valid, recursive) = Infer("quote dup apply apply");
            Assert.That(valid, Is.True);
            Assert.That(recursive, Is.True);
        }

        [Test]
        public void Mu_consumption_resolves_a_chained_recursive_type()
        {
            // The issue-#1 term feeds a recursive type into a later composition. With the old
            // (rec N) the engine threw the confusing "differently sized lists" (a rec 2-array vs a
            // function 3-array). Now the μ is UNFOLDED and consumed, so that arity error is gone;
            // the term still fails, but with the GENUINE clash it always had.
            const string term = "[id] dup 0 swap apply swap [id] swap apply apply";
            var r = Sandbox.Run(() => Cat.InferNormalized(term));
            Assert.That(r.IsFaulted, Is.True, $"expected a genuine type error, got {r}");
            Assert.That(r.FailureMessage, Does.Not.Contain("differently sized lists"),
                "the μ was consumed by unfolding — the spurious arity error is gone");
            Assert.That(r.Error, Is.TypeOf<UnificationError>(),
                "what remains is a genuine type error, correctly reported");
        }

        [Test]
        public void Inference_is_deterministic()
        {
            Assert.That(Infer("dup apply").norm, Is.EqualTo(Infer("dup apply").norm));
        }

        [Test]
        public void Non_recursive_terms_are_not_flagged_recursive()
        {
            foreach (var term in new[] { "dup", "swap quote compose apply", "quote dup", "compose dup", "0 dup" })
            {
                var (_, valid, recursive) = Infer(term);
                Assert.That(valid, Is.True, term);
                Assert.That(recursive, Is.False, $"'{term}' is not recursive");
            }
        }

        [Test]
        public void No_inferred_type_contains_the_retired_rec_marker()
        {
            foreach (var term in new[] { "dup apply", "quote dup apply", "quote dup apply apply" })
                Assert.That(Infer(term).norm, Does.Not.Contain("(rec "),
                    $"'{term}' must not use the retired positional (rec N) marker");
        }
    }
}
