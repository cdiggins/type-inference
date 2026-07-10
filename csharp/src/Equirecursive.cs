using System;
using System.Collections.Generic;
using System.Linq;

namespace TypeInference
{
    // =========================================================================================
    //  Equirecursive integration into the MAIN engine (a deliberate divergence, gated by a flag).
    //
    //  This completes the follow-on flagged in RecursiveTypes.cs: instead of the positional,
    //  ambiguous, unconsumable `(rec N)` marker, end-to-end inference can now PRODUCE and CONSUME
    //  real μ-types.
    //
    //  Two explicit Type nodes are added:
    //     * MuType  — μX.Body, a self-contained recursive binder placed exactly at the point of
    //                 recursion during reconstruction (GetUnifiedType).
    //     * RecVar  — the bound X: a NAMED back-reference (not a de-Bruijn count over expansion
    //                 steps), so the binder it denotes is unambiguous.
    //
    //  The integration is spread across four existing spots, each marked `// EQUIRECURSIVE:`
    //     * Unifier.GetUnifiedType — emit μ / RecVar instead of `(rec N)` (PRODUCE).
    //     * Unifier.UnifyTypes     — fold/unfold + a per-unifier memo set so a μ flowing into a
    //                                later composition is consumed coinductively (CONSUME).
    //     * TypeArray.ComputeParameters + TypeOps.DescendantTypes/NormalizeVarNames — treat μ as a
    //                                transparent wrapper so ∀-placement and normalization keep
    //                                working through it; RecVar is never ∀-quantified.
    //
    //  Everything is behind Unifier.Equirecursive (default false). With the flag off, μ nodes are
    //  never created, so the faithful port and all of FidelityTests are byte-for-byte unchanged.
    //
    //  See RecursiveTypes.cs for the algorithm, decidability argument, and references; this file is
    //  the same coinductive fold/unfold, but on the engine's own Type representation.
    // =========================================================================================

    /// <summary>μX.Body — an explicit equirecursive binder.</summary>
    public sealed class MuType : Type
    {
        public readonly string Bound;
        public readonly Type Body;

        public MuType(string bound, Type body)
        {
            Bound = bound;
            Body = body;
            // The FREE type variables of a μ are those of its body (RecVar is not a TypeVariable),
            // so the μ is transparent to ∀-placement and normalization.
            TypeVars = new List<TypeVariable>(body.TypeVars);
        }

        public override Type Clone(IDictionary<string, Type> newTypes)
        {
            using var _ = Guard.Enter();
            var bound = newTypes.TryGetValue(Bound, out var b) && b is RecVar rv ? rv.Name : Bound;
            return new MuType(bound, Body.Clone(newTypes));
        }

        public override string ToString() => "μ" + Bound + "." + Body;
    }

    /// <summary>The bound recursion variable X inside μX.Body. Not a type variable — never ∀-quantified.</summary>
    public sealed class RecVar : Type
    {
        public readonly string Name;

        public RecVar(string name) { Name = name; }

        public override Type Clone(IDictionary<string, Type> newTypes) =>
            newTypes.TryGetValue(Name, out var t) && t is RecVar ? t : new RecVar(Name);

        public override string ToString() => Name;
    }

    /// <summary>Helpers for the equirecursive fold/unfold.</summary>
    public static class Equi
    {
        /// <summary>Does <paramref name="t"/> reference the recursion variable <paramref name="name"/>?
        /// (Stops at a shadowing inner μ of the same name.)</summary>
        public static bool ContainsRecVar(Type t, string name)
        {
            using var _ = Guard.Enter();
            return t switch
            {
                RecVar rv => rv.Name == name,
                TypeArray a => a.Types.Any(x => ContainsRecVar(x, name)),
                MuType mu => mu.Bound != name && ContainsRecVar(mu.Body, name),
                _ => false
            };
        }

        /// <summary>One unfold step: μX.T  ->  T[X := μX.T].</summary>
        public static Type Unfold(MuType mu) => Replace(mu.Body, mu.Bound, mu);

        private static Type Replace(Type t, string recName, Type with)
        {
            using var _ = Guard.Enter();
            return t switch
            {
                RecVar r => r.Name == recName ? with : r,
                TypeArray a => new TypeArray(a.Types.Select(x => Replace(x, recName, with)), false),
                MuType mu => mu.Bound == recName ? mu : new MuType(mu.Bound, Replace(mu.Body, recName, with)),
                _ => t
            };
        }

        /// <summary>True if the type contains any μ binder.</summary>
        public static bool IsRecursive(Type t) =>
            TypeOps.DescendantTypes(t).OfType<MuType>().Any();
    }
}
