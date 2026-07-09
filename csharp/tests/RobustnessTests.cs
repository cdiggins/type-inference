using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Invariants that must hold for the machinery to be trustworthy: normalization is stable,
    /// cloning and fresh-naming preserve structure, and the shared global counter never leaks
    /// into results.
    /// </summary>
    [TestFixture]
    public class RobustnessTests
    {
        private static readonly string[] Sample =
        {
            "apply", "compose", "quote", "dup", "swap", "pop",
            "quote dup", "swap quote compose apply", "[dup]", "dup dup",
        };

        [TestCaseSource(nameof(Sample))]
        public void NormalizeVarNames_is_idempotent(string term)
        {
            var run = Sandbox.Run(() =>
            {
                var t = Cat.Infer(term);
                var once = TypeOps.NormalizeVarNames(t);
                var twice = TypeOps.NormalizeVarNames(once);
                return (once.ToString(), twice.ToString());
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value.Item2, Is.EqualTo(run.Value.Item1));
        }

        [TestCaseSource(nameof(Sample))]
        public void FreshVariableNames_preserves_structure(string term)
        {
            var run = Sandbox.Run(() =>
            {
                var t = Cat.Infer(term);
                var fresh = TypeOps.FreshVariableNames(t, 0);
                return TypeOps.AreTypesSame(t, fresh);
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.True, $"'{term}' changed shape under fresh variable names");
        }

        [TestCaseSource(nameof(Sample))]
        public void FreshParameterNames_preserves_structure(string term)
        {
            var run = Sandbox.Run(() =>
            {
                var t = Cat.Infer(term);
                var fresh = TypeOps.FreshParameterNames(t);
                return TypeOps.AreTypesSame(t, fresh);
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.True, $"'{term}' changed shape under fresh parameter names");
        }

        [Test]
        public void The_global_counter_does_not_leak_between_inferences()
        {
            // Inferring many other terms in between must not change a term's normalized type.
            var first = Sandbox.Run(() => Cat.InferNormalized("compose dup"));
            for (var i = 0; i < 20; i++) Sandbox.Run(() => Cat.InferNormalized("quote dup apply"));
            var later = Sandbox.Run(() => Cat.InferNormalized("compose dup"));
            Assert.That(later.Value, Is.EqualTo(first.Value));
        }

        [Test]
        public void Inference_is_deterministic_across_parallel_threads()
        {
            var results = new System.Collections.Concurrent.ConcurrentBag<string>();
            System.Threading.Tasks.Parallel.For(0, 24, _ =>
            {
                var r = Sandbox.Run(() => Cat.InferNormalized("swap quote compose apply"));
                if (r.IsOk) results.Add(r.Value);
            });
            Assert.That(results, Has.Count.EqualTo(24));
            Assert.That(results.Distinct().Count(), Is.EqualTo(1), "all threads must agree");
        }

        [Test]
        public void DescendantTypes_visits_every_node_in_preorder()
        {
            // (a (Num b)) : root, a, (Num b), Num, b  => 5 nodes.
            var t = TypeOps.TypeArrayOf(TypeOps.TypeVar("a"),
                TypeOps.TypeArrayOf(TypeOps.TypeConst("Num"), TypeOps.TypeVar("b")));
            var nodes = TypeOps.DescendantTypes(t);
            Assert.That(nodes.Count, Is.EqualTo(5));
            Assert.That(nodes[0], Is.SameAs(t), "pre-order: root first");
        }

        [Test]
        public void AlphabetizeVarNames_matches_NormalizeVarNames_structurally()
        {
            var run = Sandbox.Run(() =>
            {
                var t = Cat.Infer("compose");
                var norm = TypeOps.NormalizeVarNames(t).ToString();
                var alpha = TypeOps.AlphabetizeVarNames(t).ToString();
                return (norm, alpha);
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            var (norm, alpha) = run.Value;
            // t0..t3  ->  a..d
            var mapped = norm.Replace("t0", "a").Replace("t1", "b").Replace("t2", "c").Replace("t3", "d");
            Assert.That(mapped, Is.EqualTo(alpha));
        }
    }
}
