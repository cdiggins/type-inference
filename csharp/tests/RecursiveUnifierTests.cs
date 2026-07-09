using NUnit.Framework;
using static TypeInference.R;

namespace TypeInference.Tests
{
    /// <summary>
    /// Tests for the equi-recursive (μ-type) unifier — the deliberate divergence that makes
    /// recursion a first-class type the unifier can both PRODUCE and CONSUME (see the header of
    /// src/RecursiveTypes.cs for the fold/unfold + memo-set algorithm and rationale). Contrast
    /// with RecursiveTypeTests, which shows the original positional `(rec N)` cannot do this.
    /// Everything is sandboxed; the algorithm terminates by construction (regular trees).
    /// </summary>
    [TestFixture]
    public class RecursiveUnifierTests
    {
        // μX.(Num -> X)  == Num -> Num -> Num -> …
        private static RMu NumStream() => Mu("X", Fun(Con("Num"), Rec("X")));
        // μY.(Num -> (Num -> Y))  — a different μ-representation of the SAME infinite tree
        private static RMu NumStream2() => Mu("Y", Fun(Con("Num"), Fun(Con("Num"), Rec("Y"))));
        private static RMu BoolStream() => Mu("X", Fun(Con("Bool"), Rec("X")));

        private static bool Equiv(RType a, RType b)
        {
            var r = Sandbox.Run(() => RecursiveUnifier.Equivalent(a, b));
            Assert.That(r.IsOk, Is.True, r.ToString());
            return r.Value;
        }

        [Test]
        public void Fold_unfold_law_mu_equals_its_one_step_unfolding()
        {
            // μX.(Num->X)  ≡  Num -> μX.(Num->X)
            var unfolded = Fun(Con("Num"), NumStream());
            Assert.That(Equiv(NumStream(), unfolded), Is.True);
        }

        [Test]
        public void Unfold_produces_an_equivalent_type()
        {
            var once = RecursiveUnifier.Unfold(NumStream());
            Assert.That(Equiv(once, NumStream()), Is.True);
        }

        [Test]
        public void Different_mu_representations_of_the_same_tree_are_equivalent()
        {
            // The worked example from the header: both denote Num->Num->…
            Assert.That(Equiv(NumStream(), NumStream2()), Is.True);
        }

        [Test]
        public void Distinct_recursive_types_are_not_equivalent()
        {
            Assert.That(Equiv(NumStream(), BoolStream()), Is.False);
        }

        [Test]
        public void Different_shape_at_the_recursion_point_is_not_equivalent()
        {
            // μX.(Num -> X)  vs  μX.(Num X)  — a function vs a bare pair.
            var pairStream = Mu("X", App(Con("Num"), Rec("X")));
            Assert.That(Equiv(NumStream(), pairStream), Is.False);
        }

        [Test]
        public void Occurs_check_introduces_a_mu_instead_of_failing()
        {
            // unify a with (Num -> a): the classic occurs violation now yields a := μa.(Num -> a).
            var run = Sandbox.Run(() =>
            {
                var (ok, s) = RecursiveUnifier.Unify(Var("a"), Fun(Con("Num"), Var("a")));
                var resolved = RecursiveUnifier.Resolve(Var("a"), s);
                return (ok, RecursiveUnifier.Equivalent(resolved, Mu("a", Fun(Con("Num"), Rec("a")))));
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value.ok, Is.True, "occurs must succeed via μ-introduction, not fail");
            Assert.That(run.Value.Item2, Is.True, "a resolves to μa.(Num -> a)");
        }

        [Test]
        public void A_variable_unifies_with_a_recursive_type()
        {
            var run = Sandbox.Run(() =>
            {
                var (ok, s) = RecursiveUnifier.Unify(Var("a"), NumStream());
                return (ok, RecursiveUnifier.Equivalent(RecursiveUnifier.Resolve(Var("a"), s), NumStream()));
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value.ok && run.Value.Item2, Is.True);
        }

        [Test]
        public void Structure_unifies_against_a_mu_by_unfolding_it()
        {
            // (Num -> a)  ~  μX.(Num -> X)   =>   a := μX.(Num -> X)
            var run = Sandbox.Run(() =>
            {
                var (ok, s) = RecursiveUnifier.Unify(Fun(Con("Num"), Var("a")), NumStream());
                return (ok, RecursiveUnifier.Equivalent(RecursiveUnifier.Resolve(Var("a"), s), NumStream()));
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value.ok && run.Value.Item2, Is.True);
        }

        [Test]
        public void Comparing_two_recursive_types_terminates_quickly()
        {
            var run = Sandbox.Run(() => RecursiveUnifier.Equivalent(NumStream(), NumStream2()), timeoutMs: 1000);
            Assert.That(run.IsOk, Is.True, $"must terminate by construction, got {run}");
            Assert.That(run.Value, Is.True);
            Assert.That(run.ElapsedMs, Is.LessThan(500));
        }

        // ---- non-recursive unification still behaves normally -----------------------

        [Test]
        public void Ordinary_unification_still_works()
        {
            var run = Sandbox.Run(() =>
            {
                var (ok1, s1) = RecursiveUnifier.Unify(Var("a"), Con("Num"));
                var aIsNum = RecursiveUnifier.Equivalent(RecursiveUnifier.Resolve(Var("a"), s1), Con("Num"));

                var (ok2, s2) = RecursiveUnifier.Unify(
                    Fun(Var("x"), Var("y")), Fun(Con("Num"), Con("Bool")));
                var xIsNum = RecursiveUnifier.Equivalent(RecursiveUnifier.Resolve(Var("x"), s2), Con("Num"));
                var yIsBool = RecursiveUnifier.Equivalent(RecursiveUnifier.Resolve(Var("y"), s2), Con("Bool"));

                return ok1 && ok2 && aIsNum && xIsNum && yIsBool;
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value, Is.True);
        }

        [Test]
        public void Mismatched_constants_and_arities_fail()
        {
            Assert.That(Equiv(Con("Num"), Con("Bool")), Is.False);
            Assert.That(Equiv(App(Con("Num"), Con("Num")),
                              App(Con("Num"), Con("Num"), Con("Num"))), Is.False);
        }

        [Test]
        public void This_is_the_correct_answer_where_the_old_engine_botched_it()
        {
            // RecursiveTypeTests: the original unifier, given a rec marker vs a concrete type,
            // clashed or mangled it. Here the analogous unification (a variable that occurs in a
            // Num-pair) yields a coherent μ-type and succeeds.
            var run = Sandbox.Run(() =>
            {
                var (ok, s) = RecursiveUnifier.Unify(Var("a"), App(Con("Num"), Var("a")));
                var resolved = RecursiveUnifier.Resolve(Var("a"), s);
                return (ok, RecursiveUnifier.Equivalent(resolved, Mu("a", App(Con("Num"), Rec("a")))));
            });
            Assert.That(run.IsOk, Is.True, run.ToString());
            Assert.That(run.Value.ok, Is.True);
            Assert.That(run.Value.Item2, Is.True, "a := μa.(Num a) — a coherent recursive type");
        }
    }
}
