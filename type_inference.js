"use strict";
// General Purpose Type Inference Made Simple
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
// Type inference for generic types, recursive types, and row-polymorphism.
var TypeInference;
(function (TypeInference) {
    // Base class of a type expression: either a TypeList, TypeVariable or TypeConstant
    var TypeExpr = (function () {
        function TypeExpr() {
        }
        return TypeExpr;
    }());
    TypeInference.TypeExpr = TypeExpr;
    // A list of types can be used to represent function argument types, or tuple types. The "kind" of the list 
    // can be encoded as type constant in the first position. For example: 
    // Tuple<string, int> could be encoded as [tuple, string, int] or a Func<T, int, U> as [func, $T, int, $U]
    var TypeList = (function (_super) {
        __extends(TypeList, _super);
        function TypeList(types) {
            var _this = _super.call(this) || this;
            _this.types = types;
            return _this;
        }
        return TypeList;
    }(TypeExpr));
    TypeInference.TypeList = TypeList;
    // A type variable is used for generics (e.g. T0, TR)
    var TypeVariable = (function (_super) {
        __extends(TypeVariable, _super);
        function TypeVariable(name) {
            var _this = _super.call(this) || this;
            _this.name = name;
            return _this;
        }
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
    // An error message regarding a type error 
    var TypeError = (function () {
        function TypeError(msg, data) {
            this.msg = msg;
            this.data = data;
        }
        return TypeError;
    }());
    TypeInference.TypeError = TypeError;
    // A type unifier is a mapping from a type variable to a best fit type variable
    var TypeUnifier = (function () {
        function TypeUnifier(variable, unifier) {
            this.variable = variable;
            this.unifier = unifier;
        }
        return TypeUnifier;
    }());
    TypeInference.TypeUnifier = TypeUnifier;
    // Use this class to infer the type signature for a function. 
    // For each statement and expression in the function you will call one of the following:
    // * addVarAssignment()
    // * addVarDeclaration()
    // * addFunctionCall()
    // * addReturnStatement()
    // Some usage notes: 
    // * Use getVarType() to get the internal type expression associated with a variable
    // * Use addFunctionCall() to get the internal type expression associated with a function call 
    // * Variables must be already uniquely named based on the scope.
    // * Symbolic operators (e.g. && and +) or built in sstatements (e.g. if and while) should be treated as function calls. 
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
            // Given a type variable name find the unifier. Multiple type varialbles will map to the same unifier 
            this.unifiers = {};
        }
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
            func = this._renameTypeVars(func, this.constraints.length);
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
        // Replaces all variables in a type expression with the unified version
        Engine.prototype.getUnifiedType = function (expr, vars) {
            var _this = this;
            if (vars === void 0) { vars = []; }
            if (expr instanceof TypeConstant)
                return expr;
            else if (expr instanceof TypeVariable) {
                // If we encountered the type variable previously, it meant that there is a recursive relation
                for (var i = 0; i < vars.length; ++i) {
                    if (vars[i] == expr.name)
                        throw new Error("Multi-level recursive type found. Types can only refer directly to their enclosing type");
                }
                var u = this.unifiers[expr.name];
                if (!u)
                    throw new Error("Could not find unifier");
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
            else if (expr instanceof TypeList)
                return new TypeList(expr.types.map(function (t) { return _this.getUnifiedType(t, vars); }));
            else
                throw new Error("Unrecognized kind of type expression " + expr);
        };
        // Resolves all constraints         
        Engine.prototype.resolve = function () {
            // Initialization
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
        // Creates initial type unifiers for variables
        Engine.prototype._createUnifiers = function (t) {
            if (t instanceof TypeList)
                t.types.map(this._createUnifiers.bind(this));
            if (t instanceof TypeVariable)
                this.unifiers[t.name] = new TypeUnifier(t, t);
        };
        // Called internally to construct unique variable names in the type signature
        Engine.prototype._renameTypeVars = function (tx, id, lookup) {
            var _this = this;
            if (lookup === void 0) { lookup = {}; }
            if (tx instanceof TypeVariable) {
                if (tx.name in lookup) {
                    lookup[tx.name];
                }
                else {
                    return lookup[tx.name] = new TypeVariable("C" + id + "$" + tx.name);
                }
            }
            else if (tx instanceof TypeConstant)
                return tx;
            else if (tx instanceof TypeList)
                return new TypeList(tx.types.map(function (t) { return _this._renameTypeVars(tx, id, lookup); }));
        };
        // Choose one of two unifiers, or continue the unification process if necessary
        Engine.prototype._chooseBestUnifier = function (t1, t2) {
            if (t1 instanceof TypeVariable && t2 instanceof TypeVariable)
                return t1;
            if (t1 instanceof TypeVariable)
                return t2;
            if (t2 instanceof TypeVariable)
                return t1;
            return this._unifyTypes(t1, t2);
        };
        // Unifying lists is complicated if they are different lengths. 
        // In which case the last type of the shorter list, if it is a variable, is assumed to be a row variable. 
        Engine.prototype._unifyLists = function (list1, list2) {
            var n = list1.types.length;
            var rtypes = [];
            // Simple case: both lists are the same length 
            if (list1.types.length == list2.types.length) {
                for (var i = 0; i < n; ++i)
                    rtypes.push(this._unifyTypes(list1.types[i], list2.types[i]));
                return new TypeList(rtypes);
            }
            else if (list1.types.length > list2.types.length) {
                return this._unifyLists(list2, list1);
            }
            else {
                // The second list is longer. This means the last variable in the first list is a row variable
                var rowVariable = list1.types[n - 1];
                if (!(rowVariable instanceof TypeVariable))
                    throw new Error("When unifying differently sized lists, the last member must be a variable");
                // Unify the first part of the list 
                for (var i = 0; i < n - 1; ++i)
                    rtypes.push(this._unifyTypes(list1.types[i], list2.types[i]));
                // Unify the row variable with the rest of the list 
                var rest = new TypeList(list2.types.slice(n - 1));
                this._unifyTypes(rowVariable, rest);
                // Put the new types in the list we are generating 
                for (var _i = 0, _a = rest.types; _i < _a.length; _i++) {
                    var t = _a[_i];
                    rtypes.push(t);
                }
                return new TypeList(rtypes);
            }
        };
        // Unify both types, returning the most specific type possible. 
        // When a type variable is unified with something, the new unifier is stored. 
        // * Constants are preferred over lists and variables
        // * Lists are preferred over variables
        // * Given two variables, the first one is chosen. 
        Engine.prototype._unifyTypes = function (t1, t2) {
            if (!t1 || !t2)
                throw new Error("Missing type expression");
            if (t1 == t2)
                return t1;
            // Variables are least preferred.  
            if (t1 instanceof TypeVariable) {
                var u = this.unifiers[t1.name];
                if (t2 instanceof TypeVariable) {
                    var v = this.unifiers[t2.name];
                    // Short-cut if the same unifier is shared 
                    if (u == v)
                        return u.unifier;
                    u.unifier = this._chooseBestUnifier(u.unifier, v.unifier);
                    // Set the same unifier for both type-variables
                    this.unifiers[t2.name] = u;
                }
                else
                    u.unifier = this._chooseBestUnifier(u.unifier, t2);
                return u.unifier;
            }
            else if (t2 instanceof TypeVariable) {
                var u = this.unifiers[t2.name];
                u.unifier = this._chooseBestUnifier(u.unifier, t1);
                return u.unifier;
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
                return this._unifyLists(t1, t2);
            }
            throw new Error("Internal error, unexpected code path: unhandled kinds of types for unification");
        };
        // Unifies the types of a constraint 
        Engine.prototype._unifyConstraint = function (tc) {
            this._unifyTypes(tc.typeSrc, tc.typeDest);
        };
        return Engine;
    }());
    TypeInference.Engine = Engine;
})(TypeInference = exports.TypeInference || (exports.TypeInference = {}));
//# sourceMappingURL=type_inference.js.map