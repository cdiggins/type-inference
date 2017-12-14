// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

// Turn on for debugging purposes
export var trace = false;

// Base class of a type expression: either a TypeList, TypeVariable or TypeConstant
export class TypeExpr { }

// A list of types can be used to represent function types or tuple types. 
// This is called a PolyType since it may contain variables with a for-all qualifier
export class TypeList extends TypeExpr
{
    constructor(
        public types : TypeExpr[])
    { super(); }

    toString() : string { 
        return "(" + this.types.join(' ') + ")"; 
    }
}

// A type variable is used for generics (e.g. T0, TR). 
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

// A type unifier is a mapping from a type variable to a best-fit type
export class TypeUnifier
{
    constructor(
        public name:TypeVariable,
        public unifier:TypeExpr)
    { }
}

// Given a type variable name finds the type set
export interface ITypeUnifierLookup {
    [typeVarName:string] : TypeUnifier;
}

// Associates variable names with type expressions 
export interface ITypeLookup {
    [varName:string] : TypeExpr;
}

// Creates unique variable names in the type signature. Formally called "alpha-conversion".
export function renameTypeVars(tx:TypeExpr, id:number, lookup : ITypeLookup = {}) : TypeExpr {
    if (tx instanceof TypeVariable) {
        if (tx.name in lookup) 
            return lookup[tx.name];
        else 
            return lookup[tx.name] = new TypeVariable(id + tx.name);
    }
    else if (tx instanceof TypeConstant) 
        return tx;
    else if (tx instanceof TypeList) 
        return new TypeList(tx.types.map(t => renameTypeVars(t, id, lookup)));
    else 
        throw new Error("Unrecognized type for " + tx);
} 

// Use this class to infer the type signature for a function. 
export class Inferer
{
    // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
    unifiers : ITypeUnifierLookup = {};

    
    // Unify both types, returning the most specific type possible. 
    // When a type variable is unified with something the new unifier is stored. 
    // Note: TypeFunctions and TypePairs ar handled as TypeLists
    // * Constants are preferred over lists and variables
    // * Lists are preferred over variables
    // * Given two variables, the first one is chosen. 
    unifyTypes(t1:TypeExpr, t2:TypeExpr, depth:number=0) : TypeExpr {
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
                return this._updateUnifier(t1, t2, depth);
        }
        // If one is a variable its unifier with the new type. 
        else if (t2 instanceof TypeVariable) 
        {
            return this._updateUnifier(t2, t1, depth);
        }
        // Constants are best preferred 
        else if (t1 instanceof TypeConstant && t2 instanceof TypeConstant)
        {
            if (t1.name != t2.name)
                throw new Error("Can't unify type constants " + t1.name + " and " + t2.name);
            else 
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
        
    // Debug function that dumps prints out a representation of the engine state. 
    logState() {
        console.log("Logging type inference engine state");
        for (var k in this.unifiers) {
            var u = this.unifiers[k];
            var t = this.getUnifiedType(u.unifier);
            console.log(`type unifier for ${ k }, unifier name ${ u.name }, unifying type ${t}`);
        }
    }             

    // Replaces all variables in a type expression with the unified version
    // The previousVars variable allows detection of cyclical references
    getUnifiedType(expr:TypeExpr, previousVars:string[] = []) : TypeExpr {
        if (expr instanceof TypeConstant)
            return expr;
        else if (expr instanceof TypeVariable) {
            // If we encountered the type variable previously, it meant that there is a recursive relation
            for (var i=0; i < previousVars.length; ++i) 
                if (previousVars[i] == expr.name) 
                    throw new Error("Recursive relation found at distance " + i);
            var u = this.unifiers[expr.name];
            if (!u)
                return expr;
            // If the unifier is a type variable, we are done. 
            else if (u.unifier instanceof TypeVariable)
                return u.unifier;
            else if (u.unifier instanceof TypeConstant)
                return u.unifier;
            else if (u.unifier instanceof TypeList)
                return this.getUnifiedType(u.unifier, [expr.name].concat(previousVars));
            else 
                throw new Error("Unhandled kind of type " + expr);
        }
        else if (expr instanceof TypeList) 
            return new TypeList(expr.types.map((t) => this.getUnifiedType(t, previousVars)));
        else
            throw new Error("Unrecognized kind of type expression " + expr);
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
            r = this.unifyTypes(t1, t2, depth+1);
        if (trace)
            console.log(`Chose type for unification ${r} between ${t1} and ${t2} at depth ${depth}`)
        return r;
    }

    // Unifying lists involves unifying each element
    _unifyLists(list1:TypeList, list2:TypeList, depth:number) : TypeList {
        if (list1.types.length != list2.types.length) 
            throw new Error("Cannot unify differently sized lists");
        var rtypes : TypeExpr[] = [];
        for (var i=0; i < list1.types.length; ++i)
            rtypes.push(this.unifyTypes(list1.types[i], list2.types[i], depth));
        return new TypeList(rtypes);
    }

    // Computes the best unifier between the current unifier and the new variable.        
    // Stores the result in the unifier name.
    _updateUnifier(a:TypeVariable, t:TypeExpr, depth:number) : TypeExpr {
        var u = this._getOrCreateUnifier(a);
        u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
        if (u.unifier instanceof TypeVariable)
            this.unifiers[u.unifier.name] = u;
        if (t instanceof TypeVariable)                
            this.unifiers[t.name] = u;
        return u.unifier;
    }

    // Unifying two variables. Both share the same unifier afterwards.
    _unifyTypeVars(a:TypeVariable, b:TypeVariable, depth:number) : TypeExpr {
        var t = this._getOrCreateUnifier(b).unifier;
        var r = this._updateUnifier(a, t, depth);
        this.unifiers[b.name] = this._getOrCreateUnifier(a);
        return r;
    }

    // Gets or creates a type unifiers for a type variables
    _getOrCreateUnifier(t : TypeVariable) : TypeUnifier {
        if (!(t.name in this.unifiers))
            return this.unifiers[t.name] = new TypeUnifier(t, t);
        else 
            return this.unifiers[t.name];
    }
}
