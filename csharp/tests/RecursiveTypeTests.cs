using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Investigates whether the `(rec N)` marker could be promoted to a genuine (equi)
    /// recursive type — a μ-type / rational tree.
    ///
    /// Context: unification here omits the occurs check and detects cycles lazily, which
    /// is *exactly* rational-tree (equirecursive) unification. So in principle `(rec N)`
    /// is the natural μ-type reading of what the engine already computes, and for any one
    /// type only finitely many distinct back-references are needed (a regular tree has
    /// finitely many distinct subtrees). The obstacles are in THIS encoding, demonstrated
    /// below:
    ///
    ///   1. `N` counts RECONSTRUCTION steps, not tree nodes, so the μ-binder it refers to
    ///      is not present in the printed type and is not locally recoverable (two `(rec 0)`
    ///      in one type sit at different tree depths).
    ///   2. `N` is not even stable — `ReplaceBugTests` shows it flips 1↔0 with an unrelated
    ///      bug, so it is not a semantic binder index.
    ///   3. The unifier cannot CONSUME a rec marker: it treats `(rec N)` as a dumb 2-element
    ///      array, so it clashes on the marker word itself (`rec` vs `Num`), crashes on arity
    ///      mismatch (vs a 3-element function type), and compares recursion indices as plain
    ///      constants (`0` vs `1`) — none of which is back-reference semantics.
    ///
    /// Conclusion: "yes in principle (equirecursive), no with this representation". Making
    /// it real needs explicit μ-binders + fold/unfold unification — not a flag flip.
    /// </summary>
    [TestFixture]
    public class RecursiveTypeTests
    {
        private static void FindRec(Type t, int depth, List<(string node, int depth)> acc)
        {
            if (t is TypeArray a)
            {
                if (TypeOps.IsTypeConstant(a.Types[0], "rec"))
                    acc.Add((a.ToString(), depth));
                foreach (var c in a.Types) FindRec(c, depth + 1, acc);
            }
        }

        private static RunResult<string> Unify(Type a, Type b) =>
            Sandbox.Run(() =>
            {
                var e = new Unifier();
                return TypeOps.NormalizeVarNames(e.UnifyTypes(a, b)).ToString();
            });

        [Test]
        public void Rec_index_counts_expansion_steps_not_tree_nodes()
        {
            // Unify a with (a (a b)): one variable expansion, two occurrences of `a` at
            // different structural depths. Both become `(rec 0)` because N counts the (single)
            // expansion step, not the tree position.
            var run = Sandbox.Run(() =>
            {
                var a = TypeOps.TypeVar("a");
                var b = TypeOps.TypeVar("b");
                var cyclic = TypeOps.TypeArrayOf(a, TypeOps.TypeArrayOf(a, b)); // (a (a b))
                var e = new Unifier();
                e.UnifyTypes(a, cyclic);
                return TypeOps.NormalizeVarNames(
                    e.GetUnifiedType(a, new List<string>(), new HashSet<string>()));
            });
            Assert.That(run.IsOk, Is.True, run.ToString());

            var recs = new List<(string node, int depth)>();
            FindRec(run.Value, 0, recs);

            Assert.That(recs.Count, Is.EqualTo(2));
            Assert.That(recs.All(r => r.node == "(rec 0)"), Is.True,
                "both occurrences are labelled (rec 0)");
            Assert.That(recs.Select(r => r.depth).OrderBy(d => d), Is.EqualTo(new[] { 1, 2 }),
                "yet they sit at DIFFERENT tree depths — so N is not a tree-node back-index, " +
                "and the binder it denotes is not recoverable from the printed type");
        }

        [Test]
        public void Unifier_clashes_on_the_rec_marker_word_itself()
        {
            // (rec 0) vs (Num s): both are 2-arrays, so _unifyLists compares element 0 —
            // the constant `rec` against `Num` — which now clashes. The unifier has no concept
            // of a rec marker; it is just structure.
            var r = Unify(TypeOps.RecursiveType(0),
                          TypeOps.TypeArrayOf(TypeOps.TypeConst("Num"), TypeOps.TypeVar("s")));
            Assert.That(r.IsFaulted, Is.True, r.ToString());
            Assert.That(r.Error, Is.TypeOf<UnificationError>());
            Assert.That(r.FailureMessage, Does.Contain("rec").And.Contain("Num"));
        }

        [Test]
        public void Unifier_crashes_unifying_a_rec_marker_against_a_function()
        {
            // (rec 0) is a 2-array; a function type is a 3-array -> arity mismatch throws.
            var r = Unify(TypeOps.RecursiveType(0),
                          TypeOps.FunctionType(TypeOps.TypeVar("a"), TypeOps.TypeVar("b")));
            Assert.That(r.IsFaulted, Is.True, $"expected a throw, got {r}");
            Assert.That(r.FailureMessage, Does.Contain("differently sized lists"));
        }

        [Test]
        public void Unifier_compares_recursion_indices_as_plain_constants()
        {
            // (rec 0) and (rec 1) denote different μ-levels. The unifier compares element 1 —
            // the constant `0` against `1` — as ordinary constants, so it clashes rather than
            // reasoning about recursion depth at all.
            var r = Unify(TypeOps.RecursiveType(0), TypeOps.RecursiveType(1));
            Assert.That(r.IsFaulted, Is.True, r.ToString());
            Assert.That(r.FailureMessage, Does.Contain("0").And.Contain("1"));
        }

        [Test]
        public void The_rational_tree_is_already_computed_only_the_label_rejects_it()
        {
            // The "yes in principle" side: inference of a self-application terminates and
            // deterministically produces a rec-annotated (rational-tree) type. Nothing about
            // the computation fails — it is only the downstream isValid label that rejects it.
            var a = Sandbox.Run(() => Cat.InferNormalized("dup apply"));
            var b = Sandbox.Run(() => Cat.InferNormalized("dup apply"));
            Assert.That(a.IsOk && b.IsOk, Is.True);
            Assert.That(a.Value, Is.EqualTo(b.Value), "deterministic");
            Assert.That(a.Value, Does.Contain("rec"));

            var valid = Sandbox.Run(() => TypeOps.IsValid(Cat.Infer("dup apply")));
            Assert.That(valid.Value, Is.False, "computed successfully, but labelled invalid");
        }
    }
}
