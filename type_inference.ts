// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License

// This module provides access to the core, a type parser, and a number of helper functions. 
// The core algorithm in encoded entirely in type_core. 333333

import { TypeParser as tp } from "./type_parser";
import { TypeExpr, TypeList, TypeConstant, TypeVariable, Inferer, renameTypeVars } from "./type_core";333
export { TypeExpr, TypeList, TypeConstant, TypeVariable, Inferer, renameTypeVars } from "./type_core";

export function stringToType(type:string) : TypeExpr {
    return tp.stringToType(type);
}

export function typeCons(types:string[]) : TypeList {        
    if (types.length < 3)
        return typeList(types);
    else 
        return new TypeList([stringToType(types[0]), typeCons(types.slice(1))]);
}
    
export function typeList(types:string[]) : TypeList {        
    return new TypeList(types.map(stringToType));
}

export function typeConstant(name:string) : TypeConstant {
    return new TypeConstant(name);
}

export function typeVar(name:string) : TypeVariable {
    return new TypeVariable(name);
}

export function functionType(input:string[], output:string[]) : TypeList {
    return new TypeList([typeConstant('function'), typeCons(input), typeCons(output)]);    
}    

export function arrayType(element:string) : TypeList {
    return typeList(['array', element]);    
}

export function isTypeConstant(t:TypeExpr, name:string) : boolean {
    return t instanceof TypeConstant && t.name === name;
}

export function isFunctionType(t:TypeExpr) : boolean {        
    return t instanceof TypeList && t.types.length == 3 && isTypeConstant(t.types[0], 'function');
}

export function functionInput(t:TypeList) : TypeExpr {        
    if (!isFunctionType(t)) throw new Error("Expected a function type");
    return t.types[1];
}

export function functionOutput(t:TypeList) : TypeExpr {        
    if (!isFunctionType(t)) throw new Error("Expected a function type");
    return t.types[2];
}

export function composeFunctions(f:TypeList, g:TypeList) : TypeList {
    if (!isFunctionType(f)) throw new Error("Expected a function type for f");
    if (!isFunctionType(g)) throw new Error("Expected a function type for g");
    
    var f1 = renameTypeVars(f, 0) as TypeList;
    var g1 = renameTypeVars(g, 1) as TypeList;

    var inF = functionInput(f1);
    var outF = functionInput(f1);
    var inG = functionInput(g1);
    var outG = functionOutput(g1);

    var e = new Inferer();
    e.unifyTypes(outF, inG);
    var input = e.getUnifiedType(inF);
    var output = e.getUnifiedType(outG);

    return new TypeList([typeConstant('function'), input, output]);    
}
    77
        /*
export class Type

// A type constraint represents an equivalence relation between two types 
export class TypeConstraint 
{
    constructor(
        public index : number,
        public typeSrc : TypeExpr,
        public typeDest : TypeExpr,
        public location)
    { }

    toString() : string {
        return "constraint " + this.index + ": " + this.typeSrc + " <=> " + this.typeDest;
    }
}

    // Unifies the types of a constraint 
    _unifyConstraint(tc:TypeConstraint) {
        this._unifyTypes(tc.typeSrc, tc.typeDest, 0);
    }

    
// A specialization of TypeList that consists of only two types. This is useful
// for encoding listss as nested pairs like a Lisp style cons list. 
export class TypePair extends TypeList 
{
    constructor(
        public typeA : TypeExpr, 
        public typeB : TypeExpr)
    { super([typeA, typeB]); }
}

// A type function is a TypeList of 3 items with an arrow as the second type. 
export class TypeFunction extends TypeList
{
    constructor(
        public inputs : TypeExpr, 
        public outputs : TypeExpr)
    { super([inputs, new TypeConstant('->'), outputs]); }
}


// Returns true if and only if the given type expression is a TypeConstant with the provided name
export function isConstantType(t:TypeExpr, name:string) : boolean {
    return t instanceof TypeConstant && t.name == name;
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

    
    // Resolves all constraints.
    // Has to be called after the constraints are all created and before "getUnifiedType"         
    resolve() {            
        // Initialization
        this.unifiers = {}; 
        for (var tc of this.constraints) {
            this._createUnifiers(tc.typeSrc);
            this._createUnifiers(tc.typeDest);
        }
        for (var tc of this.constraints)
            this._unifyConstraint(tc);
    } 

    // Called for every constraint created. Says that "src" and "target" are equivalent types 
    addTypeConstraint(src:TypeExpr, target:TypeExpr, location = undefined) : TypeExpr {
        if (!src || !target) throw new Error("Missing type expression");
        this.constraints.push(new TypeConstraint(this.constraints.length, src, target, location));
        return target;
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
*/
