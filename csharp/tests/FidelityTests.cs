using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Proves the C# port reproduces the ORIGINAL TypeScript engine bit-for-bit.
    /// Every expected string here was captured from running the author's own
    /// build/test.js (node) — see the repo's test.ts `catTests` array and the
    /// std-op printout. If these pass, the port is faithful and every other
    /// experiment in this project is measuring the real algorithm.
    /// </summary>
    [TestFixture]
    public class FidelityTests
    {
        private static TestCaseData C(string term, string expected) =>
            new TestCaseData(term, expected).SetName("{m}(\"" + term.Replace("\"", "") + "\")");

        // ---- the author's canonical catTests (test.ts lines 99-175) -------------
        private static IEnumerable<TestCaseData> CoreCases()
        {
            yield return C("", "!t0.(t0 -> t0)");
            yield return C("apply", "!t1.(!t0.((t0 -> t1) t0) -> t1)");
            yield return C("compose", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) t3))");
            yield return C("quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) t1))");
            yield return C("dup", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))");
            yield return C("swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t0 t2)))");
            yield return C("pop", "!t1.(!t0.(t0 t1) -> t1)");

            yield return C("[]", "!t0.(t0 -> (!t1.(t1 -> t1) t0))");
            yield return C("[apply]", "!t0.(t0 -> (!t2.(!t1.((t1 -> t2) t1) -> t2) t0))");
            yield return C("[pop]", "!t0.(t0 -> (!t2.(!t1.(t1 t2) -> t2) t0))");
            yield return C("[dup]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (t1 (t1 t2))) t0))");
            yield return C("[compose]", "!t0.(t0 -> (!t2!t3!t4.(!t1.((t1 -> t2) ((t3 -> t1) t4)) -> ((t3 -> t2) t4)) t0))");
            yield return C("[quote]", "!t0.(t0 -> (!t1!t2.((t1 t2) -> (!t3.(t3 -> (t1 t3)) t2)) t0))");
            yield return C("[swap]", "!t0.(t0 -> (!t1!t2!t3.((t1 (t2 t3)) -> (t2 (t1 t3))) t0))");

            yield return C("[[pop]]", "!t0.(t0 -> (!t1.(t1 -> (!t3.(!t2.(t2 t3) -> t3) t1)) t0))");
            yield return C("[pop pop]", "!t0.(t0 -> (!t3.(!t1.(t1 !t2.(t2 t3)) -> t3) t0))");
            yield return C("pop []", "!t1.(!t0.(t0 t1) -> (!t2.(t2 -> t2) t1))");
            yield return C("[] pop", "!t0.(t0 -> t0)");
            yield return C("[pop []]", "!t0.(t0 -> (!t2.(!t1.(t1 t2) -> (!t3.(t3 -> t3) t2)) t0))");
            yield return C("[] []", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) t0)))");
            yield return C("[] dup", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) t0)))");
            yield return C("[] dup dup", "!t0.(t0 -> (!t1.(t1 -> t1) (!t2.(t2 -> t2) (!t3.(t3 -> t3) t0))))");
            yield return C("dup pop", "!t0!t1.((t0 t1) -> (t0 t1))");

            yield return C("apply apply", "!t2.(!t0.((t0 -> !t1.((t1 -> t2) t1)) t0) -> t2)");
            yield return C("apply compose", "!t2!t3!t4.(!t0.((t0 -> !t1.((t1 -> t2) ((t3 -> t1) t4))) t0) -> ((t3 -> t2) t4))");
            yield return C("apply quote", "!t1!t2.(!t0.((t0 -> (t1 t2)) t0) -> (!t3.(t3 -> (t1 t3)) t2))");
            yield return C("apply dup", "!t1!t2.(!t0.((t0 -> (t1 t2)) t0) -> (t1 (t1 t2)))");
            yield return C("apply swap", "!t1!t2!t3.(!t0.((t0 -> (t1 (t2 t3))) t0) -> (t2 (t1 t3)))");
            yield return C("apply pop", "!t2.(!t0.((t0 -> !t1.(t1 t2)) t0) -> t2)");
            yield return C("compose apply", "!t1.(!t0.((t0 -> t1) !t2.((t2 -> t0) t2)) -> t1)");
            yield return C("compose compose", "!t1!t3!t4.(!t0.((t0 -> t1) !t2.((t2 -> t0) ((t3 -> t2) t4))) -> ((t3 -> t1) t4))");
            yield return C("compose quote", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> (!t4.(t4 -> ((t2 -> t1) t4)) t3))");
            yield return C("compose dup", "!t1!t2!t3.(!t0.((t0 -> t1) ((t2 -> t0) t3)) -> ((t2 -> t1) ((t2 -> t1) t3)))");
            yield return C("compose swap", "!t1!t2!t3!t4.(!t0.((t0 -> t1) ((t2 -> t0) (t3 t4))) -> (t3 ((t2 -> t1) t4)))");
            yield return C("compose pop", "!t3.(!t0.(!t1.(t0 -> t1) (!t2.(t2 -> t0) t3)) -> t3)");
            yield return C("quote apply", "!t0!t1.((t0 t1) -> (t0 t1))");
            yield return C("quote compose", "!t0!t1!t2!t3.((t0 ((t1 -> t2) t3)) -> ((t1 -> (t0 t2)) t3))");
            yield return C("quote quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (!t3.(t3 -> (t0 t3)) t2)) t1))");
            yield return C("quote dup", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))");
            yield return C("quote swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (!t3.(t3 -> (t0 t3)) t2)))");
            yield return C("quote pop", "!t1.(!t0.(t0 t1) -> t1)");
            // NOTE: recursion now infers an explicit μ-type (the (rec N) marker is retired), so this
            // one term diverges from the original node output — see EquirecursiveIntegrationTests.
            yield return C("dup apply", "!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)");
            yield return C("dup compose", "!t0!t1.(((t0 -> t0) t1) -> ((t0 -> t0) t1))");
            yield return C("dup quote", "!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (t0 t1)))");
            yield return C("dup dup", "!t0!t1.((t0 t1) -> (t0 (t0 (t0 t1))))");
            yield return C("dup swap", "!t0!t1.((t0 t1) -> (t0 (t0 t1)))");
            yield return C("swap apply", "!t2.(!t0.(t0 !t1.(((t0 t1) -> t2) t1)) -> t2)");
            yield return C("swap compose", "!t0!t2!t3.(!t1.((t0 -> t1) ((t1 -> t2) t3)) -> ((t0 -> t2) t3))");
            yield return C("swap quote", "!t0!t1!t2.((t0 (t1 t2)) -> (!t3.(t3 -> (t1 t3)) (t0 t2)))");
            yield return C("swap dup", "!t0!t1!t2.((t0 (t1 t2)) -> (t1 (t1 (t0 t2))))");
            yield return C("swap swap", "!t0!t1!t2.((t0 (t1 t2)) -> (t0 (t1 t2)))");
            yield return C("swap pop", "!t0!t2.((t0 !t1.(t1 t2)) -> (t0 t2))");
            yield return C("pop apply", "!t2.(!t0.(t0 !t1.((t1 -> t2) t1)) -> t2)");
            yield return C("pop compose", "!t2!t3!t4.(!t0.(t0 !t1.((t1 -> t2) ((t3 -> t1) t4))) -> ((t3 -> t2) t4))");
            yield return C("pop quote", "!t1!t2.(!t0.(t0 (t1 t2)) -> (!t3.(t3 -> (t1 t3)) t2))");
            yield return C("pop dup", "!t1!t2.(!t0.(t0 (t1 t2)) -> (t1 (t1 t2)))");
            yield return C("pop swap", "!t1!t2!t3.(!t0.(t0 (t1 (t2 t3))) -> (t2 (t1 t3)))");
            yield return C("pop pop", "!t2.(!t0.(t0 !t1.(t1 t2)) -> t2)");

            yield return C("swap quote compose apply", "!t1!t2.(!t0.((t0 -> t1) (t2 t0)) -> (t2 t1))"); // Dip
            yield return C("swap quote compose apply pop", "!t1.(!t0.((t0 -> t1) !t2.(t2 t0)) -> t1)"); // Dip pop
        }

        [TestCaseSource(nameof(CoreCases))]
        public void Reproduces_original(string term, string expected)
        {
            var r = Sandbox.Run(() => Cat.InferNormalized(term));
            Assert.That(r.IsOk, Is.True, $"inference did not complete cleanly: {r}");
            Assert.That(r.Value, Is.EqualTo(expected));
        }

        // ---- the standard-library vocabulary (built by inference, order matters) -
        private static IEnumerable<TestCaseData> StdOpCases()
        {
            yield return C("papply", "!t1!t2!t3.(!t0.(((t0 t1) -> t2) (t0 t3)) -> ((t1 -> t2) t3))");
            yield return C("dip", "!t1!t2.(!t0.((t0 -> t1) (t2 t0)) -> (t2 t1))");
            yield return C("dipd", "!t1!t2!t3.(!t0.((t0 -> t1) (t2 (t3 t0))) -> (t2 (t3 t1)))");
            yield return C("popd", "!t0!t2.((t0 !t1.(t1 t2)) -> (t0 t2))");
            yield return C("pop2", "!t2.(!t0.(t0 !t1.(t1 t2)) -> t2)");
            yield return C("pop3", "!t3.(!t0.(t0 !t1.(t1 !t2.(t2 t3))) -> t3)");
            yield return C("dupd", "!t0!t1!t2.((t0 (t1 t2)) -> (t0 (t1 (t1 t2))))");
            yield return C("dupdd", "!t0!t1!t2!t3.((t0 (t1 (t2 t3))) -> (t0 (t1 (t2 (t2 t3)))))");
            yield return C("swapd", "!t0!t1!t2!t3.((t0 (t1 (t2 t3))) -> (t0 (t2 (t1 t3))))");
            yield return C("swapdd", "!t0!t1!t2!t3!t4.((t0 (t1 (t2 (t3 t4)))) -> (t0 (t1 (t3 (t2 t4)))))");
            yield return C("rollup", "!t0!t1!t2!t3.((t0 (t1 (t2 t3))) -> (t1 (t2 (t0 t3))))");
            yield return C("rolldown", "!t0!t1!t2!t3.((t0 (t1 (t2 t3))) -> (t2 (t0 (t1 t3))))");
            yield return C("dup3", "!t0!t1.((t0 t1) -> (t0 (t0 (t0 t1))))");
            yield return C("dup4", "!t0!t1.((t0 t1) -> (t0 (t0 (t0 (t0 t1)))))");
            yield return C("dup8", "!t0!t1.((t0 t1) -> (t0 (t0 (t0 (t0 (t0 (t0 (t0 (t0 t1)))))))))");
            yield return C("test", "!t0!t1.((((Num t0) -> t1) t0) -> (((Num t0) -> t1) (!t2.(t2 -> t2) t1)))");
        }

        [TestCaseSource(nameof(StdOpCases))]
        public void Reproduces_std_vocabulary(string op, string expected)
        {
            var r = Sandbox.Run(() => Cat.InferNormalized(op));
            Assert.That(r.IsOk, Is.True, $"inference did not complete cleanly: {r}");
            Assert.That(r.Value, Is.EqualTo(expected));
        }
    }
}
