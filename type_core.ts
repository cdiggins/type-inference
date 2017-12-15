// A Type Inference Algorithm by Christopher Digginss  
// This a novel type inference algorithm not Hindley Milner Type inference aka Algorithm W. 
// It provides support for higher rank 7polymorphism and row polymorphism.

// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

// Turn on for debugging purposes
export var trace = false;

// Base class of a type: either a TypeArray, TypeVariable, or TypeConstant
export class Type { }

// A list of types can be used to represent function types or tuple types. 
// This is called a PolyType since it may contain variables with an implicit for-all qualifier
export class TypeArray extends Type
{
    constructor(
        public types : Type[])
    { super(); }

    toString() : string { 
        return "(" + this.types.join(' ') + ")"; 
    }
}

// A type variable is used for generics (e.g. T0, TR). 
export class TypeVariable extends Type
{
    constructor(
        public name : string) 
    { super(); }        

    toString() : string { 
        return "'" + this.name;
    }
}

// A type constant is a fixed type (e.g. int, function). Also called a MonoType.
export class TypeConstant extends Type
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
        public unifier:Type)
    { }
}

// Given a type variable name finds the type set
export interface ITypeUnifierLookup {
    [typeVarName:string] : TypeUnifier;
}

// Associates variable names with type expressions 
export interface ITypeLookup {
    [varName:string] : Type;
}

// Creates unique variable names in the type signature. Formally called "alpha-conversion".
export function renameTypeVars(tx:Type, id:number, lookup : ITypeLookup = {}) : Type {
    if (tx instanceof TypeVariable) {
        if (tx.name in lookup) 
            return lookup[tx.name];
        else 
            return lookup[tx.name] = new TypeVariable(id + tx.name);
    }
    else if (tx instanceof TypeConstant) 
        return tx;
    else if (tx instanceof TypeArray) 
        return new TypeArray(tx.types.map(t => renameTypeVars(t, id, lookup)));
    else 
        throw new Error("Unrecognized type for " + tx);
} 

// Use this class to unify types that are constrained together 
export class Unifier
{
    // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
    unifiers : ITypeUnifierLookup = {};

    // Unify both types, returning the most specific type possible. 
    // When a type variable is unified with something the new unifier is stored. 
    // Note: TypeFunctions and TypePairs ar handled as TypeLists
    // * Constants are preferred over lists and variables
    // * Lists are preferred over variables
    // * Given two variables, the first one is chosen. 
    unifyTypes(t1:Type, t2:Type, depth:number=0) : Type {
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
        else if (t1 instanceof TypeArray && t2 instanceof TypeArray)
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
    getUnifiedType(expr:Type, previousVars:string[] = []) : Type {
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
            else if (u.unifier instanceof TypeArray)
                return this.getUnifiedType(u.unifier, [expr.name].concat(previousVars));
            else 
                throw new Error("Unhandled kind of type " + expr);
        }
        else if (expr instanceof TypeArray) 
            return new TypeArray(expr.types.map((t) => this.getUnifiedType(t, previousVars)));
        else
            throw new Error("Unrecognized kind of type expression " + expr);
    }

