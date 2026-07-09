using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Semantic laws the type system SHOULD respect. These are the highest-value bug finders:
    /// if the inferred type of two operationally-equal programs disagrees, or a known identity
    /// is not identity-shaped, the algorithm has a real problem.
    /// </summary>
    [TestFixture]
    public class AlgebraicLawTests
    {
        private static string Inf(string term)
        {
            var r = Sandbox.Run(() => Cat.InferNormalized(term));
            Assert.That(r.IsOk, Is.True, $"'{term}': {r}");
            return r.Value;
        }

        private static void AssertEquiv(string a, string b) =>
            Assert.That(Inf(a), Is.EqualTo(Inf(b)), $"'{a}' should type the same as '{b}'");

        // ---- operationally-equal programs infer the same type ----------------------

        [TestCase("dup swap", "dup")]           // duplicating then swapping the two equal copies
        [TestCase("dup dup pop", "dup")]        // one of three copies popped
        [TestCase("dup pop pop", "pop")]        // dup then remove both
        [TestCase("[] dup", "[] []")]           // dup of an id-quotation == two id-quotations
        [TestCase("swap swap swap", "swap")]
        [TestCase("0 pop", "")]                 // push a literal then pop == id on ANY stack
        [TestCase("true pop", "")]
        [TestCase("0 pop 0 pop", "")]
        // NOTE: `dup pop` and `swap swap` are identity-SHAPED but require a non-empty stack, so
        // they are NOT equal to the fully-polymorphic empty id — see the identity-shape test.
        public void Operationally_equal_terms_infer_equal_types(string a, string b) =>
            AssertEquiv(a, b);

        // ---- quotation/application cancellation:  [X] apply  ==  X ------------------

        [TestCase("dup")]
        [TestCase("swap")]
        [TestCase("pop")]
        [TestCase("quote")]
        [TestCase("compose")]
        [TestCase("apply")]
        public void Quoting_then_applying_cancels(string op) =>
            AssertEquiv($"[{op}] apply", op);

        // ---- identity-shaped terms: output structurally equals input ---------------

        [TestCase("")]
        [TestCase("dup pop")]
        [TestCase("swap swap")]
        [TestCase("quote apply")]
        [TestCase("[] apply")]
        [TestCase("0 pop")]
        [TestCase("swap swap swap swap")]
        [TestCase("dup dup pop pop")]
        public void Identity_terms_have_matching_input_and_output(string term)
        {
            var r = Sandbox.Run(() => Cat.Infer(term));
            Assert.That(r.IsOk, Is.True, r.ToString());
            var input = TypeOps.FunctionInput(r.Value);
            var output = TypeOps.FunctionOutput(r.Value);
            Assert.That(TypeOps.AreTypesSame(input, output), Is.True,
                $"'{term}': input {input} vs output {output}");
        }

        // ---- composition is associative for non-recursive terms --------------------
        // inferCatType folds one way; the OTHER folding must agree whenever no spurious
        // recursion is involved. A disagreement here is a real non-associativity bug.

        private static (string left, string right) BothFolds(params string[] ops)
        {
            var list = ops.Select(o => (TypeArray)Cat.Vocabulary[o]).ToList();
            var l = Sandbox.Run(() => TypeOps.NormalizeVarNames(TypeOps.ComposeFunctionChain(list)).ToString());
            var r = Sandbox.Run(() => TypeOps.NormalizeVarNames(TypeOps.ComposeFunctionChainReverse(list)).ToString());
            Assert.That(l.IsOk && r.IsOk, Is.True, $"left={l}; right={r}");
            return (l.Value, r.Value);
        }

        [TestCase("dup swap")]
        [TestCase("swap dup swap")]
        [TestCase("dup pop")]
        [TestCase("compose compose")]
        [TestCase("quote quote")]
        [TestCase("dup dup dup")]
        [TestCase("swap swap swap")]
        [TestCase("compose dup")]
        [TestCase("pop pop")]
        [TestCase("quote swap")]
        [TestCase("quote apply")]
        [TestCase("swap quote compose apply")]
        public void Composition_is_associative_on_non_recursive_terms(string term)
        {
            var ops = term.Split(' ');
            var (left, right) = BothFolds(ops);
            Assert.That(left, Is.EqualTo(right),
                $"left-fold and right-fold disagree on '{term}' — composition is not associative here");
        }

        // ---- standard library ops equal their definitions --------------------------

        [TestCase("dip", "swap quote compose apply")]
        [TestCase("dupd", "[dup] dip")]
        [TestCase("popd", "[pop] dip")]
        [TestCase("pop2", "pop pop")]
        [TestCase("swapd", "[swap] dip")]
        [TestCase("dup3", "dup dup")]
        [TestCase("rollup", "swap swapd")]
        public void Std_ops_match_their_definitions(string op, string def) => AssertEquiv(op, def);
    }
}
