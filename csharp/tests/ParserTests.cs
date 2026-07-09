using System;
using System.Linq;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Tests for the two hand-written parsers. Round-tripping the primitive type strings
    /// through parse + computeParameters + toString is a strong end-to-end check of the
    /// quantifier placement, and the error cases document the accepted grammar.
    /// </summary>
    [TestFixture]
    public class ParserTests
    {
        // ---- type parser: the 8 primitive types print with the expected ∀ placement ----
        // Expected strings captured from the author's own `node build/test.js`.
        [TestCase("((('a -> 'b) 'a) -> 'b)", "!b.(!a.((a -> b) a) -> b)")]
        [TestCase("(((('a 's) -> ('b 's)) ('a 's)) -> ('b 's))", "!b!s.(!a.(((a s) -> (b s)) (a s)) -> (b s))")]
        [TestCase("((('b -> 'c) (('a -> 'b) 'd)) -> (('a -> 'c) 'd))", "!a!c!d.(!b.((b -> c) ((a -> b) d)) -> ((a -> c) d))")]
        [TestCase("(('a 'b) -> (('c -> ('a 'c)) 'b))", "!a!b.((a b) -> (!c.(c -> (a c)) b))")]
        [TestCase("(('a 'b) -> ('a ('a 'b)))", "!a!b.((a b) -> (a (a b)))")]
        [TestCase("(('a ('b 'c)) -> ('b ('a 'c)))", "!a!b!c.((a (b c)) -> (b (a c)))")]
        [TestCase("(('a 'b) -> 'b)", "!b.(!a.(a b) -> b)")]
        [TestCase("('a -> 'a)", "!a.(a -> a)")]
        public void Type_parser_round_trips_with_quantifier_placement(string input, string expected)
        {
            var r = Sandbox.Run(() => TypeParser.Parse(input).ToString());
            Assert.That(r.IsOk, Is.True, r.ToString());
            Assert.That(r.Value, Is.EqualTo(expected));
        }

        [TestCase("'a")]
        [TestCase("Num")]
        [TestCase("[]")]
        [TestCase("->")]
        [TestCase("()")]
        [TestCase("('a 'b)")]
        [TestCase("(Num ('a []))")]
        public void Type_parser_accepts_valid_expressions(string input)
        {
            var r = Sandbox.Run(() => TypeParser.Parse(input));
            Assert.That(r.IsOk, Is.True, $"'{input}': {r}");
        }

        [TestCase("(")]            // unbalanced
        [TestCase(")")]            // stray close
        [TestCase("(Num")]         // unclosed
        [TestCase("Num Bool")]     // trailing content not consumed
        [TestCase("")]             // empty
        [TestCase("'")]            // apostrophe without identifier
        public void Type_parser_rejects_malformed_input(string input)
        {
            var r = Sandbox.Run(() => TypeParser.Parse(input));
            Assert.That(r.IsFaulted, Is.True, $"'{input}' should have been rejected, got {r}");
        }

        [Test]
        public void Type_parser_produces_the_right_node_kinds()
        {
            Assert.That(TypeParser.Parse("'a"), Is.TypeOf<TypeVariable>());
            Assert.That(TypeParser.Parse("Num"), Is.TypeOf<TypeConstant>());
            Assert.That(TypeParser.Parse("('a 'b)"), Is.TypeOf<TypeArray>());
            var arr = (TypeArray)TypeParser.Parse("('a Num [])");
            Assert.That(arr.Types.Count, Is.EqualTo(3));
        }

        // ---- cat parser --------------------------------------------------------------

        [Test]
        public void Cat_parser_reads_words_ints_and_bools()
        {
            var terms = CatParser.Parse("dup 0 true false swap");
            Assert.That(terms.Count, Is.EqualTo(5));
            Assert.That(terms[0], Is.TypeOf<CatWord>());
            Assert.That(terms[1], Is.TypeOf<CatInt>());
            Assert.That(terms[2], Is.TypeOf<CatBool>());
            Assert.That(terms[3], Is.TypeOf<CatBool>());
            Assert.That(((CatInt)terms[1]).Value, Is.EqualTo(0));
        }

        [Test]
        public void Cat_parser_handles_nested_quotations()
        {
            var terms = CatParser.Parse("[[dup] swap]");
            Assert.That(terms.Count, Is.EqualTo(1));
            var outer = (CatQuote)terms[0];
            Assert.That(outer.Terms.Count, Is.EqualTo(2));
            Assert.That(outer.Terms[0], Is.TypeOf<CatQuote>());
            Assert.That(outer.Terms[1], Is.TypeOf<CatWord>());
        }

        [Test]
        public void Cat_parser_is_insensitive_to_surrounding_and_bracket_whitespace()
        {
            var a = CatParser.Parse("  [ dup   swap ]  ");
            var b = CatParser.Parse("[dup swap]");
            Assert.That(a.Count, Is.EqualTo(b.Count));
            Assert.That(((CatQuote)a[0]).Terms.Count, Is.EqualTo(2));
        }

        [TestCase("[dup")]      // unclosed quotation
        [TestCase("dup]")]      // stray close
        [TestCase("[[dup]")]    // unbalanced nesting
        public void Cat_parser_rejects_unbalanced_brackets(string input)
        {
            Assert.That(() => CatParser.Parse(input), Throws.Exception);
        }

        [Test]
        public void Empty_and_whitespace_cat_input_parses_to_no_terms()
        {
            Assert.That(CatParser.Parse("").Count, Is.EqualTo(0));
            Assert.That(CatParser.Parse("   ").Count, Is.EqualTo(0));
            Assert.That(CatParser.Parse("[]").Count, Is.EqualTo(1)); // one empty quotation
            Assert.That(((CatQuote)CatParser.Parse("[]")[0]).Terms.Count, Is.EqualTo(0));
        }
    }
}
