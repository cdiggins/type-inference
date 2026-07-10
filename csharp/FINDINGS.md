# Evaluation: Diggins Type-Inference for Higher-Rank Polymorphic Types

An assessment of the algorithm in `github.com/cdiggins/type-inference` (the TypeScript
`type-system.ts` + Cat glue), backed by a faithful C# re-implementation and 106 NUnit
experiments. Every claim below is tied to a runnable test.

> **Method.** `src/` is a line-by-line port of `type-system.ts`, including its bugs (flagged
> `// FAITHFUL-BUG`). `FidelityTests` reproduces **all 76** canonical outputs captured from
> the author's own `node build/test.js`, so the experiments measure the *real* algorithm, not
> a reinterpretation. Everything runs inside a depth+step **Guard** and a threaded **Sandbox**
> so divergence, stack overflow, and infinite loops become fast, catchable results
> (`TerminationTests`). Full suite: ~0.8 s.

---

## 1. TL;DR verdict

| Dimension | Verdict |
|---|---|
| **Viability** | Works and terminates on the concatenative fragment it targets. Fast. Partial: some terms throw, some yield invalid `(rec N)` "types". |
| **Novelty** | The stack/row-polymorphic typing is standard (Kerby; Diggins 2008). The genuinely interesting idea is **positional `∀`-placement** (`computeParameters`) that yields rank-N types *with no annotations and no guessing* — sidestepping the undecidability that blocks HM-style rank-N inference. Narrow but real. |
| **Correctness (as a checker)** | Originally **unsound**: it never rejected a clash (mismatched constants fused into sum types), has **no occurs check** (cycles become post-hoc `(rec N)` markers), and is partial (raw throws). The port has since **removed sum types** (a clash is now a real error); the occurs-check and partiality issues remain. |
| **Headline strength** | Real: `quote dup` gets two *independent* nested `∀`s — genuinely beyond prenex HM. |
| **Headline caveat** | The README's own next example (`quote dup apply`) is **stale**: it claims `(t0 (t0 t1))`; the shipped engine produces the invalid `(t0 ((rec 1) t1))`. |

---

## 2. What the algorithm actually is

Types are `TypeConstant` (Num, `->`, `[]`), `TypeVariable`, or `TypeArray` (a tuple that also
encodes functions/stacks/lists). A Cat program is typed by treating every word as a function
over the stack and **composing** them (`composeFunctions`), where composition = unify *f*'s
output with *g*'s input, then reconstruct.

The one non-standard move is quantifier placement. HM **generalizes to prenex form** (all `∀`
lifted to the top). This algorithm instead runs `computeParameters()` *after* unification: each
variable is bound at the **innermost `TypeArray` that contains all of its occurrences**. A
variable used inside a single sub-quotation stays bound *there*; one shared across siblings
floats up. That is what puts `∀`s underneath `->` (i.e. produces rank-2+ types) automatically.

---

## 3. Novelty — where it sits in the literature

* **Not novel:** typing stack languages with row/stack polymorphism (the `S` tail variable) is
  the established approach — Kerby's Joy typing, Diggins's own 2008 tech reports, the Northeastern
  concatenative bibliography. `pop/dup/swap` having `!a!S....` types is textbook for this family.
* **The interesting contribution:** *inferring* higher-rank types by **structural quantifier
  placement**. Full rank-N inference for System F is undecidable (Wells, 1999); practical languages
  (GHC) require annotations above rank-2. This algorithm never *guesses* an impredicative
  instantiation — it only ever **reads off** quantifier positions from where variables already sit
  after unification. Decidability is bought by only doing the part that is decidable. The
  concatenative encoding is what makes the rank-N structure *syntactically manifest*, so the hard
  guessing step is never needed. That co-design (encoding ⇒ placement) is the real idea, and it is
  a legitimately neat one.
* **Honest framing.** The README's "not proven for rank-N in all cases (open question)" is exactly
  right, and matches what the experiments show: it is a heuristic that is correct-by-construction
  on the concatenative image but is **not** a general System-F inferer.

---

## 4. The headline claim is TRUE — `HigherRankClaimTests`

`quote dup` infers:

```
!t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))
                     └── ∀t2 ──────────┘ └── ∀t3 ──────────┘
```

