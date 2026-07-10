using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Tests of `isValid` and the polytype predicates. `isValid` is the algorithm's own
    /// notion of a well-formed result: rec-free, and every quantified function parameter
    /// actually occurs in the function's input.
    /// </summary>
    [TestFixture]
    public class ValidityTests
    {
        private static bool Valid(string term)
        {
            var r = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer(term)));
            Assert.That(r.IsOk, Is.True, $"'{term}': {r}");
            return r.Value;
        }

        [TestCase("dup")]
        [TestCase("swap")]
        [TestCase("pop")]
        [TestCase("apply")]
        [TestCase("compose")]
        [TestCase("quote")]
        [TestCase("quote dup")]          // rank-2, still valid
        [TestCase("swap quote compose apply")]
        [TestCase("0 dup")]
        public void Well_typed_terms_are_valid(string term) =>
            Assert.That(Valid(term), Is.True);

        [TestCase("dup apply")]          // genuine self-application
        [TestCase("quote dup apply")]    // recursive under the default right-fold
        public void Recursive_terms_are_valid_mu_types(string term) =>
            Assert.That(Valid(term), Is.True); // equirecursive: μ-types are well-formed

        [Test]
        public void A_bare_rec_marker_is_invalid()
        {
            Assert.That(TypeOps.IsValid(TypeOps.RecursiveType(0)), Is.False);
            Assert.That(TypeOps.IsValid(TypeOps.RecursiveType(3)), Is.False);
        }

        [Test]
        public void A_phantom_output_variable_is_invalid()
        {
            // (Num -> a): the result type variable `a` never appears in the input, so the
            // function claims to conjure an arbitrary type. isValid rejects it.
            var f = TypeOps.FunctionType(TypeOps.TypeConst("Num"), TypeOps.TypeVar("a"));
            f.ComputeParameters();
            Assert.That(TypeOps.IsValid(f), Is.False);
        }

        [Test]
        public void A_parameter_that_occurs_on_the_input_is_valid()
        {
            // (a -> Num): the parameter occurs in the input -> fine.
            var f = TypeOps.FunctionType(TypeOps.TypeVar("a"), TypeOps.TypeConst("Num"));
            f.ComputeParameters();
            Assert.That(TypeOps.IsValid(f), Is.True);
        }

        [Test]
        public void generatesPolytypes_detects_polytype_producing_functions()
        {
            // quote's output contains a polytype (the produced quotation); dup's does not.
            Assert.That(TypeOps.GeneratesPolytypes(Cat.Vocabulary["quote"]), Is.True);
            Assert.That(TypeOps.GeneratesPolytypes(Cat.Vocabulary["dup"]), Is.False);
        }

        [Test]
        public void isPolyType_and_isFunctionType_agree_with_structure()
        {
            var dup = Cat.Vocabulary["dup"];
            Assert.That(TypeOps.IsFunctionType(dup), Is.True);
            Assert.That(TypeOps.IsPolyType(dup), Is.True);
            Assert.That(TypeOps.IsFunctionType(TypeOps.TypeConst("Num")), Is.False);
            Assert.That(TypeOps.IsPolyType(TypeOps.TypeConst("Num")), Is.False);
        }
    }
}
