"use strict";
// A Type Inference Algorithm by Christopher Digginss  
// This a novel type inference algorithm not Hindley Milner Type inference aka Algorithm W. 
// It provides support for higher rank polymorphism and row polymorphism.
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
// The one and only super module
var TypeInference;
(function (TypeInference) {
    // Turn on for debugging purposes
    TypeInference.trace = false;
    // Base class of a type: either a TypeArray, TypeVariable, or TypeConstant
    var Type = (function () {
        function Type() {
        }
        return Type;
    }());
    TypeInference.Type = Type;
    // A list of types can be used to represent function types or tuple types. 
    // This is called a PolyType since it may contain variables with an implicit for-all qualifier
    var TypeArray = (function (_super) {
        __extends(TypeArray, _super);
        function TypeArray(types) {
            var _this = _super.call(this) || this;
            _this.types = types;
            return _this;
        }
        TypeArray.prototype.toString = function () {
            return "(" + this.types.join(' ') + ")";
        };
        return TypeArray;
    }(Type));
    TypeInference.TypeArray = TypeArray;
    // A type variable is used for generics (e.g. T0, TR). 
    var TypeVariable = (function (_super) {
        __extends(TypeVariable, _super);
        function TypeVariable(name) {
            var _this = _super.call(this) || this;
            _this.name = name;
            return _this;
        }
        TypeVariable.prototype.toString = function () {
            return "'" + this.name;
        };
        return TypeVariable;
    }(Type));
    TypeInference.TypeVariable = TypeVariable;
    // A type constant is a fixed type (e.g. int, function). Also called a MonoType.
    var TypeConstant = (function (_super) {
        __extends(TypeConstant, _super);
        function TypeConstant(name) {
            var _this = _super.call(this) || this;
            _this.name = name;
            return _this;
        }
        TypeConstant.prototype.toString = function () {
            return this.name;
        };
        return TypeConstant;
    }(Type));
    TypeInference.TypeConstant = TypeConstant;
    // A type unifier is a mapping from a type variable to a best-fit type
    var TypeUnifier = (function () {
        function TypeUnifier(name, unifier) {
            this.name = name;
            this.unifier = unifier;
        }
        return TypeUnifier;
    }());
    TypeInference.TypeUnifier = TypeUnifier;
    // Creates unique variable names in the type signature. Formally called "alpha-conversion".
    function renameTypeVars(tx, id, lookup) {
        if (lookup === void 0) { lookup = {}; }
        if (tx instanceof TypeVariable) {
            if (tx.name in lookup)
                return lookup[tx.name];
            else
                return lookup[tx.name] = new TypeVariable(id + tx.name);
        }
        else if (tx instanceof TypeConstant)
            return tx;
        else if (tx instanceof TypeArray)
            return new TypeArray(tx.types.map(function (t) { return renameTypeVars(t, id, lookup); }));
        else
            throw new Error("Unrecognized type for " + tx);
    }
    TypeInference.renameTypeVars = renameTypeVars;
    // Normalizes a type definition by using standardized variable names (T0, T1, ...). 
    // This allows two types to be compared for equivalency by converting to strings
    function normalizeType(tx, lookup) {
        if (lookup === void 0) { lookup = {}; }
        if (tx instanceof TypeVariable) {
            if (tx.name in lookup)
                return lookup[tx.name];
            else
                return lookup[tx.name] = new TypeVariable("T" + Object.keys(lookup).length);
        }
        else if (tx instanceof TypeConstant)
            return tx;
        else if (tx instanceof TypeArray)
            return new TypeArray(tx.types.map(function (t) { return normalizeType(t, lookup); }));
        else
            throw new Error("Unrecognized type for " + tx);
    }
    TypeInference.normalizeType = normalizeType;
    // Compares whether two types are the same after normalizing the type variables. 
    function areTypesSame(t1, t2) {
        var s1 = normalizeType(t1).toString();
        var s2 = normalizeType(t2).toString();
        return s1 === s2;
    }
    TypeInference.areTypesSame = areTypesSame;
    // Use this class to unify types that are constrained together 
    var Unifier = (function () {
        function Unifier() {
            // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
            this.unifiers = {};
        }
        // Unify both types, returning the most specific type possible. 
        // When a type variable is unified with something the new unifier is stored. 
        // Note: TypeFunctions and TypePairs ar handled as TypeLists
        // * Constants are preferred over lists and variables
        // * Lists are preferred over variables
        // * Given two variables, the first one is chosen. 
        Unifier.prototype.unifyTypes = function (t1, t2, depth) {
            if (depth === void 0) { depth = 0; }
            if (TypeInference.trace)
                console.log("Unification depth " + depth + " of " + t1 + " and " + t2);
            if (!t1 || !t2)
                throw new Error("Missing type expression");
            if (t1 == t2)
                return t1;
            // Variables are least preferred.  
            if (t1 instanceof TypeVariable) {
                // Two variable have a special path: 
                if (t2 instanceof TypeVariable)
                    return this._unifyTypeVars(t1, t2, depth);
                else
                    return this._updateUnifier(t1, t2, depth);
            }
            else if (t2 instanceof TypeVariable) {
                return this._updateUnifier(t2, t1, depth);
            }
            else if (t1 instanceof TypeConstant && t2 instanceof TypeConstant) {
                if (t1.name != t2.name)
                    throw new Error("Can't unify: " + t1.name + " and " + t2.name);
                else
                    return t1;
            }
            else if (t1 instanceof TypeConstant || t2 instanceof TypeConstant) {
                throw new Error("Can't unify: " + t1 + " and " + t2);
            }
            else if (t1 instanceof TypeArray && t2 instanceof TypeArray) {
                return this._unifyLists(t1, t2, depth + 1);
            }
            throw new Error("Internal error, unexpected code path: " + t1 + " and " + t2);
        };
        // Debug function that dumps prints out a representation of the engine state. 
        Unifier.prototype.state = function () {
            var results = [];
            for (var k in this.unifiers) {
                var u = this.unifiers[k];
                var t = this.getUnifiedType(u.unifier);
                results.push("type unifier for " + k + ", unifier name " + u.name + ", unifying type " + t);
            }
            return results.join('\n');
        };
        // Replaces all variables in a type expression with the unified version
        // The previousVars variable allows detection of cyclical references
        Unifier.prototype.getUnifiedType = function (expr, previousVars) {
            var _this = this;
            if (previousVars === void 0) { previousVars = []; }
            if (expr instanceof TypeConstant)
                return expr;
            else if (expr instanceof TypeVariable) {
                // If we encountered the type variable previously, it meant that there is a recursive relation
                for (var i = 0; i < previousVars.length; ++i)
                    if (previousVars[i] == expr.name)
                        throw new Error("Recursive relation found for " + expr + " at distance " + i);
                var u = this.unifiers[expr.name];
                if (!u)
                    return expr;
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
                return new TypeArray(expr.types.map(function (t) { return _this.getUnifiedType(t, previousVars); }));
            else
                throw new Error("Unrecognized kind of type expression " + expr);
        };
        // Choose one of two unifiers, or continue the unification process if necessary
        Unifier.prototype._chooseBestUnifier = function (t1, t2, depth) {
            var r;
            if (t1 instanceof TypeVariable && t2 instanceof TypeVariable)
                r = t1;
            else if (t1 instanceof TypeVariable)
                r = t2;
            else if (t2 instanceof TypeVariable)
                r = t1;
            else
                r = this.unifyTypes(t1, t2, depth + 1);
            if (TypeInference.trace)
                console.log("Chose type for unification " + r + " between " + t1 + " and " + t2 + " at depth " + depth);
            return r;
        };
        // Unifying lists involves unifying each element
        Unifier.prototype._unifyLists = function (list1, list2, depth) {
            if (list1.types.length != list2.types.length)
                throw new Error("Cannot unify differently sized lists: " + list1 + " and " + list2);
            var rtypes = [];
            for (var i = 0; i < list1.types.length; ++i)
                rtypes.push(this.unifyTypes(list1.types[i], list2.types[i], depth));
            return new TypeArray(rtypes);
        };
        // Computes the best unifier between the current unifier and the new variable.        
        // Stores the result in the unifier name.
        Unifier.prototype._updateUnifier = function (a, t, depth) {
            var u = this._getOrCreateUnifier(a);
            u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
            if (u.unifier instanceof TypeVariable)
                this.unifiers[u.unifier.name] = u;
            if (t instanceof TypeVariable)
                this.unifiers[t.name] = u;
            return u.unifier;
        };
        // Unifying two variables. Both share the same unifier afterwards.
        Unifier.prototype._unifyTypeVars = function (a, b, depth) {
            var t = this._getOrCreateUnifier(b).unifier;
            var r = this._updateUnifier(a, t, depth);
            this.unifiers[b.name] = this._getOrCreateUnifier(a);
            return r;
        };
        // Gets or creates a type unifiers for a type variables
        Unifier.prototype._getOrCreateUnifier = function (t) {
            if (!(t.name in this.unifiers))
                return this.unifiers[t.name] = new TypeUnifier(t, t);
            else
                return this.unifiers[t.name];
        };
        return Unifier;
    }());
    TypeInference.Unifier = Unifier;
    //======================================================================================
    // Helper functions 
    // Creates a type list as nested pairs ("cons" cells ala lisp)
    function typeConsList(types) {
        if (types.length < 3)
            return typeArray(types);
        else
            return typeArray([types[0], typeConsList(types.slice(1))]);
    }
    TypeInference.typeConsList = typeConsList;
    // Creates a type array from an array of types
    function typeArray(types) {
        return new TypeArray(types);
    }
    TypeInference.typeArray = typeArray;
    // Creates a type constant 
    function typeConstant(name) {
        return new TypeConstant(name);
    }
    TypeInference.typeConstant = typeConstant;
    // Creates a type variable
    function typeVar(name) {
        return new TypeVariable(name);
    }
    TypeInference.typeVar = typeVar;
    // Creates a function type, as a special kind of a TypeArray 
    function functionType(input, output) {
        return typeArray([typeConstant('function'), input, output]);
    }
    TypeInference.functionType = functionType;
    // Creates an array type, as a special kind of TypeArray
    function arrayType(element) {
        return typeArray(['array', element]);
    }
    TypeInference.arrayType = arrayType;
    // Returns true if and only if the type is a type constant with the specified name
    function isTypeConstant(t, name) {
        return t instanceof TypeConstant && t.name === name;
    }
    TypeInference.isTypeConstant = isTypeConstant;
    // Returns true if the type is a TypeArary representing a function type
    function isFunctionType(t) {
        return t instanceof TypeArray && t.types.length == 3 && isTypeConstant(t.types[0], 'function');
    }
    TypeInference.isFunctionType = isFunctionType;
    // Returns the input types (argument types) of a TypeArray representing a function type
    function functionInput(t) {
        if (!isFunctionType(t))
            throw new Error("Expected a function type");
        return t.types[1];
    }
    TypeInference.functionInput = functionInput;
    // Returns the output types (return types) of a TypeArray representing a function type
    function functionOutput(t) {
        if (!isFunctionType(t))
            throw new Error("Expected a function type");
        return t.types[2];
    }
    TypeInference.functionOutput = functionOutput;
    // Returns the function type that results by composing two function types
    function composeFunctions(f, g) {
        if (!isFunctionType(f))
            throw new Error("Expected a function type for f");
        if (!isFunctionType(g))
            throw new Error("Expected a function type for g");
        var f1 = renameTypeVars(f, 0);
        var g1 = renameTypeVars(g, 1);
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
    TypeInference.composeFunctions = composeFunctions;
    // Returns the type of the id function 
    function idFunction() {
        var s = typeVar('_');
        return functionType(s, s);
    }
    TypeInference.idFunction = idFunction;
    // Composes a chain of functions
    function composeFunctionChain(fxns) {
        if (fxns.length == 0)
            return idFunction();
        var t = fxns[0];
        for (var i = 0; i < fxns.length; ++i)
            t = composeFunctions(t, fxns[i]);
        return t;
    }
    TypeInference.composeFunctionChain = composeFunctionChain;
    // Applies a function to input arguments and returns the result 
    function applyFunction(fxn, args) {
        var u = new Unifier();
        var input = functionInput(fxn);
        var output = functionOutput(fxn);
        u.unifyTypes(input, args);
        return u.getUnifiedType(output);
    }
    TypeInference.applyFunction = applyFunction;
    //==========================================================================================
    // Type Environments 
    // 
    // This is the top-level implementation of a type inference algorithm that would be used in 
    // a programming language. 
    // Used to track equivalencies between types 
    var TypeConstraint = (function () {
        function TypeConstraint(a, b, location) {
            this.a = a;
            this.b = b;
            this.location = location;
        }
        return TypeConstraint;
    }());
    // An example implementation of a type environment. Used to implement a type inference algorithm
    // in a typical language with variable tracking and scopes.
    var TypeEnv = (function () {
        function TypeEnv() {
            this.unifier = new Unifier();
            this.scopes = [{}];
            this.history = [{}];
            this.index = 0;
        }
        TypeEnv.prototype.pushScope = function () {
            var scope = {};
            this.history.push(scope);
            this.scopes.push(scope);
        };
        TypeEnv.prototype.popScope = function () {
            this.scopes.pop();
        };
        TypeEnv.prototype.currentScope = function () {
            return this.scopes[this.scopes.length - 1];
        };
        TypeEnv.prototype.getName = function (name) {
            for (var _i = 0, _a = this.scopes; _i < _a.length; _i++) {
                var scope = _a[_i];
                if (name in scope)
                    return scope[name];
            }
            throw new Error("Could not find name: " + name);
        };
        TypeEnv.prototype.addName = function (name) {
            var scope = this.currentScope();
            if (name in scope)
                throw new Error("Name already defined in current scope: " + name);
            return scope[name] = null;
        };
        TypeEnv.prototype.findNameScope = function (name) {
            for (var i = this.scopes.length - 1; i >= 0; ++i) {
                var scope = this.scopes[i];
                if (name in scope)
                    return scope;
            }
            throw new Error("Could not find name in any of the scopes: " + name);
        };
        TypeEnv.prototype.addConstraint = function (a, b, location) {
            this.constraints.push(new TypeConstraint(a, b, location));
        };
        TypeEnv.prototype.addAssignment = function (name, type, location) {
            if (location === void 0) { location = null; }
            var t = renameTypeVars(type, this.index++);
            var scope = this.findNameScope(name);
            if (scope[name] == null)
                scope[name] = t;
            else
                this.addConstraint(scope[name], t, location);
            return t;
        };
        TypeEnv.prototype.addFunctionCall = function (name, args, location) {
            if (location === void 0) { location = null; }
            var funcType = this.findNameScope(name)[name];
            if (!isFunctionType(funcType))
                throw new Error("Not a function type associated with " + name);
            funcType = renameTypeVars(funcType, this.index++);
            var input = functionInput(funcType);
            var output = functionOutput(funcType);
            this.addConstraint(input, output, location);
            return output;
        };
        return TypeEnv;
    }());
    TypeInference.TypeEnv = TypeEnv;
})(TypeInference = exports.TypeInference || (exports.TypeInference = {}));
//# sourceMappingURL=type_inference.js.map