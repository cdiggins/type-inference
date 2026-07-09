using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Literals (numbers, booleans) and how distinct constants coexist on the stack. Note that
    /// different constants sitting on the stack together is fine — a clash only occurs when two
    /// are actually UNIFIED (see SoundnessTests).
    /// </summary>
    [TestFixture]
    public class LiteralTests
    {
        private static string Inf(string term)
        {
            var r = Sandbox.Run(() => Cat.InferNormalized(term));
            Assert.That(r.IsOk, Is.True, $"'{term}': {r}");
            return r.Value;
        }

        [TestCase("0", "!t0.(t0 -> (Num t0))")]
        [TestCase("true", "!t0.(t0 -> (Bool t0))")]
        [TestCase("false", "!t0.(t0 -> (Bool t0))")]
        [TestCase("0 dup", "!t0.(t0 -> (Num (Num t0)))")]
        [TestCase("0 0", "!t0.(t0 -> (Num (Num t0)))")]
        [TestCase("0 0 swap", "!t0.(t0 -> (Num (Num t0)))")]
        [TestCase("true false", "!t0.(t0 -> (Bool (Bool t0)))")]
        [TestCase("0 pop", "!t0.(t0 -> t0)")]
        [TestCase("42", "!t0.(t0 -> (Num t0))")]
        public void Literal_terms_infer_expected_types(string term, string expected) =>
            Assert.That(Inf(term), Is.EqualTo(expected));

        [Test]
        public void Distinct_constants_coexist_on_the_stack_without_clashing()
        {
            // 0 then true then swap: a Num under a Bool, swapped. No unification of Num with Bool.
            var t = Inf("0 true swap");
            Assert.That(t, Does.Contain("Num").And.Contain("Bool"));
            Assert.That(t, Does.Not.Contain("|"));
        }

        [Test]
        public void A_quotation_of_a_literal_pushes_a_function()
        {
            // [0] pushes a quotation that, given any stack, pushes a Num.
            var t = Inf("[0]");
            Assert.That(t, Does.Contain("Num"));
            var run = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("[0]")));
            Assert.That(run.Value, Is.True);
        }

        [Test]
        public void Applying_a_quoted_literal_pushes_the_literal()
        {
            // [0] apply  ==  0
            Assert.That(Inf("[0] apply"), Is.EqualTo(Inf("0")));
        }
    }
}
