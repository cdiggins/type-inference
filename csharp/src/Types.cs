using System;
using System.Collections.Generic;
using System.Linq;

namespace TypeInference
{
    // ============================================================================
    //  Faithful C# port of type-system.ts (Christopher Diggins, 2017, MIT).
    //
    //  Design goal: reproduce the ORIGINAL behavior exactly — including its quirks
    //  and bugs — so the experiments measure the real algorithm, not a cleaned-up
    //  reimagining. Places where the original does something surprising are flagged
    //  with  // NOTE / // FAITHFUL-BUG  comments.
    // ============================================================================

    /// <summary>Base class of a type: a TypeArray, TypeVariable, or TypeConstant.</summary>
    public abstract class Type
    {
        /// <summary>
        /// Every TypeVariable *instance* referenced anywhere under this type (a
        /// TypeVariable's own list contains itself). Duplicates by identity are kept,
        /// exactly as in the original (it concatenates child lists without dedup).
        /// </summary>
        public List<TypeVariable> TypeVars = new List<TypeVariable>();

        public abstract Type Clone(IDictionary<string, Type> newTypes);
    }

    /// <summary>
    /// A fixed collection of types. Encodes functions, tuples, stacks, arrays, etc.
    /// If it has TypeParameterVars (quantified variables) it is a "PolyType".
    /// </summary>
    public sealed class TypeArray : Type
    {
        public List<Type> Types;

        /// <summary>
        /// The variables universally quantified AT THIS array. Always a subset (by
        /// name) of TypeVars, and may contain the same name more than once — the
        /// original does too; TypeParameterNames deduplicates for display.
        /// </summary>
        public List<TypeVariable> TypeParameterVars = new List<TypeVariable>();

        public TypeArray(IEnumerable<Type> types, bool computeParameters)
        {
            Types = types.ToList();

            // Accumulate all referenced type-variable instances from the children.
            foreach (var t in Types)
                TypeVars.AddRange(t.TypeVars);

            if (computeParameters)
                ComputeParameters();
        }

        // --- cloning -------------------------------------------------------------

        private void CloneParameters(TypeArray dest, List<TypeVariable> from, IDictionary<string, Type> newTypes)
        {
            var pars = new List<TypeVariable>();
            foreach (var tv in from)
            {
                if (!newTypes.TryGetValue(tv.Name, out var param))
                    throw new Exception("Could not find type parameter: " + tv.Name);
                pars.Add((TypeVariable)param);
            }
            dest.TypeParameterVars = pars;
        }

        public override Type Clone(IDictionary<string, Type> newTypes)
        {
            using var _ = Guard.Enter();
            var r = new TypeArray(Types.Select(t => t.Clone(newTypes)), false);
            CloneParameters(r, TypeParameterVars, newTypes);
            return r;
        }

        /// <summary>Rename every variable in the tree to a brand-new unique name.</summary>
        public TypeArray FreshVariableNames(int id)
        {
            using var _ = Guard.Enter();
            var newTypes = new Dictionary<string, Type>();
            foreach (var t in TypeOps.DescendantTypes(this))
                if (t is TypeVariable tv)
                    newTypes[tv.Name] = TypeOps.NewTypeVar();
            return (TypeArray)Clone(newTypes);
        }

        /// <summary>
        /// Give THIS array's parameters fresh names, then recursively refresh child
        /// arrays' own parameters. This is what lets repeated substitution of a
        /// polytype keep each instance's quantifiers independent.
        /// </summary>
        public TypeArray FreshParameterNames()
        {
            using var _ = Guard.Enter();

            var newTypes = new Dictionary<string, Type>();
            foreach (var tp in TypeParameterNames)
                newTypes[tp] = TypeOps.NewTypeVar();

            var types = Types.Select(t => t.Clone(newTypes)).ToList();
            types = types.Select(t => t is TypeArray ta ? (Type)ta.FreshParameterNames() : t).ToList();

            var r = new TypeArray(types, false);
            CloneParameters(r, TypeParameterVars, newTypes);
            return r;
        }

