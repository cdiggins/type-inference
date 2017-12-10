// An implementation of Hindley Milner Type Inference aka Algorithm W in TypeScript
// Extended with support for simple recursive function types and row-polymorphism
// https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system||
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

// Type inference algorithm based on HM which supports generic types,
// recursive types, and row-polymorphism. 
export module TypeInference 
{
    var trace = false;

    // Base class of a type expression: either a TypeList, TypeVariable or TypeConstant
    export class TypeExpr 
    { 
    }

    // A list of types can be used to represent function types or tuple types. 
    // This is called a PolyType since it may contain variables with a for-all qualifier
    export class TypeList extends TypeExpr
    {
        constructor(
            public types : TypeExpr[])
        { super(); }

        toString() : string { 
            return "[" + this.types.join(' ') + "]"; 
        }
    }

    // A specialization of TypeList that consists of only two types
    export class TypePair extends TypeList 
    {
        constructor(
            public typeA : TypeExpr, 
            public typeB : TypeExpr)
        { super([typeA, typeB]); }
    }

    // A type function is represented as a TypeList of 3 items with an arrow as the second type. 
    export class TypeFunction extends TypeList
    {
        constructor(
            public inputs : TypeExpr, 
            public outputs : TypeExpr)
        { super([inputs, new TypeConstant('->'), outputs]); }
    }

    // A type variable is used for generics (e.g. T0, TR)
    export class TypeVariable extends TypeExpr
    {
        constructor(
            public name : string) 
        { super(); }        

        toString() : string { 
            return "'" + this.name;
        }
    }

    // A type constant is a fixed type (e.g. int, function)
    export class TypeConstant extends TypeExpr
    {
        constructor(
            public name : string)
        { super(); }

        toString() : string { 
            return this.name;
        }
    }

    // A type constraint represents an equivalence relation between two types 
    export class TypeConstraint 
    {
        constructor(
            public index : number,
            public typeSrc : TypeExpr,
            public typeDest : TypeExpr,
            public location)
        { }
    }

    // A type unifier is a mapping from a type variable to a best-fit type
    export class TypeUnifier
    {
        constructor(
            public name:TypeVariable,
            public unifier:TypeExpr)
        { }
    }

    // Associates variable names with type expressions 
    export interface ITypeLookup {
        [varName:string] : TypeExpr;
    }

    // Given a type variable name finds the type set
    export interface ITypeUnifierLookup {
        [typeVarName:string] : TypeUnifier;
    }

    // An array of types can be encoded as nested (recursive) type-lists with 
    // a row-variable in the final tail position. This allows two differently sized
    // type lists to be unified where desired (e.g. encoding a type stack).
    // This enables the algorithm to support row-polymorphism
    export function arrayToTypePair(types:TypeExpr[], rowVar:TypeVariable) : TypeExpr {
        return (types.length == 0) 
            ? rowVar 
            : new TypePair(types[0], arrayToTypePair(types.slice(1), rowVar));
    }
        
    // Prints out a variable name and type 
    export function logVarType(name:string, t:TypeExpr) {
        console.log(name + " : " + t);
    }
    
    // Prints out a representation of a constraint 
    export function logConstraint(tc:TypeConstraint) {
        console.log("constraint " + tc.typeSrc + " <=> " + tc.typeDest);
    }
    
    // Prints out a representation of a unifier 
    export function logUnifier(name:string, u:TypeUnifier, te:Engine) {
        var t = te.getUnifiedType(u.unifier);
        console.log(`type unifier for ${ name }, unifier name ${ u.name }, unifying type ${t}`);
    }

    // Returns true if and only if the given type expression is a TypeConstant with the provided name
    export function isConstantType(t:TypeExpr, name:string) : boolean {
        return t instanceof TypeConstant && t.name == name;
    }

