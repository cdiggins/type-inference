using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace TypeInference
{
    /// <summary>
    /// Faithful port of the free functions in type-system.ts (constructors, helpers,
    /// the top-level Compose / Quotation operators, and name normalization).
    /// </summary>
    public static class TypeOps
    {
        // --- fresh names ---------------------------------------------------------

        private static long _id = 0;

        /// <summary>Global fresh-variable counter, never reset (matches the original).</summary>
        public static TypeVariable NewTypeVar() => new TypeVariable("$" + (_id++));

        // --- constructors --------------------------------------------------------

        public static TypeArray TypeArrayOf(IEnumerable<Type> types) => new TypeArray(types, true);
        public static TypeArray TypeArrayOf(params Type[] types) => new TypeArray(types, true);
        public static TypeConstant TypeConst(string name) => new TypeConstant(name);
        public static TypeVariable TypeVar(string name) => new TypeVariable(name);

        public static TypeArray FunctionType(Type input, Type output) =>
            TypeArrayOf(input, TypeConst("->"), output);

        // NOTE: SumType / IsSumType / SumTypeOptions removed — sum types are no longer part
        // of the engine (a constant clash is now a UnificationError, not a fused sum).

        public static TypeArray ArrayType(Type element) => TypeArrayOf(element, TypeConst("[]"));
        public static TypeArray ListType(Type element) => TypeArrayOf(element, TypeConst("*"));

        /// <summary>A recursive-type marker. The number is the depth up to the base case.</summary>
        public static TypeArray RecursiveType(long depth) =>
            TypeArrayOf(TypeConst("rec"), TypeConst(depth.ToString()));

        // --- predicates ----------------------------------------------------------

        public static bool IsTypeConstant(Type t, string name) => t is TypeConstant c && c.Name == name;
        public static bool IsTypeVariable(Type t, string name) => t is TypeVariable v && v.Name == name;

        public static bool VariableOccurs(string name, Type type) =>
            DescendantTypes(type).Any(t => IsTypeVariable(t, name));

        public static bool IsArrayType(Type t) =>
            t is TypeArray a && a.Types.Count == 2 && IsTypeConstant(a.Types[1], "[]");

        public static bool IsFunctionType(Type t) =>
            t is TypeArray a && a.Types.Count == 3 && IsTypeConstant(a.Types[1], "->");

        public static Type FunctionInput(Type t)
        {
            if (!IsFunctionType(t)) throw new Exception("Expected a function type");
            return ((TypeArray)t).Types[0];
        }

        public static Type FunctionOutput(Type t)
        {
            if (!IsFunctionType(t)) throw new Exception("Expected a function type");
            return ((TypeArray)t).Types[2];
        }

        public static bool IsPolyType(Type t) => t is TypeArray a && a.TypeParameterVars.Count > 0;

        public static bool GeneratesPolytypes(Type t) =>
            IsFunctionType(t) && DescendantTypes(FunctionOutput(t)).Any(IsPolyType);

        // --- traversal -----------------------------------------------------------

        public static List<Type> DescendantTypes(Type t, List<Type> r = null)
        {
            using var _ = Guard.Enter();
            r ??= new List<Type>();
            r.Add(t);
            if (t is TypeArray a)
                foreach (var c in a.Types)
                    DescendantTypes(c, r);
            return r;
        }

        // --- quantifier-placement helpers (used by TypeArray.ComputeParameters) ---

        public static bool IsTypeVarUsedElsewhere(TypeArray t, string varName, int pos)
        {
            for (var i = 0; i < t.Types.Count; ++i)
                if (i != pos && t.Types[i].TypeVars.Any(v => v.Name == varName))
                    return true;
            return false;
        }

        /// <summary>Move a variable's quantifier up to array <paramref name="t"/>,
        /// removing it from every array below.</summary>
        public static void ReassignVarScheme(TypeVariable v, TypeArray t)
        {
            foreach (var x in DescendantTypes(t))
                if (x is TypeArray xa)
                    xa.TypeParameterVars = xa.TypeParameterVars.Where(vd => vd.Name != v.Name).ToList();
            t.TypeParameterVars.Add(v);
        }

        public static void ReassignAllTypeVars(string varName, TypeArray t)
        {
            foreach (var v in t.TypeVars.Where(v => v.Name == varName).ToList())
                ReassignVarScheme(v, t);
        }

        // --- fresh-name entry points --------------------------------------------

        public static Type FreshVariableNames(Type t, int id) =>
            t is TypeArray a ? a.FreshVariableNames(id) : t;

        public static Type FreshParameterNames(Type t) =>
            t is TypeArray a ? a.FreshParameterNames() : t;

        public static Type ComputeParameters(Type t) =>
            t is TypeArray a ? a.ComputeParameters() : t;

        // --- variable-name normalization ----------------------------------------

        /// <summary>Rename variables to t0..tN in pre-order of first appearance.</summary>
        public static Type NormalizeVarNames(Type t)
        {
            var names = new Dictionary<string, Type>();
            var count = 0;
            foreach (var dt in DescendantTypes(t))
                if (dt is TypeVariable v && !names.ContainsKey(v.Name))
                    names[v.Name] = TypeVar("t" + count++);
            return t.Clone(names);
        }

        private static string NumberToLetters(int n) => ((char)('a' + n)).ToString();

        /// <summary>Rename variables to a..z in pre-order of first appearance.</summary>
        public static Type AlphabetizeVarNames(Type t)
        {
            var names = new Dictionary<string, Type>();
            var count = 0;
            foreach (var dt in DescendantTypes(t))
                if (dt is TypeVariable v && !names.ContainsKey(v.Name))
                    names[v.Name] = TypeVar(NumberToLetters(count++));
            return t.Clone(names);
        }

        public static bool AreTypesSame(Type t1, Type t2) =>
            NormalizeVarNames(t1).ToString() == NormalizeVarNames(t2).ToString();

        // --- validity ------------------------------------------------------------

        public static bool VariableOccursOnInput(string varName, TypeArray type)
        {
            // NOTE: faithful port — the loop recomputes functionInput(type) of the OUTER
            // type each iteration and ignores the descendant `t`. Preserved as-is.
            foreach (var t in DescendantTypes(type))
                if (IsFunctionType(t))
                {
                    var input = FunctionInput(type);
                    if (VariableOccurs(varName, input))
                        return true;
                }
            return false;
        }

        /// <summary>
        /// A type is invalid if it contains a <c>rec</c> marker, or a function whose
        /// quantified parameter does not occur in its input (an unusable rank-N binder).
        /// </summary>
        public static bool IsValid(Type type)
        {
            foreach (var t in DescendantTypes(type))
            {
                if (IsTypeConstant(t, "rec"))
                    return false;
                if (t is TypeArray a && IsFunctionType(a))
                    foreach (var p in a.TypeParameterNames)
                        if (!VariableOccursOnInput(p, a))
                            return false;
            }
            return true;
        }

        // --- top-level operators -------------------------------------------------

        /// <summary>Compose two function types by unifying f's output with g's input.</summary>
        public static TypeArray ComposeFunctions(TypeArray f, TypeArray g)
        {
            if (!IsFunctionType(f)) throw new Exception("Expected a function type for f");
            if (!IsFunctionType(g)) throw new Exception("Expected a function type for g");

            f = (TypeArray)f.FreshVariableNames(0);
            g = (TypeArray)g.FreshVariableNames(1);

            var inF = FunctionInput(f);
            var outF = FunctionOutput(f);
            var inG = FunctionInput(g);
            var outG = FunctionOutput(g);

            var e = new Unifier();
            e.UnifyTypes(outF, inG);
            var input = e.GetUnifiedType(inF, new List<string>(), new HashSet<string>());
            var output = e.GetUnifiedType(outG, new List<string>(), new HashSet<string>());

            var r = FunctionType(input, output);
            r.ComputeParameters();
            r = (TypeArray)NormalizeVarNames(r);
            return r;
        }

        public static TypeArray ComposeFunctionChain(IReadOnlyList<TypeArray> fxns)
        {
            if (fxns.Count == 0) return IdFunction();
            var t = fxns[0];
            for (var i = 1; i < fxns.Count; ++i)
                t = ComposeFunctions(t, fxns[i]);
            return t;
        }

        public static TypeArray ComposeFunctionChainReverse(IReadOnlyList<TypeArray> fxns)
        {
            if (fxns.Count == 0) return IdFunction();
            var t = fxns[fxns.Count - 1];
            for (var i = fxns.Count - 2; i >= 0; --i)
                t = ComposeFunctions(fxns[i], t);
            return t;
        }

        /// <summary>A function that pushes a value of type <paramref name="x"/> onto any
        /// stack. With null it is the identity function.</summary>
        public static TypeArray Quotation(Type x)
        {
            var row = TypeVar("_");
            x = FreshParameterNames(x);
            var r = FunctionType(row, x != null ? (Type)TypeArrayOf(x, row) : row);
            r.ComputeParameters();
            r = (TypeArray)NormalizeVarNames(r);
            return r;
        }

        public static TypeArray IdFunction() => Quotation(null);

        // --- row-polymorphic helpers --------------------------------------------

        public static Type RowPolymorphicList(IReadOnlyList<Type> types)
        {
            if (types.Count == 0)
                throw new Exception("Expected a type list with at least one type variable");
            if (types.Count == 1)
            {
                if (types[0] is TypeVariable) return types[0];
                throw new Exception("Expected a row variable in the final position");
            }
            return TypeArrayOf(types[0], RowPolymorphicList(types.Skip(1).ToList()));
        }

        public static TypeArray RowPolymorphicFunction(List<Type> inputs, List<Type> outputs)
        {
            var row = TypeVar("_");
            inputs.Add(row);
            outputs.Add(row);
            return FunctionType(RowPolymorphicList(inputs), RowPolymorphicList(outputs));
        }

        // --- pretty printing -----------------------------------------------------

        private static List<Type> FlattenFunctionIO(Type t) =>
            t is TypeArray a ? new List<Type> { a.Types[0] }.Concat(FlattenFunctionIO(a.Types[1])).ToList()
                             : new List<Type> { t };

        public static string TypeToString(Type t)
        {
            if (IsFunctionType(t))
            {
                var inp = string.Join(" ", FlattenFunctionIO(FunctionInput(t)).Select(TypeToString));
                var outp = string.Join(" ", FlattenFunctionIO(FunctionOutput(t)).Select(TypeToString));
                return "(" + inp + " -> " + outp + ")";
            }
            return t switch
            {
                TypeVariable v => v.Name,
                TypeConstant c => c.Name,
                TypeArray a => "[" + string.Join(" ", a.Types.Select(TypeToString)) + "]",
                _ => throw new Exception("unreachable")
            };
        }
    }
}
