using System;
using System.Collections.Generic;
using System.Text;

namespace TypeInference
{
    /// <summary>
    /// Hand-written recursive-descent parser for the type-expression syntax used by
    /// type-parser.ts. Grammar:
    ///   typeExpr     = typeList | typeVar | typeConstant
    ///   typeList     = '(' ws (typeExpr ws)* ')'
    ///   typeVar      = "'" identifier
    ///   typeConstant = identifier | digits | "->" | "*" | "[]"
    /// Parsed lists are built with ComputeParameters=true, exactly like the original.
    /// </summary>
    public static class TypeParser
    {
        public static Type Parse(string input)
        {
            var p = new Cursor(input);
            p.SkipWs();
            var t = ParseExpr(p);
            p.SkipWs();
            if (!p.AtEnd)
                throw new Exception("Only part of input was consumed at position " + p.Pos + " of: " + input);
            return t;
        }

        private static Type ParseExpr(Cursor p)
        {
            p.SkipWs();
            if (p.AtEnd) throw new Exception("Unexpected end of type input");

            var c = p.Peek();
            if (c == '(') return ParseList(p);
            if (c == '\'') return ParseVar(p);
            return ParseConstant(p);
        }

        private static Type ParseList(Cursor p)
        {
            p.Expect('(');
            var items = new List<Type>();
            p.SkipWs();
            while (!p.AtEnd && p.Peek() != ')')
            {
                items.Add(ParseExpr(p));
                p.SkipWs();
            }
            p.Expect(')');
            return TypeOps.TypeArrayOf(items);
        }

        private static Type ParseVar(Cursor p)
        {
            p.Expect('\'');
            var name = p.ReadIdentifier();
            if (name.Length == 0) throw new Exception("Expected identifier after ' at position " + p.Pos);
            return TypeOps.TypeVar(name);
        }

        private static Type ParseConstant(Cursor p)
        {
            // "->", "*", "[]" symbolic constants, else identifier or digits.
            if (p.StartsWith("->")) { p.Advance(2); return TypeOps.TypeConst("->"); }
            if (p.StartsWith("[]")) { p.Advance(2); return TypeOps.TypeConst("[]"); }
            if (p.Peek() == '*') { p.Advance(1); return TypeOps.TypeConst("*"); }

            var s = p.ReadConstantWord();
            if (s.Length == 0)
                throw new Exception("Unexpected character '" + p.Peek() + "' at position " + p.Pos);
            return TypeOps.TypeConst(s);
        }

        private sealed class Cursor
        {
            private readonly string _s;
            public int Pos;
            public Cursor(string s) { _s = s; Pos = 0; }

            public bool AtEnd => Pos >= _s.Length;
            public char Peek() => _s[Pos];
            public void Advance(int n = 1) => Pos += n;

            public bool StartsWith(string t) =>
                Pos + t.Length <= _s.Length && _s.Substring(Pos, t.Length) == t;

            public void Expect(char c)
            {
                if (AtEnd || _s[Pos] != c)
                    throw new Exception($"Expected '{c}' at position {Pos} of: {_s}");
                Pos++;
            }

            public void SkipWs()
            {
                while (!AtEnd && char.IsWhiteSpace(_s[Pos])) Pos++;
            }

            public string ReadIdentifier()
            {
                var sb = new StringBuilder();
                if (!AtEnd && (char.IsLetter(_s[Pos]) || _s[Pos] == '_'))
                {
                    sb.Append(_s[Pos++]);
                    while (!AtEnd && (char.IsLetterOrDigit(_s[Pos]) || _s[Pos] == '_'))
                        sb.Append(_s[Pos++]);
                }
                return sb.ToString();
            }

            /// <summary>Read an identifier or a run of digits (a numeric type constant).</summary>
            public string ReadConstantWord()
            {
                var sb = new StringBuilder();
                while (!AtEnd && (char.IsLetterOrDigit(_s[Pos]) || _s[Pos] == '_'))
                    sb.Append(_s[Pos++]);
                return sb.ToString();
            }
        }
    }
}