Two quotations sit on the output stack, each with **its own** quantifier (`t2` vs `t3`),
alpha-equivalent but independent (`QuoteDup_output_has_two_independent_rank2_quantifiers`,
`HM_would_link_the_two_quotations_this_system_does_not`). Precisely, this is **first-class
polymorphism**: two *differently-quantified* polymorphic functions stored side-by-side in a data
structure (the stack pair). HM cannot do this at all — you cannot put a `∀` inside a tuple in a
rank-1 system, and `dup` copies one *monotype*, so HM's two copies must share a single top-level
variable. That is exactly the collapse the README's GHCi session shows failing the occurs check on
`apply . quotedup`. (Contrast `apply : !b.(!a.((a -> b) a) -> b)`, which is higher-rank in the
ordinary rank-2 sense — a `∀` to the *left* of the arrow.) The `quote dup` type here is well-formed
(`IsValid` = true). **This is the system's best moment.**

---

## 5. The follow-through is broken — and BOTH the README and the engine are wrong (`RootCauseTests`)

The README then states:

> `quote dup apply : !t0!t1.((t0 t1) -> (t0 (t0 (t1)))` … "exactly the same type as for `dup`".

There are **two** separate errors.

**The expected answer is itself wrong.** Executed on a value `a`: `quote` makes `[a]`, `dup` copies
it, `apply` runs one copy → the stack is `[a] a`. Only ONE of the two quotations is applied; the
other survives. So the correct type leaves a quotation on the stack:
```
quote dup apply : !t0!t1.((t0 t1) -> (t0 (!t2.(t2 -> (t0 t2)) t1)))     // valid, rank-2
```
It is NOT `dup` (`(t0 (t0 t1))`) — the README's intuition ("same as dup") was mistaken.

**The engine's answer is also wrong** — it invents a spurious recursion:
```
quote dup apply : !t0!t1.((t0 t1) -> (t0 ((rec 1) t1)))                 // invalid: (rec 1)
```

**Root cause.** `inferCatType` composes with `composeFunctionChainReverse`, folding from the RIGHT:
it types the suffix `dup apply` in ISOLATION. But `dup apply` alone is `λx. x x` — genuine
self-application, which legitimately needs a recursive type. That spurious `(rec 1)` is then threaded
through the outer composition with `quote`.

**Fix (measured).** Type in evaluation order — fold from the LEFT (`composeFunctionChain`) — so
`apply` is composed against the concrete quotation `quote dup` already produced, never against a bare
self-referential variable. Under left-fold, `quote dup apply` yields the correct type above, and it
**regresses nothing**: across all 60 canonical `catTests` + std ops exactly two terms change — both
genuinely recursive (`quote dup apply` → correct; `quote dup apply apply` → still rec) — and
`dup apply` stays recursive under both folds (it really is self-application). It is a one-line change
(`composeFunctionChain` instead of `…Reverse`); toggle in the port: `Cat.UseLeftFold`.

---

## 6. Correctness / soundness problems

### 6.1 Mismatched constants fused into sum types — REMOVED — `SoundnessTests`
*Original behavior:* `unifyTypes(Num, Bool)` returned `(| (Num Bool))` instead of failing; likewise
`-> vs []`, `Num vs (a b)`. The engine therefore **never rejected** a program on a type clash — as
shipped on `master` it was not a sound type checker. It was reachable through the very same public
`composeFunctions` used by inference: `dup` feeding a consumer that uses the two copies at `Num` and
`Bool` fabricated `!t0.(((| (Num Bool)) t0) -> t0)` rather than reporting the conflict.

**Applied in this port (per design decision).** The sum types have been removed: a constant/
constructor clash now throws `UnificationError`. This changes behavior ONLY on ill-typed terms —
every well-typed term in the corpus is unaffected (the whole FidelityTests suite still passes),
because the stock vocabulary never forces two constants together. See §10 for the rationale (the
one reachable case was actually a *conflict*, i.e. an empty meet, mislabeled as a union). `dup apply`
still yields `(rec 1)`: removing sums is orthogonal to the missing occurs check.

### 6.2 No occurs check; cycles are patched post-hoc — `RecursionTests`
Unification omits the occurs check. `unify(a, (a b))` succeeds; the cycle is only noticed when the
result is *reconstructed*, emitting `(rec N)`. `dup apply` →
`!t1.(!t0.((((rec 1) t0) -> t1) t0) -> t1)`. These `(rec N)` forms are declared invalid *after the
fact* by `isValid`. So an "inferred type" may be a non-type; validity is a separate downstream
check the caller must remember to run.

