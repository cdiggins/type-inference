# type-inference-csharp

A faithful C# re-implementation of Christopher Diggins's higher-rank type-inference
algorithm (`github.com/cdiggins/type-inference`, `type-system.ts`), plus an NUnit
experiment suite that evaluates its claims, soundness, and bugs.

**Read [`FINDINGS.md`](FINDINGS.md) for the full evaluation.** This README covers the one
idea worth taking away, plus how to run the code and how it is laid out.

## The contribution, in plain terms

Some type systems let you store a *polymorphic* function — one that works for any type —
inside a data structure and pass it around like any other value. Types that do this are
called **higher-rank**. The catch is that figuring them out for you automatically, with no
type annotations, is in general impossible: the underlying problem is undecidable, which is
why a language like Haskell makes you write these types out by hand once they get
complicated enough.

This algorithm gets higher-rank types **automatically, with no annotations**, for a
*concatenative* (stack-based) language. It does it with one change of representation and one
placement rule:

* **Represent the program as function composition.** In a concatenative language every word
  is just a function that transforms the stack, and a whole program is those functions
  composed together. Type-checking is then boring and mechanical: line up each function's
  outputs with the next one's inputs and unify them — ordinary first-order unification, the
  same decidable workhorse that powers Hindley–Milner.
* **Place each `∀` where the variable actually lives.** Standard inference *generalizes*: it
  drags every `∀` ("for all types…") to the very front of the type. That flattening is
  exactly what pins you to rank-1. This algorithm does the opposite. After unification it
  looks at *where* each type variable ended up in the type tree and binds its `∀` at the
  **smallest sub-expression that still contains all of its uses**. A variable that lives
  entirely inside one quoted sub-program keeps its `∀` nested *there* — and a `∀` nested
  under an arrow is precisely what a higher-rank type is. A variable shared across siblings
  floats up on its own.

**Why this dodges the impossibility result.** The genuinely hard, undecidable part of
higher-rank inference is *guessing* where to specialize a polymorphic type. This algorithm
never guesses. It only ever does plain unification and then **reads off** the quantifier
positions from where the variables already sit. It does only the decidable part — and the
concatenative encoding is what makes the higher-rank structure show up in the syntax on its
own, so the guessing step is never needed. That co-design (the encoding makes the placement
possible) is the real idea.

**The showcase.** `quote dup` — wrap a value into a little one-line program, then duplicate
it — infers two *independent* polymorphic functions sitting side by side on the stack, each
with its own `∀`:

```
quote dup : !t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))
                                 └── ∀t2 ──────────┘ └── ∀t3 ──────────┘
```

Those two quotations are the same shape but bind *different* variables (`t2` vs `t3`). That
is **first-class polymorphism**: two differently-quantified polymorphic values held in one
data structure. Hindley–Milner cannot express this at all — `dup` copies a single monotype,
so its two copies are forced to share one variable, and the program breaks the moment you try
to use the copies at different types.

**Honest scope.** This is *not* a general higher-rank inferencer for a whole language. It is
correct-by-construction on the concatenative fragment it targets, and it is a research
prototype with real soundness gaps (no occurs check; some terms throw — see
[`FINDINGS.md`](FINDINGS.md) §6). The value is the *idea* — that the right encoding turns an
undecidable inference problem into a syntactic reading-off — not a production type checker.

## The contribution, for the technically inclined

**Setting.** Take a concatenative core in the Joy/Cat family: programs are compositions of
stack-to-stack functions, quotation `[·]` reifies a program as a first-class value on the
stack, and `apply` runs one. Types are first-order terms over ordinary constructors (`->`,
list, `Num`, …) plus an associative stack/row spine whose tail is a row variable, giving
*stack polymorphism* (the `S` in schemes like `!a!S. …`). None of this layer is new: stack-
effect typing goes back to Stoddart & Knaggs [8]; the concatenative-combinator account is
Kerby [7]; the Cat typing is Diggins [10]; the row-variable technique is Wand/Rémy [9].

**Inference by composition.** Each word denotes a function type; a program `w₁ … wₙ` is typed
by folding `composeFunctions` across the sequence. To compose `f : A→B` with `g : C→D`: take
fresh instances, unify `B` with `C` by ordinary syntactic (Robinson) first-order unification,
and reconstruct `A′→D′` under the resulting substitution
([`TypeOps.ComposeFunctions`](src/TypeOps.cs)). Crucially, **no Damas–Milner
generalize/instantiate step appears in the composition loop** [6].