    // Choose one of two unifiers, or continue the unification process if necessary
    _chooseBestUnifier(t1:Type, t2:Type, depth:number) : Type {
        var r:Type;
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
    _unifyLists(list1:TypeArray, list2:TypeArray, depth:number) : TypeArray {
        if (list1.types.length != list2.types.length) 
            throw new Error("Cannot unify differently sized lists");
        var rtypes : Type[] = [];
        for (var i=0; i < list1.types.length; ++i)
            rtypes.push(this.unifyTypes(list1.types[i], list2.types[i], depth));
        return new TypeArray(rtypes);
    }

    // Computes the best unifier between the current unifier and the new variable.        
    // Stores the result in the unifier name.
    _updateUnifier(a:TypeVariable, t:Type, depth:number) : Type {
        var u = this._getOrCreateUnifier(a);
        u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
        if (u.unifier instanceof TypeVariable)
            this.unifiers[u.unifier.name] = u;
        if (t instanceof TypeVariable)                
            this.unifiers[t.name] = u;
        return u.unifier;
    }

    // Unifying two variables. Both share the same unifier afterwards.
    _unifyTypeVars(a:TypeVariable, b:TypeVariable, depth:number) : Type {
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

// Used to track equivalencies between types 
class TypeConstraint 
{
    constructor(
        public a:Type,
        public b:Type,
        public location:any)
    { }
}

// An example implementation of a type environment. Used to implement a type inference algorithm
// in a typical language with variable tracking and scopes.
export class TypeEnv
{
    inferer : Unifier = new Unifier();
    scopes : ITypeLookup[] = [{}]
    contexts : Unifier[] = [];
    history : ITypeLookup[] = [{}];
    constraints : TypeConstraint[];
    index : number = 0;

    pushScope() {
        var scope = {};
        this.history.push(scope);
        this.scopes.push(scope);
    }

    popScope() {
        this.scopes.pop();
    }

    currentScope() : ITypeLookup {
        return this.scopes[this.scopes.length-1];
    }
    
    pushFunctionContext() {
        this.pushScope();
        this.contexts.push(this.inferer);
        this.inferer = new Unifier();
    }

    popFunctionContext() {
        this.inferer = this.contexts.pop();
        this.popScope();
    }

    getName(name:string) : Type { 
        for (var scope of this.scopes)
            if (name in scope)
                return scope[name];
        throw new Error("Could not find name: " + name);
    }
    
    addName(name:string) { 
        var scope = this.currentScope();
        if (name in scope) throw new Error("Name already defined in current scope: " + name);
        return scope[name] = null;
    }

    findNameScope(name:string) : ITypeLookup {
        for (var i=this.scopes.length-1; i >= 0; ++i) {
            var scope = this.scopes[i];
            if (name in scope)
                return scope;
        }
        throw new Error("Could not find name in any of the scopes: "+ name)
    }

    addAssignment(name:string, type:Type, location:any = null) : Type { 
        var t = renameTypeVars(type, this.index++);
        var scope = this.findNameScope(name);        
        if (scope[name] == null)
            return scope[name] = t;
        return scope[name] = this.inferer.unifyTypes(scope[name], t);
    }
    
    addFunctionCall(name:string, args:TypeArray, location:any = null) : Type { 
        var funcType = this.findNameScope(name)[name] as TypeArray;
        if (!isFunctionType(funcType)) throw new Error("Not a function type associated with " + name);
        funcType = renameTypeVars(funcType, this.index++) as TypeArray;
        var input = functionInput(funcType);    
        var output = functionOutput(funcType);
        this.inferer.unifyTypes(input, args);
        return this.inferer.getUnifiedType(output);
    }
}

//======================================================================================
// These are parsing algorithms to help convert from types as string 

import { Myna as m } from "./node_modules/myna-parser/myna";

function registerGrammars() 
{
    var typeGrammar = new function() 
    {
        var _this = this;
        this.typeExprRec            = m.delay(() => { return _this.typeExpr});
        this.typeList               = m.guardedSeq('(', m.ws, this.typeExprRec.ws.zeroOrMore, ')').ast;
        this.typeVar                = m.guardedSeq("'", m.identifier).ast;
        this.typeConstant           = m.identifier.ast;
        this.typeExpr               = m.choice(this.typeList, this.typeVar, this.typeConstant).ast;        
    }        

    m.registerGrammar('type', typeGrammar, typeGrammar.typeExpr);    
}

registerGrammars();

var parser = m.parsers['type'];

export function stringToType(input:string) : Type {
    var ast = parser(input);
    return astToType(ast);
}

export function astToType(ast:m.AstNode) : Type {
    if (!ast)
        return null;
    switch (ast.name)
    {
        case "typeVar":
            return new TypeVariable(ast.allText.substr(1));
        case "typeConstant":
            return new TypeConstant(ast.allText);
        case "typeList":
            return new TypeArray(ast.children.map(astToType));
        case "typeExpr":
            if (ast.children.length != 1) 
                throw new Error("Expected only one child of node, not " + ast.children.length);
            return astToType(ast.children[0]);
        default: 
            throw new Error("Unrecognized type expression: " + ast.name);
    }
}

//======================================================================================
// Helper functions 

export type TypeOrString = Type | String;

export function toType(type:TypeOrString) : Type {
    return type instanceof Type 
        ? type
        : stringToType(type)
}

export function typeCons(types:TypeOrString[]) : TypeArray {        
    if (types.length < 3)
        return typeArray(types);
    else 
        return typeArray([types[0], typeCons(types.slice(1))]);
}

export function typeArray(types:TypeOrString[]) : TypeArray {        
    return new TypeArray(types.map(toType));
}

export function typeConstant(name:string) : TypeConstant {
    return new TypeConstant(name);
}

export function typeVar(name:string) : TypeVariable {
    return new TypeVariable(name);
}

export function functionType(input:TypeOrString[], output:TypeOrString[]) : TypeArray {
    return typeArray([typeConstant('function'), typeCons(input), typeCons(output)]);    
}    

export function arrayType(element:string) : TypeArray {
    return typeArray(['array', element]);    
}

export function isTypeConstant(t:Type, name:string) : boolean {
    return t instanceof TypeConstant && t.name === name;
}

export function isFunctionType(t:Type) : boolean {        
    return t instanceof TypeArray && t.types.length == 3 && isTypeConstant(t.types[0], 'function');
}

export function functionInput(t:TypeArray) : Type {        
    if (!isFunctionType(t)) throw new Error("Expected a function type");
    return t.types[1];
}

export function functionOutput(t:TypeArray) : Type {        
    if (!isFunctionType(t)) throw new Error("Expected a function type");
    return t.types[2];
}

export function composeFunctions(f:TypeArray, g:TypeArray) : TypeArray {
    if (!isFunctionType(f)) throw new Error("Expected a function type for f");
    if (!isFunctionType(g)) throw new Error("Expected a function type for g");
    
    var f1 = renameTypeVars(f, 0) as TypeArray;
    var g1 = renameTypeVars(g, 1) as TypeArray;

    var inF = functionInput(f1);
    var outF = functionInput(f1);
    var inG = functionInput(g1);
    var outG = functionOutput(g1);

    var e = new Unifier();
    e.unifyTypes(outF, inG);
    var input = e.getUnifiedType(inF);
    var output = e.getUnifiedType(outG);

    return new TypeArray([typeConstant('function'), input, output]);    
}
