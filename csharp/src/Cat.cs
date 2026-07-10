using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace TypeInference
{
    // ============================================================================
    //  Port of cat-types.ts + cat-library.ts + the parts of cat-parser.ts needed
    //  to type pure-Cat terms (identifiers, integers, booleans, quotations).
    // ============================================================================

    public abstract class CatTerm { }

    public sealed class CatWord : CatTerm
    {
        public readonly string Name;
        public CatWord(string name) { Name = name; }
        public override string ToString() => Name;
    }

    public sealed class CatInt : CatTerm
    {
        public readonly int Value;
        public CatInt(int v) { Value = v; }
        public override string ToString() => Value.ToString();
    }

    public sealed class CatBool : CatTerm
    {
        public readonly bool Value;
        public CatBool(bool v) { Value = v; }
        public override string ToString() => Value ? "true" : "false";
    }

    public sealed class CatQuote : CatTerm
    {
        public readonly List<CatTerm> Terms;
        public CatQuote(List<CatTerm> terms) { Terms = terms; }
        public override string ToString() => "[" + string.Join(" ", Terms) + "]";
    }

    /// <summary>A tiny tokenizer + recursive-descent parser for pure Cat terms.</summary>
    public static class CatParser
    {
        public static List<CatTerm> Parse(string s)
        {
            var toks = Tokenize(s);
            var pos = 0;
            var terms = ParseTerms(toks, ref pos);
            if (pos != toks.Count)
                throw new Exception("Unexpected ']' or trailing input in: " + s);
            return terms;
        }

        private static List<CatTerm> ParseTerms(List<string> toks, ref int pos)
        {
            var r = new List<CatTerm>();
            while (pos < toks.Count && toks[pos] != "]")
            {
                if (toks[pos] == "[")
                {
                    pos++; // consume '['
                    var inner = ParseTerms(toks, ref pos);
                    if (pos >= toks.Count || toks[pos] != "]")
                        throw new Exception("Unclosed quotation");
                    pos++; // consume ']'
                    r.Add(new CatQuote(inner));
                }
                else
                {
                    r.Add(ParseWord(toks[pos]));
                    pos++;
                }
            }
            return r;
        }

        private static CatTerm ParseWord(string w)
        {
            if (w == "true") return new CatBool(true);
            if (w == "false") return new CatBool(false);
            if (w.Length > 0 && (char.IsDigit(w[0]) || (w[0] == '-' && w.Length > 1 && char.IsDigit(w[1]))))
            {
                if (int.TryParse(w, out var n)) return new CatInt(n);
            }
            return new CatWord(w);
        }

        private static List<string> Tokenize(string s)
        {
            var toks = new List<string>();
            var i = 0;
            while (i < s.Length)
            {
                var c = s[i];
                if (char.IsWhiteSpace(c)) { i++; continue; }
                if (c == '[' || c == ']') { toks.Add(c.ToString()); i++; continue; }
                var sb = new StringBuilder();
                while (i < s.Length && !char.IsWhiteSpace(s[i]) && s[i] != '[' && s[i] != ']')
                    sb.Append(s[i++]);
                toks.Add(sb.ToString());
            }
            return toks;
        }
    }

    /// <summary>The Cat vocabulary and the top-level type-inference entry point.</summary>
    public static class Cat
    {
        /// <summary>The primitive Cat types, in source order.</summary>
        public static readonly (string Op, string Type)[] CoreTypes =
        {
            ("apply",   "((('a -> 'b) 'a) -> 'b)"),
            ("call",    "(((('a 's) -> ('b 's)) ('a 's)) -> ('b 's))"),
            ("compose", "((('b -> 'c) (('a -> 'b) 'd)) -> (('a -> 'c) 'd))"),
            ("quote",   "(('a 'b) -> (('c -> ('a 'c)) 'b))"),
            ("dup",     "(('a 'b) -> ('a ('a 'b)))"),
            ("swap",    "(('a ('b 'c)) -> ('b ('a 'c)))"),
            ("pop",     "(('a 'b) -> 'b)"),
            ("id",      "('a -> 'a)"),
        };

        /// <summary>Standard library ops, in source order (each defined via earlier ones).</summary>
        public static readonly (string Op, string Def)[] StdOps =
        {
            ("papply",   "swap quote swap compose"),
            ("dip",      "swap quote compose apply"),
            ("dipd",     "swap [dip] dip"),
            ("popd",     "[pop] dip"),
            ("pop2",     "pop pop"),
            ("pop3",     "pop pop pop"),
            ("dupd",     "[dup] dip"),
            ("dupdd",    "[dup] dipd"),
            ("swapd",    "[swap] dip"),
            ("swapdd",   "[swap] dipd"),
            ("rollup",   "swap swapd"),
            ("rolldown", "swapd swap"),
            ("dup3",     "dup dup"),
            ("dup4",     "dup3 dup"),
            ("dup5",     "dup4 dup"),
            ("dup6",     "dup5 dup"),
            ("dup7",     "dup6 dup"),
            ("dup8",     "dup7 dup"),
            ("test",     "dup [[0] dip apply []] dip"),
        };

        /// <summary>
        /// Experiment hook. `false` (default) reproduces the original engine, which folds
        /// composition from the RIGHT (`composeFunctionChainReverse`) — typing suffixes in
        /// isolation. `true` folds in evaluation order from the LEFT, threading the concrete
        /// stack type through each op. See RootCauseTests.
        /// </summary>
        public static bool UseLeftFold = false;

        /// <summary>
        /// Experiment hook (default false). When true, the engine produces and consumes real
        /// equirecursive μ-types instead of the positional `(rec N)` marker (see Equirecursive.cs).
        /// </summary>
        public static bool Equirecursive
        {
            get => Unifier.EquirecursiveDefault;
            set => Unifier.EquirecursiveDefault = value;
        }

        private static TypeArray Compose(System.Collections.Generic.IReadOnlyList<TypeArray> fxns) =>
            UseLeftFold ? TypeOps.ComposeFunctionChain(fxns) : TypeOps.ComposeFunctionChainReverse(fxns);

        private static Dictionary<string, Type> _vocab;
        private static readonly object _lock = new object();

        public static IReadOnlyDictionary<string, Type> Vocabulary
        {
            get { EnsureInit(); return _vocab; }
        }

        /// <summary>Drop the cached vocabulary so it is rebuilt on next use. Used by
        /// experiments that rebuild the whole engine under a different configuration
        /// (e.g. the corrected substitution).</summary>
        public static void ResetVocabulary()
        {
            lock (_lock) { _vocab = null; }
        }

        private static void EnsureInit()
        {
            if (_vocab != null) return;
            lock (_lock)
            {
                if (_vocab != null) return;
                var vocab = new Dictionary<string, Type>();
                foreach (var (op, type) in CoreTypes)
                    vocab[op] = TypeParser.Parse(type);
                // Std ops are inferred from earlier definitions, so order matters.
                foreach (var (op, def) in StdOps)
                    vocab[op] = InferWith(vocab, def);
                _vocab = vocab;
            }
        }

        /// <summary>Infer a Cat term's type. Resets the recursion guard (top-level entry).</summary>
        public static TypeArray Infer(string term)
        {
            Guard.Reset();
            EnsureInit();
            return InferWith(_vocab, term);
        }

        /// <summary>Infer, then normalize variable names to t0..tN for stable comparison.</summary>
        public static string InferNormalized(string term) =>
            TypeOps.NormalizeVarNames(Infer(term)).ToString();

        private static TypeArray InferWith(IReadOnlyDictionary<string, Type> vocab, string term)
        {
            var terms = CatParser.Parse(term);
            return Compose(terms.Select(t => InferTerm(vocab, t)).ToList());
        }

        private static TypeArray InferTerm(IReadOnlyDictionary<string, Type> vocab, CatTerm term)
        {
            switch (term)
            {
                case CatInt:
                    return TypeOps.Quotation(TypeOps.TypeConst("Num"));
                case CatBool:
                    return TypeOps.Quotation(TypeOps.TypeConst("Bool"));
                case CatWord w:
                    if (!vocab.TryGetValue(w.Name, out var t))
                        throw new Exception("Could not find type for term: " + w.Name);
                    return (TypeArray)t;
                case CatQuote q:
                {
                    var inner = Compose(q.Terms.Select(x => InferTerm(vocab, x)).ToList());
                    return TypeOps.Quotation(inner);
                }
                default:
                    throw new Exception("Unrecognized Cat term");
            }
        }
    }
}
