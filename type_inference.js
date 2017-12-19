"use strict";
// A Type Inference Algorithm by Christopher Digginss  
// This a novel type inference algorithm that provides support for full inference of higher rank polymorphic types
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
// The one and only module
var TypeInference;
(function (TypeInference) {
    // Turn on for debugging purposes
    TypeInference.trace = false;
    // Base class of a type: either a TypeArray, TypeVariable, or TypeConstant
    var Type = (function () {
        function Type() {
            // All type varible referenced somewhere by the type, or the type itself if it is a TypeVariable.
            this.typeVars = [];
        }
        return Type;
    }());
    TypeInference.Type = Type;
    // A collection of a fixed number of types can be used to represent function types or tuple types. 
    // A list of types is usually encoded as a nested set of type pairs (TypeArrays with two elements).
    // If a TypeArray declares variables with an implicit for-all qualifier, it is considered a "PolyType". 
    // The variables which are part of the TypeArray 
    // All variables are assumed to be uniquely named. When constructed the TypeArray 
    // will compute which type variables need to be lifted to it's "TypeScheme".
    var TypeArray = (function (_super) {
        __extends(TypeArray, _super);
        function TypeArray(types) {
            var _this = _super.call(this) || this;
            _this.types = types;
            // The type variables that are bound to this TypeArray. 
            // Always a subset of typeVars
            _this.typeVarDeclarations = [];
            // Compute all referenced types 
            for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
                var t = types_1[_i];
                _this.typeVars = _this.typeVars.concat(t.typeVars);
            }
            // Assign all correct type variables to this type scheme
            for (var i = 0; i < types.length; ++i) {
                var child = types[i];
                // Individual type variables are part of this scheme 
                if (child instanceof TypeVariable)
                    _reassignAllVarsToScheme(child.name, _this);
                else if (child instanceof TypeArray) {
                    // Get the vars of the child type. 
                    // If any of them show up in multiple child arrays, then they 
                    // are part of the parent's child 
                    for (var _a = 0, _b = child.typeVars; _a < _b.length; _a++) {
                        var childVar = _b[_a];
                        if (_isTypeVarUsedElsewhere(_this, childVar.name, i))
                            _reassignAllVarsToScheme(childVar.name, _this);
                    }
                }
            }
            // Implementation validation step:
            // Assure that the type scheme variables are all in the typeVars 
            for (var _c = 0, _d = _this.typeVarDeclarations; _c < _d.length; _c++) {
                var v = _d[_c];
                var i = _this.typeVars.indexOf(v);
                if (i < 0)
                    throw new Error("Internal error: type scheme references a variable that is not marked as referenced by the type variable");
            }
            return _this;
        }
        // Provides a user friendly representation of the type scheme 
        TypeArray.prototype.typeSchemeToString = function () {
            var tmp = {};
            for (var _i = 0, _a = this.typeVarDeclarations; _i < _a.length; _i++) {
                var v = _a[_i];
                tmp[v.name] = true;
            }
            var r = Object.keys(tmp);
            if (r.length == 0)
                return "";
            return "!" + r.join("!") + ".";
        };
        TypeArray.prototype.toString = function () {
            return this.typeSchemeToString() + "(" + this.types.join(' ') + ")";
        };
        return TypeArray;
    }(Type));
    TypeInference.TypeArray = TypeArray;
    // A type variable is used for generics (e.g. T0, TR). 
    // The type variable must belong to a type scheme of a polytype. This is like a "scope" for type variables.
    // Computing the type schema is done in an external function.
    var TypeVariable = (function (_super) {
        __extends(TypeVariable, _super);
        function TypeVariable(name) {
            var _this = _super.call(this) || this;
            _this.name = name;
            _this.typeVars.push(_this);
            return _this;
        }
        TypeVariable.prototype.toString = function () {
            return this.name;
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
    // This is helper function helps determine whether a type variable should belong 
    function _isTypeVarUsedElsewhere(t, varName, pos) {
        for (var i = 0; i < t.types.length; ++i)
            if (i != pos && t.types[i].typeVars.some(function (v) { return v.name == varName; }))
                return true;
        return false;
    }
    TypeInference._isTypeVarUsedElsewhere = _isTypeVarUsedElsewhere;
    // Associate the variable with a new type scheme. Removing it from the previous varScheme 
    function _reassignVarScheme(v, t) {
        // Remove the variable from the previous scheme 
        if (v.scheme != undefined)
            v.scheme.typeVarDeclarations = v.scheme.typeVarDeclarations.filter(function (t) { return t.name != v.name; });
        // Set the new scheme 
        v.scheme = t;
        t.typeVarDeclarations.push(v);
    }
    TypeInference._reassignVarScheme = _reassignVarScheme;
    // Associate all variables of the given name in the TypeArray with the TypeArray's scheme
    function _reassignAllVarsToScheme(varName, t) {
        t.typeVars.filter(function (v) { return v.name == varName; }).forEach(function (v) { return _reassignVarScheme(v, t); });
    }
    TypeInference._reassignAllVarsToScheme = _reassignAllVarsToScheme;
    // Use this class to unify types that are constrained together.
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
                        return recursiveType(i);
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
        // All unifiers that refer to varName as the unifier are pointed to the new unifier 
        Unifier.prototype._updateVariableUnifiers = function (varName, u) {
            for (var x in this.unifiers) {
                var t = this.unifiers[x].unifier;
                if (t instanceof TypeVariable)
                    if (t.name == varName)
                        this.unifiers[x] = u;
            }
        };
        // Computes the best unifier between the current unifier and the new variable.        
        // Updates all unifiers which point to a (or to t if t is a TypeVar) to use the new type. 
        Unifier.prototype._updateUnifier = function (a, t, depth) {
            var u = this._getOrCreateUnifier(a);
            u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
            this._updateVariableUnifiers(a.name, u);
            if (t instanceof TypeVariable) {
                // Make sure a unifier is created
                this._getOrCreateUnifier(t);
                this._updateVariableUnifiers(t.name, u);
            }
            return u.unifier;
        };
        // Gets or creates a type unifiers for a type variables
        Unifier.prototype._getOrCreateUnifier = function (t) {
            if (!(t.name in this.unifiers))
                return this.unifiers[t.name] = new TypeUnifier(t.name, t);
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
        return typeArray([input, typeConstant('->'), output]);
    }
    TypeInference.functionType = functionType;
    // Creates an array type, as a special kind of TypeArray
    function arrayType(element) {
        return typeArray([element, typeConstant('[]')]);
    }
    TypeInference.arrayType = arrayType;
    // Creates a list type, as a special kind of TypeArray
    function listType(element) {
        return typeArray([element, typeConstant('*')]);
    }
    TypeInference.listType = listType;
    // Creates a recursive type, as a special kind of TypeArray. The numberical value 
    // refers to the depth of the recursion: how many TypeArrays you have to go up 
    // to find the recurison base case. 
    function recursiveType(depth) {
        return typeArray([typeConstant('rec'), typeConstant(depth.toString())]);
    }
    TypeInference.recursiveType = recursiveType;
    // Returns true if and only if the type is a type constant with the specified name
    function isTypeConstant(t, name) {
        return t instanceof TypeConstant && t.name === name;
    }
    TypeInference.isTypeConstant = isTypeConstant;
    // Returns true if and only if the type is a type constant with the specified name
    function isTypeArray(t, name) {
        return t instanceof TypeArray && t.types.length == 2 && isTypeConstant(t.types[1], '[]');
    }
    TypeInference.isTypeArray = isTypeArray;
    // Returns true iff the type is a TypeArary representing a function type
    function isFunctionType(t) {
        return t instanceof TypeArray && t.types.length == 3 && isTypeConstant(t.types[1], '->');
    }
    TypeInference.isFunctionType = isFunctionType;
    // Returns the input types (argument types) of a TypeArray representing a function type
    function functionInput(t) {
        if (!isFunctionType(t))
            throw new Error("Expected a function type");
        return t.types[0];
    }
    TypeInference.functionInput = functionInput;
    // Returns the output types (return types) of a TypeArray representing a function type
    function functionOutput(t) {
        if (!isFunctionType(t))
            throw new Error("Expected a function type");
        return t.types[2];
    }
    TypeInference.functionOutput = functionOutput;
    // Returns all types contained in this type
    function descendantTypes(t, r) {
        if (r === void 0) { r = []; }
        r.push(t);
        if (t instanceof TypeArray)
            t.types.forEach(function (t2) { return descendantTypes(t2, r); });
        return r;
    }
    TypeInference.descendantTypes = descendantTypes;
    // Returns true if the type is a polytype
    function isPolyType(t) {
        return t instanceof TypeArray && t.typeVarDeclarations.length > 0;
    }
    TypeInference.isPolyType = isPolyType;
    // Returns true if the type is a function that generates a polytype.
    function generatesPolytypes(t) {
        if (!isFunctionType(t))
            return false;
        return descendantTypes(functionOutput(t)).some(isPolyType);
    }
    TypeInference.generatesPolytypes = generatesPolytypes;
    // Returns the type of the id function 
    function idFunction() {
        var s = typeVar('_');
        return functionType(s, s);
    }
    TypeInference.idFunction = idFunction;
    // When unifying I will need to use this function.
    function clone(t) {
        if (t instanceof TypeVariable)
            return typeVar(t.name);
        else if (t instanceof TypeConstant)
            return typeConstant(t.name);
        else if (t instanceof TypeArray)
            return typeArray(t.types.map(clone));
    }
    TypeInference.clone = clone;
    //========================================================
    // Variable name functions
    // Renames all variables with the new
    function renameVars(t, names) {
        var r = clone(t);
        for (var _i = 0, _a = descendantTypes(r); _i < _a.length; _i++) {
            var v = _a[_i];
            if (v instanceof TypeVariable)
                v.name = names[v.name];
        }
        return r;
    }
    TypeInference.renameVars = renameVars;
    // Generates fresh variable names for all the variables in the list
    function generateFreshNames(t, id) {
        var names = {};
        for (var _i = 0, _a = descendantTypes(t); _i < _a.length; _i++) {
            var v = _a[_i];
            if (v instanceof TypeVariable)
                names[v.name] = v.name + "$" + id;
        }
        return renameVars(t, names);
    }
    TypeInference.generateFreshNames = generateFreshNames;
    // Rename all type variables os that they follow T0..TN according to the order the show in the tree. 
    function normalizeVarNames(t) {
        var names = {};
        var count = 0;
        for (var _i = 0, _a = descendantTypes(t); _i < _a.length; _i++) {
            var dt = _a[_i];
            if (dt instanceof TypeVariable)
                if (!(dt.name in names))
                    names[dt.name] = "t" + count++;
        }
        return renameVars(t, names);
    }
    TypeInference.normalizeVarNames = normalizeVarNames;
    // Compares whether two types are the same after normalizing the type variables. 
    function areTypesSame(t1, t2) {
        var s1 = normalizeVarNames(t1).toString();
        var s2 = normalizeVarNames(t2).toString();
        return s1 === s2;
    }
    TypeInference.areTypesSame = areTypesSame;
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
            var scope = this.findNameScope(name);
            if (scope[name] == null)
                scope[name] = type;
            else
                this.addConstraint(scope[name], type, location);
            return type;
        };
        TypeEnv.prototype.addFunctionCall = function (name, args, location) {
            if (location === void 0) { location = null; }
            var funcType = this.findNameScope(name)[name];
            if (!isFunctionType(funcType))
                throw new Error("Not a function type associated with " + name);
            var input = functionInput(funcType);
            var output = functionOutput(funcType);
            this.addConstraint(input, output, location);
            return output;
        };
        return TypeEnv;
    }());
    TypeInference.TypeEnv = TypeEnv;
    //============================================================
    // Top level type operations which require unification 
    // - Composition
    // - Application
    // - Quotation
    // Returns the function type that results by composing two function types
    function composeFunctions(f, g) {
        if (!isFunctionType(f))
            throw new Error("Expected a function type for f");
        if (!isFunctionType(g))
            throw new Error("Expected a function type for g");
        f = generateFreshNames(f, 0);
        g = generateFreshNames(g, 1);
        if (TypeInference.trace) {
            console.log("f: " + f);
            console.log("g: " + g);
        }
        var inF = functionInput(f);
        var outF = functionOutput(f);
        var inG = functionInput(g);
        var outG = functionOutput(g);
        var e = new Unifier();
        e.unifyTypes(outF, inG);
        var input = e.getUnifiedType(inF);
        var output = e.getUnifiedType(outG);
        var r = functionType(input, output);
        if (TypeInference.trace) {
            console.log(e.state());
        }
        return r;
    }
    TypeInference.composeFunctions = composeFunctions;
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
        fxn = clone(fxn);
        args = clone(args);
        var input = functionInput(fxn);
        var output = functionOutput(fxn);
        u.unifyTypes(input, args);
        return u.getUnifiedType(output);
    }
    TypeInference.applyFunction = applyFunction;
    // Creates a function type that generates the given type 
    function quotation(x) {
        var row = typeVar('_');
        return functionType(row, typeArray([x, row]));
    }
    TypeInference.quotation = quotation;
})(TypeInference = exports.TypeInference || (exports.TypeInference = {}));
//# sourceMappingURL=type_inference.js.map