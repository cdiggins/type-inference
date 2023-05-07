# Type Inference for Polymorphic Types

This is a TypeScript implementation of a type-inference algorithm for polymorphic types. 
It is used in the:
* [Heron programming language](https://github.com/cdiggins/heron-language)
* [Cat programming language](https://github.com/cdiggins/cat-language)

![image](https://user-images.githubusercontent.com/1759994/236684768-3c352cc6-4abd-4add-a35d-247caa978e62.png)

The type inference algorithm is not proven to support rank-N polymorphism in all cases (this is an open question), 
but it does infer polymorphic types in some cases 
where other languages using HM inference are known to fail. 

# Citation

```
@software{cdiggins/type-inference,
  author = {Diggins, Christopher},
  title = {Type Inference for Polymorphic Types},
  url = {https://github.com/cdiggins/type-inference},
  year = {2017},
}
```

## Motivation

Types for higher-order functions using generics can become more complex than the implementations of the functions. 

![image](https://user-images.githubusercontent.com/1759994/236685241-81ccda98-1484-41ed-b7fe-bd1174a2b791.png)

# History

This algorithm is based on work done on developing a type system for functional stack-based languages. See: 

```@article{article,
author = {Diggins, Christopher},
year = {2008},
month = {05},
pages = {},
title = {Typing Functional Stack-Based Languages},
volume = {33}
}
```

```
@article{article,
author = {Diggins, Christopher},
year = {2008},
month = {01},
pages = {},
title = {Simple Type Inference for Higher-Order Stack-Oriented Languages}
}```

A version of this algorithm was used to derive types for the functional data flow language [Max Creation Graph (MCG)](https://help.autodesk.com/view/3DSMAX/2017/ENU/?guid=GUID-608EC963-75ED-4F63-96B7-D8AE57E75959) first introduced in Autodesk 3ds Max 2016. 

# Source Code and Dependencies 

All of the source code is constained in a single TypeScript file [type_inference.ts](https://github.com/cdiggins/type-inference/blob/master/type_inference.ts). The tests are contained in the file [test.ts](https://github.com/cdiggins/type-inference/blob/master/test.ts). The tests have a dependency on the [Myna parser](https://github.com/cdiggins/myna-parser).

# Implementation Overview

The basic algorithm is as follows:

* Step 1 (renaming): Uniquely name all type variables 
* Step 2 (forall inference): Infer the position of all forall quantifiers in type arrays
* Step 3 (unify constraint): Given a constraint between two types find a unifier for each variable.
* Step 4 (substitution): Given a type signature compute a new signature by subsituting all type variables in the given type signature with the appropriate unifying type.
* Step 5 (forall inference): Infer the position of all forall quanitifer in the resulting type.

During step 4 (substitution), if a polytype is substituted for a type variable more than once each subsequent instance is given a new set of names for the generic type parameters. This is key for the step 5 to be able to correctly assign the forall quantifiers to the right level of nesting. 

## Implementation Details 

Types are represented by the `Type` class. There are three kinds of types derived from this class: 

1. `TypeConstant` - Represents monotypes (simple non-plymorphic types)
2. `TypeVariable` - Represents a universally quantified type variable, also known as a generic type parameter. 
3. `TypeArray` - A fixed-size collection of types that may or may not have universally quantified type parameters

Other kinds of types, like functions and arrays, are encoded as special cases of type arrays. 

## Recursive Types

Recursive types are not supported but will be reported by the system when inferred. They are identified by a type pair with the special name `Rec` and the depth of the recursive relation as an integer. For example: `(Rec 0)`. Any type containing a `Rec` form should be considered illegal, and will not unify correctly, but the algorithm will nonetheless detect recurrence relations in type relations and report them as if they were a valid type. 

## Type Constants 

A type constant is an atomic non-polymorphic type. It can be an identifier (e.g. `Num` or `Bool`), a number (e.g. `0` or `42`), or a symbol (i.e. `->` or `[]`). The symbols and numbers have no special meaning to the type inference algorithm and are just treated the same as ordinary type constants with identifiers. Type constants can be be used as unifiers associated with type variables and two type cosntants can't be unified together if they are different.

## Type Arrays

A type array is an ordered collection of 0 or more types. It is written out as a sequence of type expressions seprated by whitespace and surrounded by parentheses. Some example are: `()`, `(Num Bool)`, `(a [])`, `(b -> c)`, `(a (b (c)))`. 

A type array may be monomorphic or polymorphic (i.e. have type parameters). Using symbolic type constants in a type array are used as a way of making them more readable and to help a language implementation associate different meaning to certain type arrays. For example: `(Num Num -> Bool)` can be used to represent the function type that takes two numbers and returns a boolean value, and the `((Num []) [])` can be used to represent an array of arrays of numbers. 

## Polymorphic Types 

A polymorphic type (aka polytype, type scheme, generic type, or parametric type) is a type array that has one or more type parameters that are universally quantified. Type parameters are bound to universal quantifiers, represented as a `!` in the syntax. 

For example: `!a.(a [])`, `!a!b.(pair a b)`, `!a!b.((a []) Num (a -> b) -> (b []))`

## Type Variables 

Type variables are the free occurrences of a type parameters that can be replaced a valid type expression. A type variable must be contained polymorphic type that contains the type parameter. 

# Type Encodings 

In a practical setting it is important to encode many different kinds of types such as functions, tuples, structs, arrays, and more. These can all be described using type arrays with special type constants, and the type inference algorithm can deal with them seamlessly. In this section several different encodings are described. 

## Encoding Function Types 

A function is encoded as a type array with 3 elements: the first element representing the arguments, the second element is the special type constant `->` and the third is a type that represents the function return types.

For example the type `((Num Num) -> Bool)` represents a function that converts a type array of two `Num` types to a single `Bool` type. 

## Encoding Type Lists 

A type list is encoded a pair of types (a type array of two elements) where the first element is the head of the list, and the second element is the rest of the list. Usually the type in the last position is a type variable which enables two type lists with different number of elements to be unified. 

## Encoding Array Types

An array type (not to be confused with an array of types) can be encoded as a type array of two elements: the type of elements in the followed by the special type constant `[]`.

For example: `!T.((T []) -> Num)` encodes the type of a function that accepts convert 

# Top-Level Type Operators

There are three top-level type operators provided:

1. Application  - Given a function type, and the type of the arguments, returns the output type.
2. Composition  - Given two functions types (f and g) returns a new type representing the composition of the two functions. 
3. Quotation    - Given a type x generates a row-polymorphic function that will take any type (a) and return the pair a and x.

# Row Polymorphism

Two sequences of types of different lengths can be unified if they are encoded as type lists with a type variable in the tail position.

This is useful to express concepts like a function that accept all tuples that have at least one or two items, such as a `dup`, `pop`, or `swap` operation that works on stacks. The type then would be written as:

```
pop  : !a!S.((a S) -> S)))
dup  : !a!S.((a S) -> (a (a S)))
swap : !a!b!S.(a (b S) -> (b (a S)))
```

Note that lower case and upper case variables do not have different syntactic, if a variable is in a tail position it is implicitly row polymorphic because of the nature of unification of lists encoded as nested pairs.

# How the Algorithm differs from Hindley Milner 

In Hindley Milner type inference all forall quantifiers are lifted to the top of a function. This is not immediately obvious when looking at common terms in the Lambda Calculus, but it becomes more obvious when we start looking at concatenative languages, i.e. stack based language with higher order functions, and consider the type of the term `quote dup`, or any term that makes a copy of a polymorphic function argument. 

Consider the following operators which are common in concatenative (i.e. functional stack based) languages:

```
apply   : !R.(!S.((S -> R) S) -> R)
quote   : !S!a.((a S) -> (!R.(R -> (a R)) S))
compose : !A!C!S.(!B.((B -> C) ((A -> B) S)) -> ((A -> C) S))
```

The `apply` function applies the function on the top of the stack to the rest of the stack. The `quote` function remove a value from the top of the top of the stack, and pushes a function on to the stack that will take any stack and push that value back onto the stack, and the compose function will take two functions off of the stack (say `f` on top followed by `g` underneath) and then push the composition of g with f (`g.f`) back onto the stack. 

Now consider the type inferred by the algorithm for the term `quote dup`. Notice that there are two independent forall quantifiers in the generated function. This is not possible for HM type inference.

```
quote dup : !t0!t1.((t0 t1) -> (!t2.(t2 -> (t0 t2)) (!t3.(t3 -> (t0 t3)) t1)))
```

When we infer the type for the term `quote dup apply` we get the following: 

```
quote dup apply : !t0!t1.((t0 t1) -> (t0 (t0 (t1)))
```

Notice this is exactly the same type as for `dup` which is what we expect intuitively.  

## Compared to Haskell 

The core stack terms can all be described easily in standard Haskell and with the type inferred, but the forall quantifiers are all implicitly lifted to the top level. Here is an example of an interactive session with Haskell 

```
GHCi, version 8.2.1: http://www.haskell.org/ghc/  :? for help
Prelude> :set +t
Prelude> dup (a, s) = (a, (a, s))
dup :: (a, b) -> (a, (a, b))
Prelude> pop (a, s) = s
pop :: (a, b) -> b
Prelude> swap (a, (b, s)) = (b, (a, s))
swap :: (a1, (a2, b)) -> (a2, (a1, b))
Prelude> quote (a, s) = (\r -> (a, r), s)
quote :: (a, b1) -> (b2 -> (a, b2), b1)
Prelude> apply (f, s) = f s
apply :: (t1 -> t2, t1) -> t2
Prelude> compose (f, (g, s)) = (g . f, s)
compose :: (a -> b1, (b1 -> c, b2)) -> (a -> c, b2)
```

So far everything looks the same as before, however the type of the expression `dup quote` in a concatenative language (`quote . dup` when expressed in a prefix applicative function language) the type inferred by Haskell is as follows: 

```
Prelude> quotedup = dup . quote
quotedup :: (a, b) -> (b2 -> (a, b2), (b2 -> (a, b2), b))
```

This type represents the two `quote` functions on the stack as being linked, they both require the same stack configuration `b2`. So when we are to try and compose this with apply, the type inference algorithm fails apart as expected with prenex polymorphism.

```
Prelude> f = apply . quotedup

<interactive>:11:13: error:
    * Occurs check: cannot construct the infinite type:
        t1 ~ (t1 -> (a, t1), b)
      Expected type: (a, b) -> (t1 -> (a, t1), t1)
        Actual type: (a, b) -> (t1 -> (a, t1), (t1 -> (a, t1), b))
    * In the second argument of `(.)', namely `quotedup'
      In the expression: apply . quotedup
      In an equation for `f': f = apply . quotedup
    * Relevant bindings include
        f :: (a, b) -> (a, t1) (bound at <interactive>:11:1)
```

# Appendix: An Alternate Syntax of Type Signatures

In the test system an alternate type syntax is proposed that allows the forall quantifiers to be ommitted and a syntactic analysis to identify type variables. Apostrophes are placed in front of identifiers to identify them as variables. Variables are assumed to be uniquely named, and the appropriate polytype is assumed. 

For example a function type `!a!b.((a b) -> (!c.(c -> (a c) b))` can be expressed as `(('a 'b) -> (('c -> 'a 'c) 'b))`.

## Inference of Location of For-all Quantifiers

Given a type array containing type variables assumed to be uniqely named in potentially nested type arrays, the algorithm will infer which type parameters belong to which type arrays. In other words the precise location of the for-all quantifiers are determined. This process is done by assigning each type variables as a paraemter to the inner-most type array that contains all references to that type variable. This is done in the function `computeParameters()`.

# For More Information

* https://www.researchgate.net/publication/228985001_Typing_Functional_Stack-Based_Languages
* https://prl.khoury.northeastern.edu/blog/static/stack-languages-annotated-bib.pdf
* https://en.wikipedia.org/wiki/Parametric_polymorphism. 
* https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system
* https://en.wikipedia.org/wiki/Lambda_calculus
* https://en.wikipedia.org/wiki/Typed_lambda_calculus
* https://en.wikipedia.org/wiki/Unification_(computer_science) 
* https://en.wikipedia.org/wiki/Covariance_and_contravariance_(computer_science)
* https://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm
* http://www.angelfire.com/tx4/cus/combinator/birds.html
* https://github.com/leonidas/codeblog/blob/master/2012/2012-02-17-concatenative-haskell.md

