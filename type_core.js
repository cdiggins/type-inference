"use strict";
// A Type Inference Algorithm 
// A novel type inference algorithm (not Algorithm W) with support for higher rank polymorphism.
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
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
// Turn on for debugging purposes
exports.trace = false;
// Base class of a type: either a TypeArray, TypeVariable, or TypeConstant
var Type = (function () {
    function Type() {
    }
    return Type;
}());
exports.Type = Type;
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
exports.TypeArray = TypeArray;
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
exports.TypeVariable = TypeVariable;
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
exports.TypeConstant = TypeConstant;
// A type unifier is a mapping from a type variable to a best-fit type
var TypeUnifier = (function () {
    function TypeUnifier(name, unifier) {
        this.name = name;
        this.unifier = unifier;
    }
    return TypeUnifier;
}());
exports.TypeUnifier = TypeUnifier;
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
exports.renameTypeVars = renameTypeVars;
// Use this class to infer the type signature for a function. 
var Inferer = (function () {
    function Inferer() {
        // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
        this.unifiers = {};
    }
    // Unify both types, returning the most specific type possible. 
    // When a type variable is unified with something the new unifier is stored. 
    // Note: TypeFunctions and TypePairs ar handled as TypeLists
    // * Constants are preferred over lists and variables
    // * Lists are preferred over variables
    // * Given two variables, the first one is chosen. 
    Inferer.prototype.unifyTypes = function (t1, t2, depth) {
        if (depth === void 0) { depth = 0; }
        if (exports.trace)
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
                throw new Error("Can't unify type constants " + t1.name + " and " + t2.name);
            else
                return t1;
        }
        else if (t1 instanceof TypeConstant || t2 instanceof TypeConstant) {
            throw new Error("Can only unify constants with variables and other constants");
        }
        else if (t1 instanceof TypeArray && t2 instanceof TypeArray) {
            return this._unifyLists(t1, t2, depth + 1);
        }
        throw new Error("Internal error, unexpected code path: unhandled kinds of types for unification");
    };
    // Debug function that dumps prints out a representation of the engine state. 
    Inferer.prototype.logState = function () {
        console.log("Logging type inference engine state");
        for (var k in this.unifiers) {
            var u = this.unifiers[k];
            var t = this.getUnifiedType(u.unifier);
            console.log("type unifier for " + k + ", unifier name " + u.name + ", unifying type " + t);
        }
    };
    // Replaces all variables in a type expression with the unified version
    // The previousVars variable allows detection of cyclical references
    Inferer.prototype.getUnifiedType = function (expr, previousVars) {
        var _this = this;
        if (previousVars === void 0) { previousVars = []; }
        if (expr instanceof TypeConstant)
            return expr;
        else if (expr instanceof TypeVariable) {
            // If we encountered the type variable previously, it meant that there is a recursive relation
            for (var i = 0; i < previousVars.length; ++i)
                if (previousVars[i] == expr.name)
                    throw new Error("Recursive relation found at distance " + i);
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
    Inferer.prototype._chooseBestUnifier = function (t1, t2, depth) {
        var r;
        if (t1 instanceof TypeVariable && t2 instanceof TypeVariable)
            r = t1;
        else if (t1 instanceof TypeVariable)
            r = t2;
        else if (t2 instanceof TypeVariable)
            r = t1;
        else
            r = this.unifyTypes(t1, t2, depth + 1);
        if (exports.trace)
            console.log("Chose type for unification " + r + " between " + t1 + " and " + t2 + " at depth " + depth);
        return r;
    };
    // Unifying lists involves unifying each element
    Inferer.prototype._unifyLists = function (list1, list2, depth) {
        if (list1.types.length != list2.types.length)
            throw new Error("Cannot unify differently sized lists");
        var rtypes = [];
        for (var i = 0; i < list1.types.length; ++i)
            rtypes.push(this.unifyTypes(list1.types[i], list2.types[i], depth));
        return new TypeArray(rtypes);
    };
    // Computes the best unifier between the current unifier and the new variable.        
    // Stores the result in the unifier name.
    Inferer.prototype._updateUnifier = function (a, t, depth) {
        var u = this._getOrCreateUnifier(a);
        u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
        if (u.unifier instanceof TypeVariable)
            this.unifiers[u.unifier.name] = u;
        if (t instanceof TypeVariable)
            this.unifiers[t.name] = u;
        return u.unifier;
    };
    // Unifying two variables. Both share the same unifier afterwards.
    Inferer.prototype._unifyTypeVars = function (a, b, depth) {
        var t = this._getOrCreateUnifier(b).unifier;
        var r = this._updateUnifier(a, t, depth);
        this.unifiers[b.name] = this._getOrCreateUnifier(a);
        return r;
    };
    // Gets or creates a type unifiers for a type variables
    Inferer.prototype._getOrCreateUnifier = function (t) {
        if (!(t.name in this.unifiers))
            return this.unifiers[t.name] = new TypeUnifier(t, t);
        else
            return this.unifiers[t.name];
    };
    return Inferer;
}());
exports.Inferer = Inferer;
//# sourceMappingURL=type_core.js.map