**The novel step — positional quantifier placement.** In place of prenex generalization
(which lifts every `∀` to the outermost scheme and thereby forces shallow, rank-1 schemes),
the algorithm runs `computeParameters` after unification
([`TypeArray.ComputeParameters`](src/Types.cs)). It is a single bottom-up pass that binds
each type variable `v` at the **least (innermost) node whose subtree contains every
occurrence of `v`** — i.e. the lowest common ancestor of `v`'s occurrences. Operationally:
recurse into children first; a variable confined to one child is bound in that child; a
variable whose occurrences straddle two or more sibling subtrees is reassigned upward to
their common parent. Because a `∀` can thus come to rest *strictly beneath* a `->`
constructor, the inferred scheme is in general **rank ≥ 2**, and when independent binders
land in distinct sibling slots of a stack/product, the result exhibits **first-class
(impredicative) polymorphism** [5].

**Why it stays decidable while general rank-N does not.** Typability in System F is
undecidable (Wells [1]); practical inference is undecidable above rank 2, which is exactly
why GHC-style arbitrary-rank systems demand programmer annotations to direct impredicative
instantiation (Odersky & Läufer [2]; Peyton Jones et al. [3]), rank 2 being the decidable
boundary (Kfoury & Wells [4]). The undecidable content is the **search for impredicative
instantiations** — deciding where to specialize one `∀`-type to another. This algorithm never
performs that search. Composition uses only first-order unification (decidable, and it yields
principal solutions), and `computeParameters` is a deterministic, linear-time *placement* that
**reads off** quantifier scope from the already-computed term rather than *inferring* an
instantiation. Rank-N structure is not synthesized by guessing; it is made **syntactically
manifest** by the encoding — quotation is an explicit sub-term boundary — and placement merely
names the binder that sits at that boundary. Decidability is therefore bought *by
construction*: only the decidable sub-problem is ever solved, and the encoding guarantees that
is sufficient for the fragment.

**Worked witness.** `quote dup` infers
`!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))`
([`HigherRankClaimTests`](tests/HigherRankClaimTests.cs)). The output stack carries two
alpha-equivalent quotations bound by **distinct** variables `t2`, `t3` — two independently
quantified polymorphic functions stored side by side, i.e. first-class polymorphism (cf.
Jones [5]). Prenex HM cannot represent this: `dup` copies a single monotype, so both copies
must share one top-level binder; the two `∀`s collapse to one and the term is rejected on use
by the occurs check, as the reference GHCi session confirms.

**Scope and honest limits.** What is established is a *correctness-by-construction* property
on the concatenative image, not a decision procedure for System-F typability; the placement
rule is sound for the fragment it targets but is not a general higher-rank inferencer. The
prototype also carries soundness gaps that are **orthogonal** to the placement idea and are
documented in [`FINDINGS.md`](FINDINGS.md): no occurs check (recursive unificands surface as
invalid `(rec N)` markers rather than errors), partiality (some terms throw), and — in the
original — constant-clash fusion into sum types (removed in this port). The contribution is
the placement idea, not the surrounding engineering.

### References

1. J. B. Wells. *Typability and type checking in System F are equivalent and undecidable.*
   Annals of Pure and Applied Logic, 98(1–3):111–156, 1999.
2. M. Odersky and K. Läufer. *Putting type annotations to work.* POPL '96, pp. 54–67.
3. S. Peyton Jones, D. Vytiniotis, S. Weirich, M. Shields. *Practical type inference for
   arbitrary-rank types.* Journal of Functional Programming, 17(1):1–82, 2007.
4. A. J. Kfoury and J. B. Wells. *A direct algorithm for type inference in the rank-2
   fragment of the second-order λ-calculus.* LFP '94, pp. 196–207.
5. M. P. Jones. *First-class polymorphism with type inference.* POPL '97, pp. 483–496.
6. L. Damas and R. Milner. *Principal type-schemes for functional programs.* POPL '82,
   pp. 207–212. (The prenex generalize/instantiate discipline this algorithm departs from;
   foundations in Hindley 1969 and Milner 1978.)
7. B. Kerby. *The Theory of Concatenative Combinators.* 2002.
8. B. Stoddart and P. J. Knaggs. *Type inference in stack based languages.* Formal Aspects
   of Computing, 5(4):289–298, 1993.
9. M. Wand. *Complete type inference for simple objects.* LICS '87. (Row variables; see also
   D. Rémy, *Type checking records and variants in a natural extension of ML*, POPL '89.)
