using System;
using System.Collections.Generic;
using System.Linq;

namespace TypeInference
{
    /// <summary>A genuine unification failure (only thrown in strict mode).</summary>
    public sealed class UnificationError : Exception
    {
        public UnificationError(string message) : base(message) { }
    }

    /// <summary>
    /// Faithful port of the <c>Unifier</c> class from type-system.ts.
    ///
    /// Notable behaviors:
    ///  * NO failing occurs check. Cyclic types are detected lazily in
    ///    <see cref="GetUnifiedType"/> and turned into explicit equi-recursive μ-types
    ///    (see Equirecursive.cs), which <see cref="UnifyTypes"/> then folds/unfolds.
    ///  * DEVIATION FROM THE ORIGINAL: the original fused two mismatched constants (or a
    ///    constant vs. an array) into a sum type <c>(| ...)</c>, so it never rejected a
    ///    program. Per an explicit design decision the sum types have been removed; a clash
    ///    now throws <see cref="UnificationError"/>. This changes behavior ONLY on
    ///    ill-typed terms; every well-typed term (the whole FidelityTests corpus) is
    ///    unaffected, because the stock vocabulary never forces two constants together.
    ///  * <see cref="ReplaceVarWithType"/> has a real bug (a JS object literal used a
    ///    literal key "varName" instead of the variable's name). It is ported exactly;
    ///    <see cref="ReplaceVarWithTypeFixed"/> is the corrected version, used only by
    ///    experiments that probe whether the bug is load-bearing.
    /// </summary>
    public sealed class Unifier
    {
        /// <summary>
        /// Process-wide default for <see cref="UseFixedReplace"/>. Lets experiments flip
        /// the whole engine (including the internally-created unifiers in ComposeFunctions)
        /// between the faithful buggy behavior and the corrected substitution.
        /// </summary>
        public static bool UseFixedReplaceDefault = false;

        /// <summary>Use the buggy (original) replacement, or the corrected one.</summary>
        public bool UseFixedReplace = UseFixedReplaceDefault;

        public Dictionary<string, TypeUnifier> Unifiers = new Dictionary<string, TypeUnifier>();

        // Memo (assumption) set for the coinductive fold/unfold; scoped to this unifier.
        private readonly HashSet<string> _muAssume = new HashSet<string>();

        // --- top-level unification ----------------------------------------------

        public Type UnifyTypes(Type t1, Type t2, int depth = 0)
        {
            using var _ = Guard.Enter();

            if (t1 == null || t2 == null)
                throw new Exception("Missing type expression");

            if (ReferenceEquals(t1, t2))
                return t1;

            if (t1 is TypeVariable v1)
            {
                var r = UpdateUnifier(v1, t2, depth);
                UpdateAllUnifiers(v1.Name, t2);
                return r;
            }
            if (t2 is TypeVariable v2)
            {
                var r = UpdateUnifier(v2, t1, depth);
                UpdateAllUnifiers(v2.Name, t1);
                return r;
            }
            // A μ meeting a structured type is folded/unfolded coinductively. The memo set makes
            // revisiting the same pair succeed, so this terminates (regular trees ⇒ finitely many
            // distinct pairs). var-vs-μ was already handled above by binding the variable to the μ.
            if (t1 is MuType || t2 is MuType)
            {
                var key = t1 + " ~≟~ " + t2;
                if (_muAssume.Contains(key)) return t1;
                _muAssume.Add(key);
                var u1 = t1 is MuType m1 ? Equi.Unfold(m1) : t1;
                var u2 = t2 is MuType m2 ? Equi.Unfold(m2) : t2;
                return UnifyTypes(u1, u2, depth);
            }
            if (t1 is TypeConstant c1 && t2 is TypeConstant c2)
            {
                if (c1.Name == c2.Name) return t1;
                // Sum types REMOVED (per design decision): a constant clash is a real error.
                throw new UnificationError($"Cannot unify constants {c1.Name} and {c2.Name}");
            }
            if (t1 is TypeConstant || t2 is TypeConstant)
            {
                // A constant vs. a structured type (e.g. applying a non-function) is an error too.
                throw new UnificationError($"Cannot unify {t1} with {t2}");
            }
            if (t1 is TypeArray a1 && t2 is TypeArray a2)
            {
                return UnifyLists(a1, a2, depth + 1);
            }

            throw new Exception("Internal error, unexpected code path: " + t1 + " and " + t2);
        }

