using System.Collections.Generic;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Direct tests of the unifier's core behavior (variables, constants, transitivity,
    /// functions, arity, cycles), independent of the Cat layer.
    /// </summary>
    [TestFixture]
    public class UnifierTests
    {
        private static string Resolve(System.Action<Unifier> setup, Type query)
        {
            var e = new Unifier();
            setup(e);
            var t = e.GetUnifiedType(query, new List<string>(), new HashSet<string>());
            return TypeOps.NormalizeVarNames(t).ToString();
        }

        [Test]
        public void Variable_unifies_with_a_constant()
        {
            var a = TypeOps.TypeVar("a");
            Assert.That(Resolve(e => e.UnifyTypes(a, TypeOps.TypeConst("Num")), a), Is.EqualTo("Num"));
        }

        [Test]
        public void Constant_unifies_with_a_variable_symmetrically()
        {
            var a = TypeOps.TypeVar("a");
            Assert.That(Resolve(e => e.UnifyTypes(TypeOps.TypeConst("Num"), a), a), Is.EqualTo("Num"));
        }

        [Test]
        public void Two_variables_unify_to_a_single_representative()
        {
            var a = TypeOps.TypeVar("a");
            var b = TypeOps.TypeVar("b");
            Assert.That(Resolve(e => e.UnifyTypes(a, b), a), Is.EqualTo(Resolve(e => e.UnifyTypes(a, b), b)));
        }

        [Test]
        public void Unification_is_transitive()
        {
            var a = TypeOps.TypeVar("a");
            var b = TypeOps.TypeVar("b");
            var result = Resolve(e =>
            {
                e.UnifyTypes(a, b);
                e.UnifyTypes(b, TypeOps.TypeConst("Num"));
            }, a);
            Assert.That(result, Is.EqualTo("Num"), "a ~ b, b ~ Num  =>  a resolves to Num");
        }

        [Test]
        public void Function_types_unify_componentwise()
        {
            var f = TypeOps.FunctionType(TypeOps.TypeVar("a"), TypeOps.TypeVar("b"));
            var g = TypeOps.FunctionType(TypeOps.TypeConst("Num"), TypeOps.TypeConst("Bool"));
            var a = TypeOps.TypeVar("a");
            var b = TypeOps.TypeVar("b");
            Assert.That(Resolve(e => e.UnifyTypes(f, g), a), Is.EqualTo("Num"));
            Assert.That(Resolve(e => e.UnifyTypes(f, g), b), Is.EqualTo("Bool"));
        }

        [Test]
        public void Equal_constants_unify_without_error()
        {
            var r = Sandbox.Run(() =>
            {
                var e = new Unifier();
                return e.UnifyTypes(TypeOps.TypeConst("Num"), TypeOps.TypeConst("Num")).ToString();
            });
            Assert.That(r.IsOk, Is.True, r.ToString());
            Assert.That(r.Value, Is.EqualTo("Num"));
        }

        [Test]
        public void Differently_sized_lists_are_rejected()
        {
            var r = Sandbox.Run(() =>
            {
                var e = new Unifier();
                var pair = TypeOps.TypeArrayOf(TypeOps.TypeVar("a"), TypeOps.TypeVar("b"));
                var triple = TypeOps.TypeArrayOf(TypeOps.TypeVar("c"), TypeOps.TypeVar("d"), TypeOps.TypeVar("e"));
                return e.UnifyTypes(pair, triple).ToString();
            });
            Assert.That(r.IsFaulted, Is.True, r.ToString());
            Assert.That(r.FailureMessage, Does.Contain("differently sized lists"));
        }

        [Test]
        public void A_cyclic_unification_reconstructs_as_a_mu_and_terminates()
        {
            var a = TypeOps.TypeVar("a");
            var pair = TypeOps.TypeArrayOf(a, TypeOps.TypeVar("b"));
            var r = Sandbox.Run(() => Resolve(e => e.UnifyTypes(a, pair), a));
            Assert.That(r.IsOk, Is.True, r.ToString());
            Assert.That(r.Value, Is.EqualTo("μr0.(r0 t0)"));
        }

        [Test]
        public void Resolving_an_unconstrained_variable_returns_itself()
        {
            var a = TypeOps.TypeVar("a");
            Assert.That(Resolve(e => { }, a), Is.EqualTo("t0"));
        }

        [Test]
        public void Nested_function_unification_propagates_bindings()
        {
            // ((a -> b) c)  ~  ((Num -> Bool) Num)
            var lhs = TypeOps.TypeArrayOf(
                TypeOps.FunctionType(TypeOps.TypeVar("a"), TypeOps.TypeVar("b")), TypeOps.TypeVar("c"));
            var rhs = TypeOps.TypeArrayOf(
                TypeOps.FunctionType(TypeOps.TypeConst("Num"), TypeOps.TypeConst("Bool")), TypeOps.TypeConst("Num"));
            var c = TypeOps.TypeVar("c");
            Assert.That(Resolve(e => e.UnifyTypes(lhs, rhs), c), Is.EqualTo("Num"));
        }
    }
}
