using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// End-to-end tests of the equirecursive integration (Equirecursive.cs): with
    /// `Cat.Equirecursive` on, inference PRODUCES real μ-types at reconstruction and CONSUMES
    /// them in later compositions, replacing the positional `(rec N)` marker. With it off
    /// (the default) behavior is byte-identical to the faithful port.
    /// </summary>
    [TestFixture, NonParallelizable]
    public class EquirecursiveIntegrationTests
    {
        private static (string norm, bool valid, bool recursive) Infer(string term, bool equi)
        {
            var saved = Cat.Equirecursive;
            try
            {
                Cat.Equirecursive = equi;
                Cat.ResetVocabulary();
                var r = Sandbox.Run(() =>
                {
                    var t = Cat.Infer(term);
                    return (TypeOps.NormalizeVarNames(t).ToString(), TypeOps.IsValid(t), Equi.IsRecursive(t));
                });
                Assert.That(r.IsOk, Is.True, $"'{term}' (equi={equi}): {r}");
                return r.Value;
            }
            finally { Cat.Equirecursive = saved; Cat.ResetVocabulary(); }
        }

        [Test]
        public void Off_by_default()
        {
            Assert.That(Cat.Equirecursive, Is.False);
            Assert.That(Unifier.EquirecursiveDefault, Is.False);
        }

        [Test]
        public void Default_mode_still_emits_the_positional_rec_marker()
        {
            var (norm, valid, _) = Infer("dup apply", equi: false);
            Assert.That(norm, Is.EqualTo("!t1.(!t0.((((rec 1) t0) -> t1) t0) -> t1)"));
            Assert.That(valid, Is.False, "the (rec N) form is invalid");
        }

        [Test]
        public void Self_application_becomes_a_valid_mu_type()
        {
            // dup apply = λx.x x. The recursive type is μr0.((r0 t0) -> t1): x is a function that
            // takes (a stack with x on top of t0) and returns t1.
            var (norm, valid, recursive) = Infer("dup apply", equi: true);
            Assert.That(norm, Is.EqualTo("!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)"));
            Assert.That(valid, Is.True, "the μ-type is well-formed (no rec constant, params on input)");
            Assert.That(recursive, Is.True, "it genuinely contains a μ binder");
            Assert.That(norm, Does.Contain("μ").And.Not.Contain("rec "));
        }

        [Test]
        public void quote_dup_apply_becomes_a_valid_recursive_type()
        {
            var (norm, valid, recursive) = Infer("quote dup apply", equi: true);
            Assert.That(norm, Is.EqualTo("!t0!t1.((t0 t1) -> μr0.(t0 (μr1.((r1 t1) -> r0) t1)))"));
            Assert.That(valid, Is.True);
            Assert.That(recursive, Is.True);
        }

        [Test]
        public void Doubly_self_applying_term_is_also_a_valid_mu_type()
        {
            var (_, valid, recursive) = Infer("quote dup apply apply", equi: true);
            Assert.That(valid, Is.True);
            Assert.That(recursive, Is.True);
        }

        [Test]
        public void Mu_consumption_resolves_a_chained_recursive_type()
        {
            // The issue-#1 term feeds a recursive type into a later composition. With (rec N) the
            // engine throws the confusing "differently sized lists" (a rec 2-array vs a function
            // 3-array). In equirecursive mode the μ is UNFOLDED and consumed, so that arity error
            // is gone; the term still fails, but now with the GENUINE clash it always had.
            const string term = "[id] dup 0 swap apply swap [id] swap apply apply";

            var off = RunRaw(term, equi: false);
            Assert.That(off.IsFaulted, Is.True);
            Assert.That(off.FailureMessage, Does.Contain("differently sized lists"));

            var on = RunRaw(term, equi: true);
            Assert.That(on.IsFaulted, Is.True);
            Assert.That(on.FailureMessage, Does.Not.Contain("differently sized lists"),
                "the μ was consumed by unfolding — the arity error is gone");
            Assert.That(on.Error, Is.TypeOf<UnificationError>(),
                "what remains is a genuine type error, correctly reported");
        }

        private static RunResult<string> RunRaw(string term, bool equi)
        {
            var saved = Cat.Equirecursive;
            try
            {
                Cat.Equirecursive = equi;
                Cat.ResetVocabulary();
                return Sandbox.Run(() => Cat.InferNormalized(term));
            }
            finally { Cat.Equirecursive = saved; Cat.ResetVocabulary(); }
        }

        [Test]
        public void Equirecursive_inference_is_deterministic()
        {
            var a = Infer("dup apply", equi: true);
            var b = Infer("dup apply", equi: true);
            Assert.That(a.norm, Is.EqualTo(b.norm));
        }

        [Test]
        public void Non_recursive_terms_are_identical_in_both_modes()
        {
            foreach (var term in new[] { "dup", "swap quote compose apply", "quote dup", "compose dup", "0 dup" })
            {
                var off = Infer(term, equi: false);
                var on = Infer(term, equi: true);
                Assert.That(on.norm, Is.EqualTo(off.norm), $"'{term}' should be unchanged when non-recursive");
                Assert.That(on.recursive, Is.False);
            }
        }
    }
}