*Could `(rec N)` be a valid (equirecursive/μ) type instead?* In principle yes — unification without
an occurs check IS rational-tree/equirecursive unification, so the engine already computes the
recursive type; only the `isValid` label rejects it. But not with this encoding (`RecursiveTypeTests`):
`N` counts reconstruction steps, not tree nodes, so the μ-binder is not recoverable from the printed
type (two `(rec 0)` in one type sit at tree depths 2 and 3); `N` is not even stable (`ReplaceBugTests`
flips it 1↔0); and the unifier cannot *consume* a rec marker — it treats `(rec N)` as a dumb 2-array,
silently absorbing concrete types, crashing on arity mismatch, and equating distinct recursion levels.
Making rec a real type needs explicit μ-binders + fold/unfold unification, not a flag flip.

**Implemented (this port): a coinductive equi-recursive unifier** — `src/RecursiveTypes.cs`,
tested in `RecursiveUnifierTests`. It represents recursion with an explicit `μX.T` binder and
unifies with the standard fold/unfold + memo-set (coinductive) algorithm, so recursion is a
first-class type the unifier can both *produce* (the occurs check introduces `a := μa.T`) and
*consume* (unfold on demand, terminate via the assumption set). It decides the worked example
`μX.(Num→X) ≡ μY.(Num→(Num→Y))`, honors the fold/unfold law `μX.T ≡ T[X:=μX.T]`, and gives the
correct answer on the exact cases the positional `(rec N)` botched — see the module header for the
full algorithm, decidability argument (regular trees ⇒ finitely many pairs), and references
(Amadio–Cardelli; Brandt–Henglein).

**And now wired into the engine** — `src/Equirecursive.cs`, tested in
`EquirecursiveIntegrationTests`. With `Cat.Equirecursive` on, `GetUnifiedType` emits an explicit
`μ`-binder (named back-reference) at the recursion point instead of the positional `(rec N)`, and
`UnifyTypes` folds/unfolds `μ` with a per-unifier memo set so a recursive type flowing into a later
composition is consumed rather than mangled. `computeParameters`/`descendantTypes`/`normalizeVarNames`
treat `μ` as a transparent wrapper (and never ∀-quantify a recursion variable). Result: `dup apply`
now infers the **valid** recursive type `!t1.(!t0.(μr0.((r0 t0) -> t1) t0) -> t1)` (the type of
`λx.x x`) instead of the invalid `(rec 1)`, `quote dup apply` becomes a valid nested-`μ` type, and the
issue-#1 term no longer throws the spurious "differently sized lists" (the `μ` is unfolded; what
remains is the genuine clash). The flag is off by default, so the whole FidelityTests corpus is
unchanged.

### 6.3 Partiality — raw exceptions
Some terms neither type nor produce `(rec N)` — they throw. The reported issue #1 term
`[id] dup 0 swap apply swap [id] swap apply apply` throws **"Cannot unify differently sized
lists"** (`StoryYeller_issue_term_throws_differently_sized_lists`). Inference is thus a partial
function with three outcomes: a valid type, an invalid `(rec)` type, or an exception. A production
front-end must handle all three.

---

## 7. Two entangled bugs in `_replaceVarWithType` — `ReplaceBugTests`

The original substitution helper is:

```js
else if (target instanceof TypeArray)
    return target.clone({varName: replace});   // BUG: literal key "varName", not the value
```

`{varName: replace}` uses the **literal** key `"varName"` (should be `{[varName]: replace}`), so on
a `TypeArray` target it substitutes nothing — a structural no-op.

Measured impact (buggy vs. corrected, across the 69-term corpus):

* **Inert on all 66 well-typed terms** — no observable difference.
* **Changes the 3 cyclic terms**: it shifts the reported recursion depth, e.g. `dup apply`
  reports `(rec 1)` buggy vs `(rec 0)` corrected. So the "depth" in `(rec N)` is partly an artifact
  of the bug.
* **The bug is load-bearing.** Correcting it *in isolation* immediately triggers a **second** latent
  bug: `cloneParameters` unconditionally casts each parameter to `TypeVariable`, but a corrected
  substitution can place a *structured* type in a parameter slot →
  `InvalidCastException` on `unify(a, (a b))`
  (`Correcting_the_bug_in_isolation_exposes_a_latent_cast_crash`). The no-op masks the crash. Any
  real fix must address both together.

---

## 8. Strengths