    // Called internally to construct unique variable names in the type signature
    export function renameTypeVars<T extends TypeExpr>(tx:T, id:number, lookup : ITypeLookup = {}) : TypeExpr {
        if (tx instanceof TypeVariable) {
            if (tx.name in lookup) 
                return lookup[tx.name] as T;
            else 
                return lookup[tx.name] = new TypeVariable(id + tx.name);
        }
        else if (tx instanceof TypeConstant) 
            return tx;
        else if (tx instanceof TypePair)
            return new TypePair(renameTypeVars(tx.typeA, id, lookup), renameTypeVars(tx.typeB, id, lookup));
        else if (tx instanceof TypeFunction)
            return new TypeFunction(renameTypeVars(tx.inputs, id, lookup), renameTypeVars(tx.outputs, id, lookup));
        else if (tx instanceof TypeList) 
            return new TypeList(tx.types.map(t => renameTypeVars(t, id, lookup)));
        else 
            throw new Error("Unrecognized type for " + tx);
    } 

    // Given two function types returns the composed types of functions 
    export function getComposedType(a:TypeFunction, b:TypeFunction) : TypeFunction
    {
        // First rename the type vars 
        var ta = renameTypeVars(a, 0) as TypeFunction;
        var tb = renameTypeVars(b, 1) as TypeFunction;    
        // Get the results and args 
        var te = new Engine();
        // Add the constraint (results of A = args of B)
        te.addTypeConstraint(ta.outputs, tb.inputs);
        te.resolve();
        // Create the new result type (args of A -> results of B)
        var r = new TypeFunction(ta.inputs, tb.outputs);
        // Get the unification result 
        var f = te.getUnifiedType(r) as TypeFunction;
        if (trace)
            te.logState();
        return f;
    }
    
    // Use this class to infer the type signature for a function. 
    export class Engine
    {
        // Special recursive type. 
        recursiveType = new TypeConstant("$recursive");

        // Reserved variable names for returned variables 
        resultVarName = "$return";
        
        // A mapping of variable names to type expressions
        varToType : ITypeLookup = {};
        
        // A list of all constructed type constraints 
        constraints : TypeConstraint[] = [];

        // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
        unifiers : ITypeUnifierLookup;

        //=================================
        // Functions for setting up the constraints 

        // Called for every constraint created. Says that "src" and "target" are equivalent types 
        addTypeConstraint(src:TypeExpr, target:TypeExpr, location = undefined) : TypeExpr {
            if (!src || !target) throw new Error("Missing type expression");
            this.constraints.push(new TypeConstraint(this.constraints.length, src, target, location));
            return target;
        }

        // Call this for every variable assignment or declaration. 
        addVarConstraint(varName:string, typeExpr:TypeExpr, location = undefined)  : TypeExpr {
            if (!(varName in this.varToType))
                this.varToType[varName] = typeExpr;  
            else 
                this.addTypeConstraint(this.varToType[varName], typeExpr, location);
            return typeExpr;
        }

        // Call this for every function application in the function.
        addFunctionCall(func:TypeList, args:TypeExpr[], location) : TypeExpr {
            // Check that the number of arguments matches the function
            if (func.types.length < 1 || func.types[0] != 'function') 
                throw Error("Not a function type.");
            if (func.types.length + 1 != args.length)
                throw Error("The number of arguments " + args.length + " is not what was expected: " + func.types.length + 1);
            // Provide unique variable names to the type signature. 
            func = <TypeList>renameTypeVars(func, this.constraints.length);
            // Constrain the arguments 
            for (var i=0; i < args.length; ++i)
                this.addTypeConstraint(args[i], func.types[i+1], location);
            // TODO: this is something expressed in terms of variables that are resolved elsewhere. 
            return func.types[0];
        }        

        // Call this for every return statement in the function
        addReturnStatement(expr:TypeExpr, location) {
            this.addVarConstraint(this.resultVarName, expr, location);
        }

