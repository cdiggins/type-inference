# Type Inference Algorithm 

This is a simple and easy to use type inference algorithm written in TypeScript that supports polymorphic types and row-polymorphism. 

The algorithm is more powerful than Damas-Hindley-Milner type inference (aka Algorithm W) as it can infer higher-order types.

>>> I have merely tested and validated the code, I have not proven that it works. 

## Higher Rank Polymorphism

This algorithm is capable of inferring polymorphic types 

For example:

('A -> 'B) = forall('A).('A -> 'A) - the id function type
('A -> 'B) = forall('A, 'B).('A -> 'B) - the most general type convering all functions.
(('A -> 'B) 'A -> 'B) = forall('A, 'B).(('A -> 'B) 'A -> 'B) - the type of the function application expresison.
(('a 'B -> 'C) 'a 'D -> ('B -> 'C) 'D) = forall('a, 'D, 'B, 'C).(('a 'B -> 'C) 'a 'D -> ('B -> 'C) 'D)

## Row Polymorphism 

Row polymorphism occurs naturally by encoding type lists as a nested type pairs, with a type variable in the last position, and by encoding function types as mapping from type lists to type lists. 


Given a function signature with no type annotations, and a series of type constraints (expressed in terms of statements or 
expressions in the target language), it will work out the most specific type signature possible, or generate a list of type errors. 

The types handled by this system are either constants (e.g. int, string, function), variables (e.g. T0, R), or 
lists (e.g. `[function, T, [T, T]]`).

The algorithm works by assigning a unique type variable to each argument and the return result. It then builds a list of constraints based on how each variable is used. When `resolve()` is called all constraints are unified to build a series of type sets associated with each type variable referenced in the system. 

"Row variables" in this case are simple existential polymorphism: they are not higher-order kinds.

## Recursive Function Types

During unification a type list might have a reference to a type list that is enclosing itself. This would generate 
a cyclical relation and indicates a recursive type. 

It is useful to detect whether the cyclical type relation indicate
is to an enclosing function. 

Because a recursive function is a type list containing N nested type-lists, identifying the recursive relation requires
substantial bookkeeping. 

 I am used in a function, here is my enclosing function type. 


References:
* Basic Polymorphic Type-Checking by Luca Cardelli (http://research.microsoft.com/users/luca/Papers/BasicTypechecking.pdf)
* http://smallshire.org.uk/sufficientlysmall/2010/04/11/a-hindley-milner-type-inference-implementation-in-python/
* HMF: Simple type inference for first-class polymorphism by Daan Leijen - http://research.microsoft.com/users/daan/download/papers/hmf-tr.pdf
* Programming Languages: Application and Interpretation by Shriram Krishnamurti ( http://cs.brown.edu/~sk/Publications/Books/ProgLangs/ ), 
* http://cs.brown.edu/courses/cs173/2012/book/types.html#%28part._.Type_.Inference%29
* http://dysphoria.net/2009/06/28/hindley-milner-type-inference-in-scala/
* http://dev.stephendiehl.com/fun/006_hindley_milner.html - Hindley-Milner Inference
* http://www.cs.uu.nl/research/techreps/repo/CS-2002/2002-031.pdf - Generalizing Hindley-Milner Type Inference Algorithms by Bastiaan Heeren
* http://fsharpcode.blogspot.ca/2010/08/hindley-milner-type-inference-sample.html -
* https://www.cl.cam.ac.uk/teaching/1415/L28/rows.pdf  
* http://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm
* https://cs.stackexchange.com/questions/53998/what-are-the-major-differences-between-row-polymorphism-and-subtyping 
* https://dl.acm.org/citation.cfm?id=581690.581699 - 
Techniques for embedding postfix languages in Haskell 

## Algorithm W (Damas-Hindley-Milner)

Based on Luca Cardelli's Implementation 

* https://brianmckenna.org/files/js-type-inference/docs/typeinference.html - JavaScript by Brian McKenna
* http://smallshire.org.uk/sufficientlysmall/2010/04/11/a-hindley-milner-type-inference-implementation-in-python/ - Python by Robert Smallshire
* http://dysphoria.net/2009/06/28/hindley-milner-type-inference-in-scala/ - Scala by Andrew 
  * http://dysphoria.net/code/hindley-milner/HindleyMilner.scala 
* http://web.archive.org/web/20050911123640/http:/www.cs.berkeley.edu/~nikitab/courses/cs263/hm.html - Nikita Borisov
* http://lucacardelli.name/Papers/BasicTypechecking.pdf - Luca Cardelli 

Other implementations

* http://catamorph.de/documents/AlgorithmW.pdf - Martin Grabmuller 2006
* http://yinyanghu.github.io/posts/2014-03-13-algorithm-w.html 
* https://github.com/maeln/LambdaHindleyMilner 

Papers

* https://homes.cs.washington.edu/~mernst/teaching/6.883/readings/p207-damas.pdf - Principal Type-Schemes for Functional Languages

## On Higher Rank Polymorphism 

* https://stackoverflow.com/a/10470321/184528 - StackOverflow answer to "what is full type inference" by Andreas Rossberg, 2012
* https://downloads.haskell.org/~ghc/latest/docs/html/users_guide/glasgow_exts.html#arbitrary-rank-polymorphism 

## On Polymorphic Type Inference

* http://cs.au.dk/~mis/typeinf.pdf - Polymorphic Type Inference by Michael I. Schwartzback, March 1995
