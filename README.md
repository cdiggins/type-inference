# Type Inference Algorithm 

This is a practical implementation in TypeScript of a type inference algorithm that can infer higher-kind polymorphic types without user supplied type annotations. 

## Motivation

Most programming languages with support for generic types (aka polymorphic types) don't allow programmers to use generic types as type parameters, at least not until they have supplied types for it's parameters effectively making a non-generic instantiation of the type. Described another way these languages (including Haskell without extensions) only support rank-1 polymorphism. 

Peyton Jones et al. state that "in practice programmers are more than willing to add type annotations
to guide the type inference engine, and to document their code" but it can place severe restrictions on newcomers to an advanced language if they cannot express simple algorithms, without having to understand 

## Type Inference for Higher Rank Polymorphism 

Languages that support type inference in the presence of higher-rank polymorphism is very rare. In 2007 Peyton Jones, Vytiniotis, Weirich, and Shields wrote a lengthy article for the Journal of Functional Programming called [Practical type inference for arbitrary-rank types](http://research.microsoft.com/en-us/um/people/simonpj/papers/higher-rank/putting.pdf )

In it they state: 

> Complete type inference is known to be undecidable for higher-rank (impredicative) type systems

This is a result I believe proven by Frank Pfenning, but I need to check my notes.

Being undecidable does not mean unimplementable: it just we just can't guarantee termination in the general case. That said, restricted forms of higher-rank polymorphic type systems (e.g. rank-2 polymorphism) haven in fact been proven to be decidable. 

I have not proven that my algorithm terminates, only validated that it terminates on an extensive test suite. 

There are two restrictions on the proposed type system that could potentially affect whether or not type inference is in fact decidable 

1. recursive types are not supported
2. universally quantified variables are not allowed to appear solely on the right-side of a function

I would be interested in collaborating with someone with theroem proving experience to explore this further. 

## Relation to Algorithm W

This is inspired by Hindley-Milner-Damas type inference, aka Algorithm W, but is a different type algorithm, and a more complete type system than Hindley-Milner. Algorithm W only works for prenex polymorphism (aka rank-1 polymorphic types). In other words type parameters can only be bound to monotypes. 

The significant contibute In the proposed type system is that any type variable can be bound to a polytype. There is a restriction imposed that type variables can only be bounding 

https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system


## The Core Type System

```
pop     : !a!b.((a b) -> b)
dup     : !a!b.((a b) -> (a (a b))
swap    : !a!b!c.((a (b c)) -> (b (a c)))
apply   : !a!b.(((a -> b) a) -> b) 
quote   : !a!b.((a b) -> (!c.(c -> a c) b)
compose : !a!b!c!d.(((b -> c) ((a -> b) d)) -> ((a -> c) d)
```

## Inference of Location of Polymorphism

Given a type array with type variables, the algorithm will infer the precise location of the forall quantifiers by assigning them to the inner-most type array that contains all references to that type variable. This is done in the function `computeSchemes`.

```
quote   : (('a 'b) -> (('c -> 'a 'c) 'b)
```

## Kinds of Types

The type system supports the following three categories of types:

1. Type constants 
2. Type variables 
3. Type array - which may or may not be polymorphic, or contain a polymorphic type 

## Illegal Types

A type variable that occurs only on the right-side of a function is illegal. 

## What is a Polytype

A polytype is a type with universally quantified type variables (aka generic type parameters). In the type system, only type arrays can be polytypes. 

## What is a Monotype

A constant type 

## Encoding Functions 


## Open Questions

1. How does the type system presented here map to System F? 
2. Are these truly higher-rank polymorphic types?

Recursive types are detected, but cannot be unified with other types. 
