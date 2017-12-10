"use strict";
// An implementation of Hindley Milner Type Inference aka Algorithm W in TypeScript
// Extended with support for simple recursive function types and row-polymorphism
// https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system||
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
// Type inference algorithm based on HM which supports generic types,
// recursive types, and row-polymorphism. 
var TypeInference;
(function (TypeInference) {
    var trace = false;
    // Base class of a type expression: either a TypeList, TypeVariable or TypeConstant
    var TypeExpr = (function () {
        function TypeExpr() {
        }
        return TypeExpr;
    }());
    TypeInference.TypeExpr = TypeExpr;
    // A list of types can be used to represent function types or tuple types. 
    // This is called a PolyType since it may contain variables with a for-all qualifier
    var TypeList = (function (_super) {
        __extends(TypeList, _super);
        function TypeList(types) {
            var _this = _super.call(this) || this;
            _this.types = types;
            return _this;
        }
        TypeList.prototype.toString = function () {
            return "[" + this.types.join(' ') + "]";
        };
        return TypeList;
    }(TypeExpr));
    TypeInference.TypeList = TypeList;
    // A specialization of TypeList that consists of only two types
    var TypePair = (function (_super) {
        __extends(TypePair, _super);
        function TypePair(typeA, typeB) {
            var _this = _super.call(this, [typeA, typeB]) || this;
            _this.typeA = typeA;
            _this.typeB = typeB;
            return _this;
        }
        return TypePair;
    }(TypeList));
    TypeInference.TypePair = TypePair;
    // A type function is represented as a TypeList of 3 items with an arrow as the second type. 
    var TypeFunction = (function (_super) {
        __extends(TypeFunction, _super);
        function TypeFunction(inputs, outputs) {
            var _this = _super.call(this, [inputs, new TypeConstant('->'), outputs]) || this;
            _this.inputs = inputs;
            _this.outputs = outputs;
            return _this;
        }
        return TypeFunction;
    }(TypeList));
    TypeInference.TypeFunction = TypeFunction;
    // A type variable is used for generics (e.g. T0, TR)
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
    }(TypeExpr));
    TypeInference.TypeVariable = TypeVariable;
    // A type constant is a fixed type (e.g. int, function)
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
    }(TypeExpr));
    TypeInference.TypeConstant = TypeConstant;
    // A type constraint represents an equivalence relation between two types 
    var TypeConstraint = (function () {
        function TypeConstraint(index, typeSrc, typeDest, location) {
            this.index = index;
            this.typeSrc = typeSrc;
            this.typeDest = typeDest;
            this.location = location;
        }
        return TypeConstraint;
    }());
    TypeInference.TypeConstraint = TypeConstraint;
    // A type unifier is a mapping from a type variable to a best-fit type
    var TypeUnifier = (function () {
        function TypeUnifier(name, unifier) {
            this.name = name;
            this.unifier = unifier;
        }
        return TypeUnifier;
    }());
    TypeInference.TypeUnifier = TypeUnifier;
    // An array of types can be encoded as nested (recursive) type-lists with 
    // a row-variable in the final tail position. This allows two differently sized
    // type lists to be unified where desired (e.g. encoding a type stack).
    // This enables the algorithm to support row-polymorphism
    function arrayToTypePair(types, rowVar) {
        return (types.length == 0)
            ? rowVar
            : new TypePair(types[0], arrayToTypePair(types.slice(1), rowVar));
    }
    TypeInference.arrayToTypePair = arrayToTypePair;
    // Prints out a variable name and type 
    function logVarType(name, t) {
        console.log(name + " : " + t);
    }
    TypeInference.logVarType = logVarType;
    // Prints out a representation of a constraint 
    function logConstraint(tc) {
        console.log("constraint " + tc.typeSrc + " <=> " + tc.typeDest);
    }
    TypeInference.logConstraint = logConstraint;
    // Prints out a representation of a unifier 
    function logUnifier(name, u, te) {
        var t = te.getUnifiedType(u.unifier);
        console.log("type unifier for " + name + ", unifier name " + u.name + ", unifying type " + t);
    }
    TypeInference.logUnifier = logUnifier;
    // Returns true if and only if the given type expression is a TypeConstant with the provided name
    function isConstantType(t, name) {
        return t instanceof TypeConstant && t.name == name;
    }
    TypeInference.isConstantType = isConstantType;
    // Called internally to construct unique variable names in the type signature
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
        else if (tx instanceof TypePair)
            return new TypePair(renameTypeVars(tx.typeA, id, lookup), renameTypeVars(tx.typeB, id, lookup));
        else if (tx instanceof TypeFunction)
            return new TypeFunction(renameTypeVars(tx.inputs, id, lookup), renameTypeVars(tx.outputs, id, lookup));
        else if (tx instanceof TypeList)
            return new TypeList(tx.types.map(function (t) { return renameTypeVars(t, id, lookup); }));
        else
            throw new Error("Unrecognized type for " + tx);
    }
    TypeInference.renameTypeVars = renameTypeVars;
    // Given two function types returns the composed types of functions 
    function getComposedType(a, b) {
        // First rename the type vars 
        var ta = renameTypeVars(a, 0);
        var tb = renameTypeVars(b, 1);
        // Get the results and args 
        var te = new Engine();
        // Add the constraint (results of A = args of B)
        te.addTypeConstraint(ta.outputs, tb.inputs);
        te.resolve();
        // Create the new result type (args of A -> results of B)
        var r = new TypeFunction(ta.inputs, tb.outputs);
        // Get the unification result 
        var f = te.getUnifiedType(r);
        if (trace)
            te.logState();
        return f;
    }
    TypeInference.getComposedType = getComposedType;
    // Use this class to infer the type signature for a function. 
    var Engine = (function () {
        function Engine() {
            // Special recursive type. 
            this.recursiveType = new TypeConstant("$recursive");
            // Reserved variable names for returned variables 
            this.resultVarName = "$return";
            // A mapping of variable names to type expressions
            this.varToType = {};
            // A list of all constructed type constraints 
            this.constraints = [];
        }
        //=================================
        // Functions for setting up the constraints 
        // Called for every constraint created. Says that "src" and "target" are equivalent types 
        Engine.prototype.addTypeConstraint = function (src, target, location) {
            if (location === void 0) { location = undefined; }
            if (!src || !target)
                throw new Error("Missing type expression");
            this.constraints.push(new TypeConstraint(this.constraints.length, src, target, location));
            return target;
        };
        // Call this for every variable assignment or declaration. 
        Engine.prototype.addVarConstraint = function (varName, typeExpr, location) {
            if (location === void 0) { location = undefined; }
            if (!(varName in this.varToType))
                this.varToType[varName] = typeExpr;
            else
                this.addTypeConstraint(this.varToType[varName], typeExpr, location);
            return typeExpr;
        };
        // Call this for every function application in the function.
        Engine.prototype.addFunctionCall = function (func, args, location) {
            // Check that the number of arguments matches the function
            if (func.types.length < 1 || func.types[0] != 'function')
                throw Error("Not a function type.");
            if (func.types.length + 1 != args.length)
                throw Error("The number of arguments " + args.length + " is not what was expected: " + func.types.length + 1);
            // Provide unique variable names to the type signature. 
            func = renameTypeVars(func, this.constraints.length);
            // Constrain the arguments 
            for (var i = 0; i < args.length; ++i)
                this.addTypeConstraint(args[i], func.types[i + 1], location);
            // TODO: this is something expressed in terms of variables that are resolved elsewhere. 
            return func.types[0];
        };
        // Call this for every return statement in the function
        Engine.prototype.addReturnStatement = function (expr, location) {
            this.addVarConstraint(this.resultVarName, expr, location);
        };
        // Replaces all variables in a type expression with the unified version
        Engine.prototype.getUnifiedType = function (expr, vars) {
            var _this = this;
            if (vars === void 0) { vars = []; }
            if (!this.unifiers)
                throw new Error("Resolve hasn't been called yet");
            else if (expr instanceof TypeConstant)
                return expr;
            else if (expr instanceof TypeVariable) {
                // If we encountered the type variable previously, it meant that there is a recursive relation
                for (var i = 0; i < vars.length; ++i) {
                    if (vars[i] == expr.name)
                        throw new Error("Multi-level recursive type found. Types can only refer directly to their enclosing type");
                }
                var u = this.unifiers[expr.name];
                if (!u)
                    return expr;
                else if (u.unifier instanceof TypeVariable)
                    return u.unifier;
                else if (u.unifier instanceof TypeConstant)
                    return u.unifier;
                else if (u.unifier instanceof TypeList) {
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
                return new TypeList(expr.types.map(function (t) { return _this.getUnifiedType(t, vars); }));
            else
                throw new Error("Unrecognized kind of type expression " + expr);
        };
        // Resolves all constraints.
        // Has to be called after the constraints are all created and before "getUnifiedType"         
        Engine.prototype.resolve = function () {
            // Initialization
            this.unifiers = {};
            for (var _i = 0, _a = this.constraints; _i < _a.length; _i++) {
                var tc = _a[_i];
                this._createUnifiers(tc.typeSrc);
                this._createUnifiers(tc.typeDest);
            }
            // Resolve all of the constraints. 
            for (var _b = 0, _c = this.constraints; _b < _c.length; _b++) {
                var tc = _c[_b];
                this._unifyConstraint(tc);
            }
        };
        //===========================
        // Internal implementation algorithms
        // Creates initial type unifiers for variables
        Engine.prototype._createUnifiers = function (t) {
            if (t instanceof TypeList)
                t.types.map(this._createUnifiers.bind(this));
            if (t instanceof TypeVariable)
                this.unifiers[t.name] = new TypeUnifier(t, t);
        };
        // Choose one of two unifiers, or continue the unification process if necessary
        Engine.prototype._chooseBestUnifier = function (t1, t2, depth) {
            var r;
            if (t1 instanceof TypeVariable && t2 instanceof TypeVariable)
                r = t1;
            else if (t1 instanceof TypeVariable)
                r = t2;
            else if (t2 instanceof TypeVariable)
                r = t1;
            else
                r = this._unifyTypes(t1, t2, depth + 1);
            if (trace)
                console.log("Chose type for unification " + r + " between " + t1 + " and " + t2 + " at depth " + depth);
            return r;
        };
        // Unifying lists involves unifying each element
        Engine.prototype._unifyLists = function (list1, list2, depth) {
            if (list1.types.length != list2.types.length)
                throw new Error("Cannot unify differently sized lists");
            if (list1 instanceof TypeFunction) {
                if (!(list2 instanceof TypeFunction))
                    throw new Error("Can only unify a TypeFunction with another TypeFunction");
                return new TypeFunction(this._unifyTypes(list1.inputs, list2.inputs, depth), this._unifyTypes(list1.outputs, list2.outputs, depth));
            }
            if (list1 instanceof TypePair) {
                if (!(list2 instanceof TypePair))
                    throw new Error("Can only unify a TypePair with another TypePair");
                return new TypePair(this._unifyTypes(list1.typeA, list2.typeA, depth), this._unifyTypes(list1.typeB, list2.typeB, depth));
            }
            var rtypes = [];
            for (var i = 0; i < list1.types.length; ++i)
                rtypes.push(this._unifyTypes(list1.types[i], list2.types[i], depth));
            return new TypeList(rtypes);
        };
        // Computes the best unifier between the current unifier and the new variable.        
        // Stores the result in the unifier name.
        Engine.prototype._updateUnifier = function (varName, t, depth) {
            var u = this.unifiers[varName];
            u.unifier = this._chooseBestUnifier(u.unifier, t, depth);
            if (u.unifier instanceof TypeVariable)
                this.unifiers[u.unifier.name] = u;
            if (t instanceof TypeVariable)
                this.unifiers[t.name] = u;
            return u.unifier;
        };
        // Unifying two variables. 
        Engine.prototype._unifyTypeVars = function (a, b, depth) {
            var t = this.unifiers[b.name].unifier;
            var r = this._updateUnifier(a.name, t, depth);
            this.unifiers[b.name] = this.unifiers[a.name];
            return r;
        };
        // Unify both types, returning the most specific type possible. 
        // When a type variable is unified with something, the new unifier is stored. 
        // Note: TypeFunctions and TypePairs ar handled as TypeLists
        // * Constants are preferred over lists and variables
        // * Lists are preferred over variables
        // * Given two variables, the first one is chosen. 
        Engine.prototype._unifyTypes = function (t1, t2, depth) {
            if (trace)
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
                    return this._updateUnifier(t1.name, t2, depth);
            }
            else if (t2 instanceof TypeVariable) {
                return this._updateUnifier(t2.name, t1, depth);
            }
            else if (t1 instanceof TypeConstant && t2 instanceof TypeConstant) {
                if (t1.name != t2.name)
                    throw new Error("Can't unify type constants " + t1.name + " and " + t2.name);
                return t1;
            }
            else if (t1 instanceof TypeConstant || t2 instanceof TypeConstant) {
                throw new Error("Can only unify constants with variables and other constants");
            }
            else if (t1 instanceof TypeList && t2 instanceof TypeList) {
                return this._unifyLists(t1, t2, depth + 1);
            }
            throw new Error("Internal error, unexpected code path: unhandled kinds of types for unification");
        };
        // Unifies the types of a constraint 
        Engine.prototype._unifyConstraint = function (tc) {
            this._unifyTypes(tc.typeSrc, tc.typeDest, 0);
        };
        // Returns true if a type expression is a type list and reference the variable
        Engine.prototype._hasRecursiveReference = function (expr, varName) {
            if (expr instanceof TypeList) {
                for (var i = 0; i < expr.types.length; ++i) {
                    var t = expr.types[i];
                    if (t instanceof TypeVariable)
                        if (t.name == varName)
                            return true;
                }
            }
            return false;
        };
        //===========================================
        // Debugging functions
        // Debug function that dumps prints out a representation of the engine state. 
        Engine.prototype.logState = function () {
            console.log("# Variables");
            for (var v in this.varToType)
                logVarType(v, this.varToType[v]);
            console.log("# Constraints");
            for (var _i = 0, _a = this.constraints; _i < _a.length; _i++) {
                var tc = _a[_i];
                logConstraint(tc);
            }
            console.log("# Unifiers");
            for (var k in this.unifiers)
                logUnifier(k, this.unifiers[k], this);
        };
        return Engine;
    }());
    TypeInference.Engine = Engine;
})(TypeInference = exports.TypeInference || (exports.TypeInference = {}));
//# sourceMappingURL=type_inference.js.map