1. **Automatic rank-N for the concatenative fragment, no annotations** (§4) — the whole point, and
   it delivers.
2. **Small and elegant.** The entire engine is a few hundred lines; composition is genuinely just
   unify-outputs-to-inputs.
3. **Respects semantic identities** — `dup pop`, `swap swap`, `quote apply`, `[] apply` all infer
   identity-shaped types (`PropertyTests`), and the fresh-name normalization makes results
   deterministic across threads.
4. **Fast** and non-explosive on the corpus (`Normal_inference_stays_far_under_the_guard_budget`
   uses < 10% of budget).

## 9. Weaknesses (ranked)

1. **Unsound as a checker** — originally sum-type fusion + no occurs check + raw throws (§6). Sum
   fusion has been removed in the port (clashes now error); the occurs-check gap and partiality
   remain. Fine for a research prototype, still not a compiler front-end as-is.
2. **README example stale** (§5) — erodes trust in the artifact; easy to fix.
3. **`(rec N)` is a value, not an error** — validity is a bolt-on. Recursion should be caught *in*
   unification (an occurs check) so inference is total-with-explicit-failure.
4. **Two entangled bugs** in substitution/cloning (§7).
5. **`id` is mis-typed for a stack language** — `('a -> 'a)` treats `id` as value→value, not
   stack→stack (why `["id", …]` is commented out in the original tests). Minor but telling: it
   shows the value/stack encoding boundary isn't fully policed.

---

## 10. Recommendations

* **Fix or footnote the README** `quote dup apply` example (it currently misstates shipped
  behavior). — *done in the original repo's README.*
* **Sum types removed** ✅ (this port). A constant clash now throws `UnificationError` instead of
  fusing. It was easy (a ~6-line change), safe (zero regressions — no well-typed term relied on a
  sum), and it turns the reachable unsoundness into a real error. Rationale: the one place sums were
  reachable is a contravariant position where the correct answer is an empty *meet* (a type error),
  not a *join* (a union) — so the mechanism was producing the wrong lattice operation. Revisit union
  types only as a deliberate feature (at a genuine join point, variance-aware) if the language gains
  branching/heterogeneous constructs. Still **pair with an occurs check** — removing sums is
  orthogonal to recursion (`dup apply` still `(rec 1)`).
* **Make recursion a real type** ✅ (this port). A coinductive fold/unfold μ-unifier
  (`src/RecursiveTypes.cs`) is now wired into the engine (`src/Equirecursive.cs`, `Cat.Equirecursive`):
  the occurs situation produces an explicit `μ` at reconstruction, and unification consumes `μ` via
  unfold + a memo set, so recursive terms infer valid μ-types end-to-end (§6.2). Remaining polish:
  make it the default (retire `(rec N)`), and add μ-fold/unfold to the isolated `RecursiveTypeTests`
  probes.
* **Repair the substitution + cloneParameters pair together** (§7); add the `unify(a,(a b))` case as
  a regression test.
* **Return an explicit result** (`Ok | Recursive | Error`) from inference instead of sometimes
  returning an invalid type and sometimes throwing.
* Keep and publish the rank-N result (§4) — that is the part worth writing up.

---

## Appendix — test map

290 tests, fully sandboxed.

| Concern | Fixture |
|---|---|
| Port is faithful (76 canonical outputs) | `FidelityTests` |
| Rank-N claim / README discrepancy | `HigherRankClaimTests` |
| `quote dup apply` root cause + fix | `RootCauseTests` |
| Soundness: constant clashes now rejected | `SoundnessTests` |
| No occurs check, `(rec N)`, partiality | `RecursionTests` |
| Could `(rec N)` be a valid μ-type? | `RecursiveTypeTests` |
| Coinductive fold/unfold μ-unifier (standalone) | `RecursiveUnifierTests` |
| Equirecursive μ-types wired into the engine | `EquirecursiveIntegrationTests` |
| Entangled substitution/clone bugs | `ReplaceBugTests` |
| Algebraic laws, identities, associativity | `AlgebraicLawTests` |
| Quantifier placement (`computeParameters`) | `ComputeParametersTests` |
| Type & Cat parsers | `ParserTests` |
| Direct unification behavior | `UnifierTests` |
| `isValid` / polytype predicates | `ValidityTests` |
| Normalization / cloning / determinism | `RobustnessTests`, `PropertyTests` |
| Literals & stack behavior | `LiteralTests` |
| Guard/Sandbox safety harness | `TerminationTests` |