        // --- reconstructing a unified type --------------------------------------

        /// <summary>
        /// Replace all variables in <paramref name="expr"/> with their unified form.
        /// <paramref name="previousVars"/> tracks the path of variables currently being
        /// expanded (most recent first) to detect cycles → <c>(rec depth)</c>.
        /// <paramref name="unifiedVars"/> is shared across the whole walk: once a
        /// polytype unifier has been expanded, later occurrences get fresh parameter
        /// names (this is what keeps independent quantifiers independent).
        /// </summary>
        public Type GetUnifiedType(Type expr, List<string> previousVars, HashSet<string> unifiedVars)
        {
            using var _ = Guard.Enter();

            switch (expr)
            {
                case TypeConstant:
                    return expr;

                case RecVar:
                    return expr; // EQUIRECURSIVE: a bound recursion variable is terminal

                case TypeVariable tv:
                {
                    // A cycle back to a variable already being expanded is a NAMED recursion
                    // back-reference (the μ binder is placed below, at the expansion point).
                    if (previousVars.Contains(tv.Name))
                        return new RecVar(tv.Name);

                    if (!Unifiers.TryGetValue(tv.Name, out var u))
                        return expr;

                    switch (u.Unifier)
                    {
                        case TypeVariable:
                        case TypeConstant:
                            return u.Unifier;
                        case TypeArray ua:
                        {
                            var nextPrev = Prepend(tv.Name, previousVars);
                            Type body;
                            if (unifiedVars.Contains(u.Name))
                                body = GetUnifiedType(ua.FreshParameterNames(), nextPrev, unifiedVars);
                            else
                            {
                                unifiedVars.Add(u.Name);
                                body = GetUnifiedType(u.Unifier, nextPrev, unifiedVars);
                            }
                            // If the expansion looped back to tv, bind it with a μ placed exactly here.
                            if (Equi.ContainsRecVar(body, tv.Name))
                                return new MuType(tv.Name, body);
                            return body;
                        }
                        default:
                            throw new Exception("Unhandled kind of type " + expr);
                    }
                }

                case MuType mu:
                    return new MuType(mu.Bound, GetUnifiedType(mu.Body, previousVars, unifiedVars));

                case TypeArray ta:
                {
                    var types = ta.Types.Select(t => GetUnifiedType(t, previousVars, unifiedVars)).ToList();
                    return new TypeArray(types, false);
                }

                default:
                    throw new Exception("Unrecognized kind of type expression " + expr);
            }
        }

        private static List<string> Prepend(string head, List<string> tail)
        {
            var r = new List<string>(tail.Count + 1) { head };
            r.AddRange(tail);
            return r;
        }

        // --- internals -----------------------------------------------------------

        private Type ChooseBestUnifier(Type t1, Type t2, int depth)
        {
            if (t1 is TypeVariable && t2 is TypeVariable) return t1;
            if (t1 is TypeVariable) return t2;
            if (t2 is TypeVariable) return t1;
            return UnifyTypes(t1, t2, depth + 1);
        }

        private TypeArray UnifyLists(TypeArray list1, TypeArray list2, int depth)
        {
            if (list1.Types.Count != list2.Types.Count)
                throw new Exception("Cannot unify differently sized lists: " + list1 + " and " + list2);
            for (var i = 0; i < list1.Types.Count; ++i)
                UnifyTypes(list1.Types[i], list2.Types[i], depth);
            return list1; // original returns the first list
        }

