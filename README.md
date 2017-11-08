# A Type Inference Algorithm for Common People

This is a simple and easy to use practical type inference algorithm written in TypeScript intended for use in various programming 
language implementations or analysis tools.

Given a function signature with no type annotations, and a series of type constraints (expressed in terms of statements or 
expressions in the target language), it will work out the most specific type signature possible, or generate a list of type errors. 
This algorithm can be used with many different programming languages. 

The types handled by this system are either constants (e.g. int, string, function), variables (e.g. T0, R), or 
lists (e.g. `[function, T, [T, T]]`).

The algorithm works by assigning a unique type variable to each argument and the return result. It then builds a list of constraints based on how each variable is used. When `resolve()` is called all constraints are unified to build a series of type sets associated with each type variable referenced in the system. 

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
& http://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm
