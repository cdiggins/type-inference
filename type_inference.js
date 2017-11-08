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
    var TypeError = (function () {
        function TypeError(msg, data) {
            this.msg = msg;
            this.data = data;
        }
        return TypeError;
    }());
    TypeInference.TypeError = TypeError;
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
    // * Symbolic operators (e.g. && and +) or built in statements (e.g. if and while) should be treated as function calls. 
    var TypeEngine = (function () {
        function TypeEngine(argNames) {
            this.argNames = argNames;
            for (var i = 0; i < argNames.length; ++i) {
                var t = new TypeVariable("$A" + i);
                this.addVarDeclaration(argNames[i], t);
                this.argTypes.push(t);
            }
            this.resultType = new TypeVariable("$R");
            this.addVarDeclaration("$result", this.resultType);
        }
        // Called internally for every constraint created 
        TypeEngine.prototype._addConstraint = function (src, target, location) {
            this.constraints.push(new TypeConstraint(this.constraints.length, src, target, location));
            return target;
        };
        // Called internally to construct unique variable names in the type signature
        TypeEngine.prototype._renameTypeVars = function (tx, lookup) {
            var _this = this;
            if (lookup === void 0) { lookup = {}; }
            if (tx instanceof TypeVariable) {
                if (tx.name in lookup) {
                    lookup[tx.name];
                }
                else {
                    return lookup[tx.name] = new TypeVariable("C" + this.constraints.length + "$" + tx.name);
                }
            }
            else if (tx instanceof TypeConstant) {
                return tx;
            }
            else if (tx instanceof TypeList) {
                return new TypeList(tx.types.map(function (t) { return _this._renameTypeVars(tx, lookup); }));
            }
        };
        // Call this for every variable assignment in the function
        TypeEngine.prototype.addVarAssignment = function (varName, target, location) {
            this._addConstraint(this.getVarType(varName), target, location);
            return target;
        };
        // Call this for every variable declaration in the function. 
        // Variable names must be unique, otherwise an exception will be thrown        
        TypeEngine.prototype.addVarDeclaration = function (varName, expr) {
            if (varName in this.varToType)
                throw Error("Variable already declared:" + varName);
            return this.varToType[varName] = expr;
        };
        // Call this for every function application in the function
        TypeEngine.prototype.addFunctionCall = function (func, args, location) {
            // Check that the number of arguments matches the function
            if (func.types.length < 1 || func.types[0] != 'function')
                throw Error("Not a function type.");
            if (func.types.length + 1 != args.length)
                throw Error("The number of arguments " + args.length + " is not what was expected: " + func.types.length + 1);
            // Provide unique variable names to the type signature. 
            func = this._renameTypeVars(func);
            // Constrain the arguments 
            for (var i = 0; i < args.length; ++i)
                this._addConstraint(args[i], func.types[i + 1], location);
            // TODO: this is something expressed in terms of variables that are resolved elsewhere. 
            return func.types[0];
        };
        // Call this for every return statement in the function
        TypeEngine.prototype.addReturnStatement = function (expr, location) {
            this._addConstraint(this.resultType, expr, location);
        };
        // Returns the internal type expression representing a variable 
        TypeEngine.prototype.getVarType = function (name) {
            return this.varToType[name];
        };
        // Returns the resolved function signature or null in the case of a failure. 
        // If you get a failure, all errors will be reported in the errors member variable 
        TypeEngine.prototype.resolve = function () {
            // Resolve all of the constraints. 
            for (var _i = 0, _a = this.constraints; _i < _a.length; _i++) {
                var tc = _a[_i];
                this._unifyConstraint(tc);
            }
            // TODO: walk through each argType and figure out what the new type is. 
            // TODO: figure out the result type 
            // TODO: walk 
            // var ts = this.argTypes; 
            // var tr = this.resultType;
            return new TypeList([]);
        };
        //===
        // Unification steps 
        //==       
        // Stores an error message associated with a location (usually provided by the constaint)
        TypeEngine.prototype._logError = function (message, location) {
            this.errors.push(new TypeError(message, location));
        };
        // Checks that a type-set is valid
        TypeEngine.prototype._validateTypeSet = function (ts) {
            for (var _i = 0, ts_1 = ts; _i < ts_1.length; _i++) {
                var t = ts_1[_i];
                if (t instanceof TypeVariable)
                    throw new Error("A type-set should not contain type variables");
                if (t instanceof TypeConstant)
                    if (ts.length != 1)
                        throw new Error("A type-set containing a constant should only contain one member");
            }
        };
        // Unifies two type sets associated with variable names. 
        // The members of the second type set are extracted and added to the first type set 
        TypeEngine.prototype._unifyTypeSets = function (varNameA, varNameB, location) {
            var tsa = this.typeSets[varNameA];
            var tsb = this.typeSets[varNameB];
            if (tsb === undefined)
                tsb = [];
            if (tsa === undefined)
                tsa = tsb;
            if (tsa == tsb)
                return;
            for (var _i = 0, tsb_1 = tsb; _i < tsb_1.length; _i++) {
                var t = tsb_1[_i];
                this._addToTypeSet(varNameA, t, location);
            }
            if (tsa != this.typeSets[varNameA])
                throw new Error("Internal error: the type set associated with " + varNameA + " has been changed");
            this._validateTypeSet(tsa);
            this.typeSets[varNameB] = tsa;
        };
        // Unifies a constant with any type expression.
        TypeEngine.prototype._unifyConstant = function (tc, t, location) {
            if (t instanceof TypeVariable) {
                if (t.name in this.typeSets) {
                    var ts = this.typeSets[t.name];
                    for (var _i = 0, ts_2 = ts; _i < ts_2.length; _i++) {
                        var tb = ts_2[_i];
                        if (tb instanceof TypeVariable)
                            throw new Error("");
                        this._unifyConstant(tc, tb, location);
                    }
                }
                else
                    // The type set is just a constant
                    this.typeSets[t.name] = [t];
            }
            else if (t instanceof TypeConstant) {
                if (t.name != tc.name)
                    this._logError("Unifying two different type constants " + t.name + " and " + tc.name, location);
            }
            else if (t instanceof TypeList) {
                this._logError("Unifying constant with list", location);
            }
            else
                throw new Error("Unrecognized destination type of constraint");
        };
        // Unifies a type variable with any type expression
        TypeEngine.prototype._unifyVariable = function (tv, t, location) {
            if (t instanceof TypeVariable) {
                this._unifyTypeSets(tv.name, t.name, location);
            }
            else if (t instanceof TypeConstant) {
                this._unifyConstant(t, tv, location);
            }
            else if (t instanceof TypeList) {
                if (tv.name in this.typeSets) {
                    var ts = this.typeSets[tv.name];
                    // Unify the list with each member of the set. 
                    for (var _i = 0, ts_3 = ts; _i < ts_3.length; _i++) {
                        var tb = ts_3[_i];
                        this._unifyList(t, tb, location);
                    }
                    ts.push(t);
                }
                else {
                    this.typeSets[tv.name] = [t];
                }
                this._logError("Unifying constant with list", location);
            }
            else
                throw new Error("Unrecognized destination type of constraint");
        };
        // Unifies a type list with any type expression
        TypeEngine.prototype._unifyList = function (tl, t, location) {
            if (t instanceof TypeVariable) {
                // Logic implemented in _unifyVariable
                this._unifyVariable(t, tl, location);
            }
            else if (t instanceof TypeConstant) {
                // Logic implemented in _unifyConstant
                this._unifyConstant(t, tl, location);
            }
            else if (t instanceof TypeList) {
                if (tl.types.length != t.types.length)
                    this._logError("Source and target type lists aren't the same length.", location);
                // Unify the type variables in the two lists
                for (var i = 0; i < t.types.length && i < tl.types.length; ++i)
                    this._unifyTypes(t.types[i], tl.types[i], location);
            }
            else
                throw new Error("Unrecognized destination type of constraint");
        };
        // Unifies two types together 
        TypeEngine.prototype._unifyTypes = function (ta, tb, location) {
            if (ta instanceof TypeVariable) {
                this._unifyVariable(ta, tb, location);
            }
            else if (ta instanceof TypeConstant) {
                this._unifyConstant(ta, tb, location);
            }
            else if (ta instanceof TypeList) {
                this._unifyList(ta, tb, location);
            }
            else
                throw new Error("Unrecognized source type");
        };
        // Adds a type expression to a type-set
        TypeEngine.prototype._addToTypeSet = function (varName, tx, location) {
            // Adding a typeVariable to a type set indicates we want to unify the two type-sets. 
            if (tx instanceof TypeVariable) {
                this._unifyTypeSets(varName, tx.name, location);
                return;
            }
            // If no type-set exists yet, we create one with the type in it.
            if (!(varName in this.typeSets)) {
                if (tx instanceof TypeVariable)
                    // Unreachable code, but error is thrown in case of incorrect refactoring.
                    throw new Error("Internal error: unexpected code path reached");
                this.typeSets[varName] = [tx];
                return;
            }
            // Get the type set 
            var ts = this.typeSets[varName];
            if (tx instanceof TypeConstant) {
                for (var _i = 0, ts_4 = ts; _i < ts_4.length; _i++) {
                    var tb = ts_4[_i];
                    // This will log an error if the types are not the same 
                    this._unifyConstant(tx, tb, location);
                }
                return;
            }
            else if (tx instanceof TypeList) {
                // Unify each member of the set with the list 
                for (var _a = 0, ts_5 = ts; _a < ts_5.length; _a++) {
                    var tb = ts_5[_a];
                    this._unifyList(tx, tb, location);
                }
                // Add the typelist to the set 
                ts.push(tx);
            }
            else
                // Unreachable code, but error is thrown in case of incorrect refactoring.
                throw new Error("Internal error: unexpected code path reached");
        };
        // Unifies the types of a constraint 
        TypeEngine.prototype._unifyConstraint = function (tc) {
            this._unifyTypes(tc.typeSrc, tc.typeDest, tc.location);
        };
        return TypeEngine;
    }());
    TypeInference.TypeEngine = TypeEngine;
})(TypeInference || (TypeInference = {}));
//# sourceMappingURL=type_inference.js.map