10. C. Diggins. *Type inference for the Cat language* and related tech reports, 2008;
    source algorithm at `github.com/cdiggins/type-inference` (`type-system.ts`).

## Run

```bash
dotnet test
```

284 tests. No test can hang or crash the runner: every potentially
dangerous computation runs inside a recursion/step **Guard** on a threaded **Sandbox**
with a wall-clock timeout, so infinite recursion, stack overflow, and infinite loops all
become fast, catchable results.

## Layout

```
src/
  Types.cs        Type / TypeArray / TypeVariable / TypeConstant  (port of type-system.ts)
  Unifier.cs      unification + getUnifiedType   (incl. the faithful `_replaceVarWithType` bug)
  TypeOps.cs      helpers, computeParameters support, composeFunctions, quotation, normalize
  TypeParser.cs   recursive-descent parser for  ('a -> 'b)  type syntax
  Cat.cs          the Cat vocabulary + inferCatType  (port of cat-types/cat-library/cat-parser)
  Guard.cs        per-thread depth+step budget -> GuardException
  Sandbox.cs      run on a big-stack worker thread with a timeout
  RecursiveTypes.cs  equi-recursive (μ-type) coinductive fold/unfold unifier (divergence)
  Equirecursive.cs   μ-type nodes + the engine integration (produce/consume behind a flag)
tests/
  FidelityTests.cs          reproduces 76 canonical outputs from the original node run
  HigherRankClaimTests.cs   the rank-N claim, and the stale README example
  RootCauseTests.cs         why `quote dup apply` was wrong; the left-fold fix
  SoundnessTests.cs         constant clashes are now rejected (sum types removed)
  RecursionTests.cs         no occurs check; (rec N) markers; the issue-#1 throw
  ReplaceBugTests.cs        the two entangled substitution/clone bugs
  AlgebraicLawTests.cs      equivalences, identities, [X] apply == X, associativity
  ComputeParametersTests.cs the novel quantifier-placement core, on hand-built types
  ParserTests.cs            type parser + Cat parser, round-trips and error cases
  UnifierTests.cs           direct unification (vars, constants, functions, cycles)
  ValidityTests.cs          isValid rules and polytype predicates
  RobustnessTests.cs        normalization / cloning invariants, determinism
  LiteralTests.cs           numbers, booleans, distinct constants on the stack
  RecursiveUnifierTests.cs  the coinductive μ-type fold/unfold unifier
  EquirecursiveIntegrationTests.cs  end-to-end μ production/consumption in the engine
  PropertyTests.cs          semantic identities + determinism
  TerminationTests.cs       proves the Guard/Sandbox safety harness works
```

## Deviations from the faithful port

Three behaviors intentionally differ from the original `type-system.ts`, by request:

* **Sum types removed.** A constant/constructor clash throws `UnificationError` instead of
  fusing into `(| ...)`. Affects only ill-typed terms; the whole FidelityTests corpus is
  unchanged.
* **Left-fold available** via `Cat.UseLeftFold` (default off) — types in evaluation order,
  which fixes `quote dup apply` (see `RootCauseTests`).
* **Equi-recursive μ-types (now the default)** — the positional `(rec N)` marker is retired.
  Recursion is a first-class type the unifier can produce (occurs situation ⇒ `μ`) and consume
  (unfold + a memo set). `src/RecursiveTypes.cs` is the self-contained coinductive core (with the
  full algorithm, decidability argument, and references); `src/Equirecursive.cs` wires it into the
  engine, so end-to-end inference emits `μ` at reconstruction and consumes it in later compositions.
  `dup apply` infers the valid recursive type `!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)` instead of
  the old invalid `(rec 1)` — see `EquirecursiveIntegrationTests`.

## Faithfulness

`FidelityTests` pins the port to output captured from the author's own
`node build/test.js`: the 60-term `catTests`, the standard-library vocabulary, and the
`(rec N)` / throwing edge cases. Places where the original does something surprising —
sum-type fusion, no occurs check, the `{varName: replace}` substitution bug — are ported
exactly and flagged with `// NOTE` / `// FAITHFUL-BUG` comments so the experiments measure
the real algorithm.

## Toggles used by experiments

* `Unifier.UseFixedReplaceDefault` — swap the buggy `_replaceVarWithType` for the corrected
  one (used by `ReplaceBugTests` to show the bug is load-bearing).
* `Cat.UseLeftFold` — fold composition in evaluation order (fixes `quote dup apply`).
* `Cat.ResetVocabulary()` — rebuild the vocabulary under a changed configuration.
