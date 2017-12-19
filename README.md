# Type Inference Algorithm 

This is a practical implementation in TypeScript of a type inference algorithm that can infer higher-kind polymorphic types without type annotations. 

## Relation to Algorithm W

This is inspired by Algorithm W, but is a different type algorithm, and a different type system than Hindley-Milner. Algorithm W only works for prenex polymorphis (aka rank-1 polymorphic types). 

## The Core Type System

```
apply : !a!b.(((a -> b) a) -> b) 
compose : !a!b!c!d.(((b -> c) ((a -> b) d)) -> ((a -> c) d)
quote : !a!b.((a b) -> (!c.(c -> a c) b)
dup : !a!b.((a b) -> (a (a b))
swap : !a!b!c.((a (b c)) -> (b (a c)))
pop : !a!b.((a b) -> b)
```

## Open Questions

1. How does the type system presented here map to System F? 
2. Are these truly higher-rank polymorphic types?

Recursive types are detected, but cannot be unified with other types. 