        // Replaces all variables in a type expression with the unified version
        getUnifiedType(expr:TypeExpr, vars:string[] = []) : TypeExpr {
            if (!this.unifiers)
                throw new Error("Resolve hasn't been called yet");
            else if (expr instanceof TypeConstant)
                return expr;
            else if (expr instanceof TypeVariable) {
                // If we encountered the type variable previously, it meant that there is a recursive relation
                for (var i=0; i < vars.length; ++i) {
                    if (vars[i] == expr.name) 
                        throw new Error("Multi-level recursive type found. Types can only refer directly to their enclosing type");
                }
                var u = this.unifiers[expr.name];
                if (!u)
                    return expr;
                // If the unifier is a type variable, we are done. 
                else if (u.unifier instanceof TypeVariable)
                    return u.unifier;
                else if (u.unifier instanceof TypeConstant)
                    return u.unifier;
                else if (u.unifier instanceof TypeList)
                {
                    if (this._hasRecursiveReference(u.unifier, expr.name))                    
                        return this.recursiveType;
                    var vars2 = vars.concat([expr.name]);
                    return this.getUnifiedType(u.unifier, vars2);
                }
                else 
                    throw new Error("Unhandled kind of type " + expr);
            }
            else if (expr instanceof TypePair) 
                return new TypePair(this.getUnifiedType(expr.typeA), this.getUnifiedType(expr.typeB));
            else if (expr instanceof TypeFunction) 
                return new TypeFunction(this.getUnifiedType(expr.inputs), this.getUnifiedType(expr.outputs));
            else if (expr instanceof TypeList) 
                return new TypeList(expr.types.map((t) => this.getUnifiedType(t, vars)));
            else
                throw new Error("Unrecognized kind of type expression " + expr);
        }

        // Resolves all constraints.
        // Has to be called after the constraints are all created and before "getUnifiedType"         
        resolve() {            
            // Initialization
            this.unifiers = {}; 
            for (var tc of this.constraints) {
                this._createUnifiers(tc.typeSrc);
                this._createUnifiers(tc.typeDest);
            }
            
            // Resolve all of the constraints. 
            for (var tc of this.constraints)
                this._unifyConstraint(tc);
        } 
        
        //===========================
        // Internal implementation algorithms

        // Creates initial type unifiers for variables
        _createUnifiers(t : TypeExpr) {
            if (t instanceof TypeList) 
                t.types.map(this._createUnifiers.bind(this));
            if (t instanceof TypeVariable) 
                this.unifiers[t.name] = new TypeUnifier(t, t);
        }
    
        // Choose one of two unifiers, or continue the unification process if necessary
        _chooseBestUnifier(t1:TypeExpr, t2:TypeExpr, depth:number) : TypeExpr {
            var r:TypeExpr;
            if (t1 instanceof TypeVariable && t2 instanceof TypeVariable)
                r = t1;
            else if (t1 instanceof TypeVariable)
                r = t2;
            else if (t2 instanceof TypeVariable)
                r = t1;
            else 
                r = this._unifyTypes(t1, t2, depth+1);
            if (trace)
                console.log(`Chose type for unification ${r} between ${t1} and ${t2} at depth ${depth}`)
            return r;
        }

        // Unifying lists involves unifying each element
        _unifyLists(list1:TypeList, list2:TypeList, depth:number) : TypeList {
            if (list1.types.length != list2.types.length) 
                throw new Error("Cannot unify differently sized lists");
            if (list1 instanceof TypeFunction) {
                if (!(list2 instanceof TypeFunction)) 
                    throw new Error("Can only unify a TypeFunction with another TypeFunction");
                return new TypeFunction(
                    this._unifyTypes(list1.inputs, list2.inputs, depth), 
                    this._unifyTypes(list1.outputs, list2.outputs, depth));                
            }
            if (list1 instanceof TypePair) {
                if (!(list2 instanceof TypePair)) 
                    throw new Error("Can only unify a TypePair with another TypePair");
                return new TypePair(
                    this._unifyTypes(list1.typeA, list2.typeA, depth), 
                    this._unifyTypes(list1.typeB, list2.typeB, depth));
            }
            var rtypes : TypeExpr[] = [];
            for (var i=0; i < list1.types.length; ++i)
                rtypes.push(this._unifyTypes(list1.types[i], list2.types[i], depth));
            return new TypeList(rtypes);
        }

