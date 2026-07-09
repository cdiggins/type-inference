using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Direct tests of `computeParameters` — the NOVEL core of the algorithm, which places
    /// each ∀ at the innermost type array containing all of a variable's occurrences. This is
    /// what makes the system rank-N; getting the placement wrong is what would make it unsound,
    /// so testing it in isolation (on hand-built types) is high value.
    /// </summary>
    [TestFixture]
    public class ComputeParametersTests
    {
        private static TypeArray Arr(params Type[] ts) => TypeOps.TypeArrayOf(ts);
        private static TypeVariable V(string n) => TypeOps.TypeVar(n);
        private static TypeConstant C(string n) => TypeOps.TypeConst(n);

        [Test]
        public void A_variable_used_twice_as_siblings_is_bound_here()
        {
            var t = Arr(V("a"), V("a"));            // (a a)
            Assert.That(t.IsPolyType, Is.True);
            Assert.That(t.TypeParameterNames, Is.EqualTo(new[] { "a" }));
        }

        [Test]
        public void A_variable_shared_across_children_floats_up_to_the_parent()
        {
            // ((a b) (a c)) : a is in both children -> bound at the top; b, c stay local.
            var left = Arr(V("a"), V("b"));
            var right = Arr(V("a"), V("c"));
            var top = Arr(left, right);

            Assert.That(top.TypeParameterNames, Is.EqualTo(new[] { "a" }), "a shared -> top");
            Assert.That(((TypeArray)top.Types[0]).TypeParameterNames, Is.EqualTo(new[] { "b" }), "b local to left");
            Assert.That(((TypeArray)top.Types[1]).TypeParameterNames, Is.EqualTo(new[] { "c" }), "c local to right");
        }

        [Test]
        public void A_variable_used_in_one_subtree_stays_local()
        {
            // (Num (a Num)) : a occurs once, deep -> bound at the inner array only.
            var inner = Arr(V("a"), C("Num"));
            var top = Arr(C("Num"), inner);

            Assert.That(top.IsPolyType, Is.False, "top has no variable of its own");
            Assert.That(inner.TypeParameterNames, Is.EqualTo(new[] { "a" }));
        }

        [Test]
        public void Function_type_places_shared_result_var_at_the_function_level()
        {
            // (a -> a) : a on both sides of the arrow -> bound at the function.
            var f = TypeOps.FunctionType(V("a"), V("a"));
            f.ComputeParameters();
            Assert.That(f.TypeParameterNames, Is.EqualTo(new[] { "a" }));
        }

        [Test]
        public void Apply_type_is_rank_2_with_a_inside_and_b_outside()
        {
            // apply : !b.(!a.((a -> b) a) -> b). a is bound at the input pair (rank-2), b at top.
            var t = (TypeArray)Cat.Vocabulary["apply"];
            Assert.That(t.TypeParameterNames, Is.EqualTo(new[] { "b" }), "b at the outer function");

            var inputPair = (TypeArray)TypeOps.FunctionInput(t);
            Assert.That(inputPair.TypeParameterNames, Is.EqualTo(new[] { "a" }),
                "a is quantified at the input pair — the rank-2 signature of apply");
        }

        [Test]
        public void Quote_type_has_an_independent_quantifier_in_its_output()
        {
            // quote : !a!b.((a b) -> (!c.(c -> (a c)) b)). c is local to the produced quotation.
            var t = (TypeArray)Cat.Vocabulary["quote"];
            var outputPair = (TypeArray)TypeOps.FunctionOutput(t);
            var quotation = (TypeArray)outputPair.Types[0];
            Assert.That(quotation.TypeParameterNames, Is.EqualTo(new[] { "c" }),
                "the produced quotation binds its own row variable c");
        }

        [Test]
        public void ComputeParameters_is_idempotent()
        {
            var t = (TypeArray)Cat.Vocabulary["compose"];
            var once = t.ToString();
            t.ComputeParameters();
            var twice = t.ToString();
            Assert.That(twice, Is.EqualTo(once));
        }

        [Test]
        public void A_monomorphic_type_has_no_parameters()
        {
            var t = Arr(C("Num"), C("Bool"));
            Assert.That(t.IsPolyType, Is.False);
            Assert.That(t.TypeParameterNames, Is.Empty);
        }

        [Test]
        public void Every_parameter_is_among_the_referenced_variables()
        {
            // Invariant that computeParameters itself asserts; check it holds on the vocabulary.
            foreach (var name in new[] { "apply", "compose", "quote", "dup", "swap", "pop" })
            {
                var t = (TypeArray)Cat.Vocabulary[name];
                foreach (var p in t.TypeParameterVars)
                    Assert.That(t.TypeVars.Contains(p), Is.True, $"{name}: {p.Name} not referenced");
            }
        }

        [Test]
        public void Distinct_variables_in_distinct_subtrees_are_bound_independently()
        {
            // ((a b) (c d)) : nothing shared -> each child binds its own pair, top binds nothing.
            var left = Arr(V("a"), V("b"));
            var right = Arr(V("c"), V("d"));
            var top = Arr(left, right);

            Assert.That(top.IsPolyType, Is.False);
            Assert.That(left.TypeParameterNames, Is.EqualTo(new[] { "a", "b" }));
            Assert.That(right.TypeParameterNames, Is.EqualTo(new[] { "c", "d" }));
        }
    }
}
