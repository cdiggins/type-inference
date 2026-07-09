using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Positive correctness evidence: the algorithm should respect known program
    /// equivalences (semantic identities) and be deterministic. These are the kinds of
    /// checks that build confidence the inferred types actually mean something.
    /// </summary>
    [TestFixture]
    public class PropertyTests
    {
        // Terms that are operationally the identity on the stack should infer a type whose
        // output is structurally identical to its input.
        [TestCase("dup pop")]
        [TestCase("swap swap")]
        [TestCase("quote apply")]
        [TestCase("[] apply")]
        [TestCase("0 pop")]
        public void Identity_terms_infer_an_identity_shaped_type(string term)
        {
            var run = Sandbox.Run(() => Cat.Infer(term));
            Assert.That(run.IsOk, Is.True, run.ToString());

            var input = TypeOps.FunctionInput(run.Value);
            var output = TypeOps.FunctionOutput(run.Value);
            Assert.That(TypeOps.AreTypesSame(input, output), Is.True,
                $"'{term}' should be an identity: input {input} vs output {output}");
        }

        [Test]
        public void Inference_is_deterministic_across_repeated_calls()
        {
            var a = Sandbox.Run(() => Cat.InferNormalized("quote dup"));
            var b = Sandbox.Run(() => Cat.InferNormalized("quote dup"));
            Assert.That(a.Value, Is.EqualTo(b.Value));
        }

        [Test]
        public void Inference_is_deterministic_across_threads()
        {
            // The global fresh-name counter is shared mutable state; normalization must make
            // results reproducible regardless of interleaving. Run several in parallel.
            var results = new System.Collections.Concurrent.ConcurrentBag<string>();
            System.Threading.Tasks.Parallel.For(0, 16, _ =>
            {
                var r = Sandbox.Run(() => Cat.InferNormalized("compose dup"));
                if (r.IsOk) results.Add(r.Value);
            });

            Assert.That(results, Has.Count.EqualTo(16));
            Assert.That(results, Is.All.EqualTo("!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) ((t2 -> t1) t3)))"));
        }

        [Test]
        public void Alphabetized_and_normalized_names_agree_on_structure()
        {
            var run = Sandbox.Run(() =>
            {
                var t = Cat.Infer("swap");
                return (TypeOps.NormalizeVarNames(t).ToString(), TypeOps.AlphabetizeVarNames(t).ToString());
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            var (norm, alpha) = run.Value;
            // Same skeleton, different variable alphabets: t0/t1/t2  vs  a/b/c.
            Assert.That(norm.Replace("t0", "a").Replace("t1", "b").Replace("t2", "c"), Is.EqualTo(alpha));
        }
    }
}