        // Computes the best unifier between the current unifier and the new variable.        
        // Stores the result in the unifier name.
        _updateUnifier(varName:string, t:TypeExpr, depth:number) : TypeExpr {
            var u = this.unifiers[varName];
            u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
            if (u.unifier instanceof TypeVariable)
                this.unifiers[u.unifier.name] = u;
            if (t instanceof TypeVariable)                
                this.unifiers[t.name] = u;
            return u.unifier;
        }

        // Unifying two variables. 
        _unifyTypeVars(a:TypeVariable, b:TypeVariable, depth:number) : TypeExpr {
            var t = this.unifiers[b.name].unifier;
            var r = this._updateUnifier(a.name, t, depth);
            this.unifiers[b.name] = this.unifiers[a.name];
            return r;
        }

        // Unify both types, returning the most specific type possible. 
        // When a type variable is unified with something, the new unifier is stored. 
        // Note: TypeFunctions and TypePairs ar handled as TypeLists
        // * Constants are preferred over lists and variables
        // * Lists are preferred over variables
        // * Given two variables, the first one is chosen. 
        _unifyTypes(t1:TypeExpr, t2:TypeExpr, depth:number) : TypeExpr {
            if (trace)
                console.log(`Unification depth ${depth} of ${t1} and ${t2}`);
            if (!t1 || !t2) 
                throw new Error("Missing type expression");
            if (t1 == t2)
                return t1;                 
            // Variables are least preferred.  
            if (t1 instanceof TypeVariable) 
            {
                // Two variable have a special path: 
                if (t2 instanceof TypeVariable) 
                    return this._unifyTypeVars(t1, t2, depth);
                else
                    return this._updateUnifier(t1.name, t2, depth);
            }
            // If one is a variable its unifier with the new type. 
            else if (t2 instanceof TypeVariable) 
            {
                return this._updateUnifier(t2.name, t1, depth);
            }
            // Constants are best preferred 
            else if (t1 instanceof TypeConstant && t2 instanceof TypeConstant)
            {
                if (t1.name != t2.name)
                    throw new Error("Can't unify type constants " + t1.name + " and " + t2.name);
                return t1;
            }
            // We know by the time we got here, if only one type is a TypeConstant the other is not a variable or a constant
            else if (t1 instanceof TypeConstant || t2 instanceof TypeConstant)
            {
                throw new Error("Can only unify constants with variables and other constants");
            }
            // Check for type list unification. We know that both should be type lists since other possibilities are exhausted. 
            else if (t1 instanceof TypeList && t2 instanceof TypeList)
            {                
                return this._unifyLists(t1, t2, depth+1);
            }
            throw new Error("Internal error, unexpected code path: unhandled kinds of types for unification");
        }
            
        // Unifies the types of a constraint 
        _unifyConstraint(tc:TypeConstraint) {
            this._unifyTypes(tc.typeSrc, tc.typeDest, 0);
        }

        // Returns true if a type expression is a type list and reference the variable
        _hasRecursiveReference(expr:TypeExpr, varName:string) : boolean {
            if (expr instanceof TypeList)
            {
                for (var i=0; i < expr.types.length; ++i) {
                    var t = expr.types[i];
                    if (t instanceof TypeVariable)
                        if (t.name == varName)
                            return true;                
                }
            }
            return false;
        }

        //===========================================
        // Debugging functions

        // Debug function that dumps prints out a representation of the engine state. 
        logState() {
            console.log("# Variables");
            for (var v in this.varToType) 
                logVarType(v, this.varToType[v]);    
            console.log("# Constraints");
            for (var tc of this.constraints) 
                logConstraint(tc);
            console.log("# Unifiers");
            for (var k in this.unifiers) 
                logUnifier(k, this.unifiers[k], this);
        }
    }
}