        private void UpdateVariableUnifiers(string varName, TypeUnifier u)
        {
            foreach (var key in Unifiers.Keys.ToList())
            {
                var t = Unifiers[key].Unifier;
                if (t is TypeVariable tv && tv.Name == varName)
                    Unifiers[key] = u;
            }
        }

        /// <summary>
        /// Replace occurrences of <paramref name="varName"/> with <paramref name="replace"/>
        /// inside <paramref name="target"/>. FAITHFUL PORT — see class remarks; the
        /// TypeArray branch is a no-op-ish structural clone because of the original bug.
        /// </summary>
        private Type ReplaceVarWithType(Type target, string varName, Type replace)
        {
            using var _ = Guard.Enter();

            if (UseFixedReplace)
                return ReplaceVarWithTypeFixed(target, varName, replace);

            // Replacing a variable with a variable is meaningless; leave as-is.
            if (replace is TypeVariable)
                return target;

            if (replace is TypeArray ra && ra.IsPolyType)
                replace = ra.FreshParameterNames();

            switch (target)
            {
                case TypeVariable tv:
                    return tv.Name == varName ? replace : target;
                case TypeConstant:
                    return target;
                case TypeArray ta:
                    // FAITHFUL-BUG: the original wrote `target.clone({varName: replace})`,
                    // a JS object with the LITERAL key "varName" (not the value of the
                    // varName parameter). So the substitution table never matches any real
                    // variable name; this yields a structural clone that leaves variables
                    // unchanged. Reproduced exactly:
                    return ta.Clone(new Dictionary<string, Type> { ["varName"] = replace });
                case MuType mu: // EQUIRECURSIVE
                    return new MuType(mu.Bound, ReplaceVarWithType(mu.Body, varName, replace));
                case RecVar:
                    return target;
                default:
                    throw new Exception("Unrecognized kind of type " + target);
            }
        }

        /// <summary>The corrected substitution (uses the actual variable name as key).</summary>
        private Type ReplaceVarWithTypeFixed(Type target, string varName, Type replace)
        {
            using var _ = Guard.Enter();

            if (replace is TypeVariable)
                return target;

            if (replace is TypeArray ra && ra.IsPolyType)
                replace = ra.FreshParameterNames();

            switch (target)
            {
                case TypeVariable tv:
                    return tv.Name == varName ? replace : target;
                case TypeConstant:
                    return target;
                case TypeArray ta:
                    return ta.Clone(new Dictionary<string, Type> { [varName] = replace });
                case MuType mu: // EQUIRECURSIVE
                    return new MuType(mu.Bound, ReplaceVarWithTypeFixed(mu.Body, varName, replace));
                case RecVar:
                    return target;
                default:
                    throw new Exception("Unrecognized kind of type " + target);
            }
        }

        private IEnumerable<TypeUnifier> AllUnifiers => Unifiers.Values;

        private void UpdateAllUnifiers(string a, Type t)
        {
            foreach (var tu in AllUnifiers.ToList())
                tu.Unifier = ReplaceVarWithType(tu.Unifier, a, t);
        }

        private Type UpdateUnifier(TypeVariable a, Type t, int depth)
        {
            var u = GetOrCreateUnifier(a);
            if (t is TypeVariable tvIn)
                t = GetOrCreateUnifier(tvIn).Unifier;

            u.Unifier = ChooseBestUnifier(u.Unifier, t, depth);
            UpdateVariableUnifiers(a.Name, u);
            if (t is TypeVariable tv2)
                UpdateVariableUnifiers(tv2.Name, u);

            return u.Unifier;
        }

        private TypeUnifier GetOrCreateUnifier(TypeVariable t)
        {
            if (!Unifiers.TryGetValue(t.Name, out var u))
                return Unifiers[t.Name] = new TypeUnifier(t.Name, t);
            return u;
        }

        // --- debug ---------------------------------------------------------------

        public string State =>
            string.Join("\n", Unifiers.Select(kv =>
                $"type unifier for {kv.Key}, unifier name {kv.Value.Name}, unifying type {kv.Value.Unifier}"));
    }
}