        // --- parameters (quantifier placement) -----------------------------------

        /// <summary>Parameter names, deduplicated and sorted (ordinal, like JS sort()).</summary>
        public List<string> TypeParameterNames
        {
            get
            {
                var names = TypeParameterVars.Select(tv => tv.Name).Distinct().ToList();
                names.Sort(StringComparer.Ordinal); // matches JS Array.prototype.sort default
                return names;
            }
        }

        /// <summary>
        /// Infer which variables are universally quantified at this array, based purely
        /// on WHERE they occur. Children compute first; a variable shared across two
        /// children is then pulled up into this array. Mutates the tree in place.
        /// This is the novel "positional forall placement" that replaces HM's prenex
        /// generalization.
        /// </summary>
        public TypeArray ComputeParameters()
        {
            using var _ = Guard.Enter();

            TypeParameterVars = new List<TypeVariable>();

            // Recurse into children first (μ is transparent — recurse into its body).
            foreach (var t in Types)
                if (t is TypeArray ta)
                    ta.ComputeParameters();
                else if (t is MuType mu && mu.Body is TypeArray mb) // EQUIRECURSIVE
                    mb.ComputeParameters();

            for (var i = 0; i < Types.Count; ++i)
            {
                var child = Types[i];

                if (child is TypeVariable cv)
                {
                    TypeOps.ReassignAllTypeVars(cv.Name, this);
                }
                // A μ child exposes its body's free variables (TypeVars), so it is treated like a
                // TypeArray child for the "shared across siblings" check.
                else if (child is TypeArray || child is MuType)
                {
                    // If any of the child's variables also appear in a sibling, this
                    // variable belongs to the parent, not the child.
                    foreach (var childVar in child.TypeVars)
                        if (TypeOps.IsTypeVarUsedElsewhere(this, childVar.Name, i))
                            TypeOps.ReassignAllTypeVars(childVar.Name, this);
                }
            }

            // Invariant check straight from the original.
            foreach (var v in TypeParameterVars)
                if (!TypeVars.Contains(v)) // reference identity, like indexOf
                    throw new Exception(
                        "Internal error: type scheme references a variable that is not marked as referenced by the type variable");

            return this;
        }

        public bool IsPolyType => TypeParameterVars.Count > 0;

        public string TypeParametersToString =>
            IsPolyType ? "!" + string.Join("!", TypeParameterNames) + "." : "";

        public override string ToString() =>
            TypeParametersToString + "(" + string.Join(" ", Types.Select(t => t.ToString())) + ")";
    }

    /// <summary>A universally quantifiable variable (a generic parameter).</summary>
    public sealed class TypeVariable : Type
    {
        public readonly string Name;

        public TypeVariable(string name)
        {
            Name = name;
            TypeVars.Add(this);
        }

        public override Type Clone(IDictionary<string, Type> newTypes)
        {
            // Reuse the same fresh instance for repeated occurrences of a name, and
            // (like the original) mutate the lookup so callers see the mapping.
            if (newTypes.TryGetValue(Name, out var existing))
                return existing;
            var nv = new TypeVariable(Name);
            newTypes[Name] = nv;
            return nv;
        }

        public override string ToString() => Name;
    }

    /// <summary>An atomic, non-polymorphic type (aka MonoType): Num, Bool, -&gt;, [], ...</summary>
    public sealed class TypeConstant : Type
    {
        public readonly string Name;

        public TypeConstant(string name) { Name = name; }

        public override Type Clone(IDictionary<string, Type> newTypes) => new TypeConstant(Name);

        public override string ToString() => Name;
    }

    // ============================================================================
    //  Unification support structures
    // ============================================================================

    /// <summary>A mapping from a type-variable name to its best-fit unifying type.</summary>
    public sealed class TypeUnifier
    {
        public string Name;
        public Type Unifier;
        public TypeUnifier(string name, Type unifier) { Name = name; Unifier = unifier; }
    }
}
