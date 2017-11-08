// General Purpose Type Inference Made Simple
// Copyright 2017 by Christopher Diggins 
// Licensed under the MIT License
module TypeInference 
{
    // Base class of a type expression: either a TypeList, TypeVariable or TypeConstant
    export class TypeExpr 
    { }

    // A list of types can be used to represent function argument types, or tuple types. The "kind" of the list 
    // can be encoded as type constant in the first position. For example: 
    // Tuple<string, int> could be encoded as [tuple, string, int] or a Func<T, int, U> as [func, $T, int, $U]
    export class TypeList extends TypeExpr
    {
        constructor(
            public types : TypeExpr[])
        { super(); }
    }

    // A type variable is used for generics (e.g. T0, TR)
    export class TypeVariable extends TypeExpr
    {
        constructor(
            public name : string) 
        { super(); }
    }

    // A type constant is a fixed type (e.g. int, function)
    export class TypeConstant extends TypeExpr
    {
        constructor(
            public name : string)
        { super(); }
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

    export class TypeError 
    {
        constructor(
            public msg: string,
            public data: any)
        { }
    }

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
    export class TypeEngine
    {
        constructor(
            public argNames:string[])
        {             
            for (var i=0; i < argNames.length; ++i) {
                var t = new TypeVariable("$A" + i);
                this.addVarDeclaration(argNames[i], t);
                this.argTypes.push(t);
            }
            this.resultType = new TypeVariable("$R");
            this.addVarDeclaration("$result", this.resultType);
        }

        // The initial result type of the function 
        resultType : TypeVariable; 

        // The initial types of the function arguments 
        argTypes : TypeVariable[];

        // A mapping of variable names to type expressions
        varToType : {};
        
        // A list of all constructed type constraints 
        constraints : TypeConstraint[];

        // A list of errors. Constructed and filled out during the "resolve" step. 
        errors : TypeError[];

        // Type sets: a look-up of arrays based on type variable names. Built during resolution (unification).
        // Note: multiple variable names might map to the same array.
        typeSets : {}

        // Called internally for every constraint created 
        _addConstraint(src:TypeExpr, target:TypeExpr, location) : TypeExpr {
            this.constraints.push(new TypeConstraint(this.constraints.length, src, target, location));
            return target;
        }

        // Called internally to construct unique variable names in the type signature
        _renameTypeVars<T extends TypeExpr>(tx:T, lookup = {}) : TypeExpr {
            if (tx instanceof TypeVariable) {
                if (tx.name in lookup) {
                    lookup[tx.name];
                } else {
                    return lookup[tx.name] = new TypeVariable("C" + this.constraints.length + "$" + tx.name);
                }
            }
            else if (tx instanceof TypeConstant) {
                return tx;
            }
            else if (tx instanceof TypeList) {
                return new TypeList(tx.types.map(t => this._renameTypeVars(tx, lookup)));
            }
        }

        // Call this for every variable assignment in the function
        addVarAssignment(varName:string, target:TypeExpr, location) : TypeExpr {
            this._addConstraint(this.getVarType(varName), target, location);
            return target;
        }

        // Call this for every variable declaration in the function. 
        // Variable names must be unique, otherwise an exception will be thrown        
        addVarDeclaration(varName:string, expr:TypeExpr) : TypeExpr {
            if (varName in this.varToType) 
                throw Error("Variable already declared:" + varName);
            return this.varToType[varName] = expr;            
        }

        // Call this for every function application in the function
        addFunctionCall(func:TypeList, args:TypeExpr[], location) : TypeExpr {
            // Check that the number of arguments matches the function
            if (func.types.length < 1 || func.types[0] != 'function') 
                throw Error("Not a function type.");
            if (func.types.length + 1 != args.length)
                throw Error("The number of arguments " + args.length + " is not what was expected: " + func.types.length + 1);
            // Provide unique variable names to the type signature. 
            func = <TypeList>this._renameTypeVars(func);
            // Constrain the arguments 
            for (var i=0; i < args.length; ++i)
                this._addConstraint(args[i], func.types[i+1], location);
            // TODO: this is something expressed in terms of variables that are resolved elsewhere. 
            return func.types[0];
        }        

        // Call this for every return statement in the function
        addReturnStatement(expr:TypeExpr, location) {
            this._addConstraint(this.resultType, expr, location);
        }

        // Returns the internal type expression representing a variable 
        getVarType(name:string) : TypeExpr {
            return this.varToType[name];
        }

        // Returns the resolved function signature or null in the case of a failure. 
        // If you get a failure, all errors will be reported in the errors member variable 
        resolve() : TypeList {
            // Resolve all of the constraints. 
            for (var tc of this.constraints)
                this._unifyConstraint(tc);
            
            // TODO: walk through each argType and figure out what the new type is. 
            // TODO: figure out the result type 
            // TODO: walk 
            // var ts = this.argTypes; 
            // var tr = this.resultType;

            return new TypeList([]);
        } 

        //===
        // Unification steps 
        //==       

        // Stores an error message associated with a location (usually provided by the constaint)
        _logError(message:string, location:any) {
            this.errors.push(new TypeError(message, location)); 
        }

        // Checks that a type-set is valid
        _validateTypeSet(ts:TypeExpr[]) {
            for (var t of ts) {
                if (t instanceof TypeVariable)
                    throw new Error("A type-set should not contain type variables");
                if (t instanceof TypeConstant)
                    if (ts.length != 1)
                        throw new Error("A type-set containing a constant should only contain one member");
            }
        }

        // Unifies two type sets associated with variable names. 
        // The members of the second type set are extracted and added to the first type set 
        _unifyTypeSets(varNameA:string, varNameB:string, location:any) {
            var tsa = this.typeSets[varNameA];            
            var tsb = this.typeSets[varNameB];
            if (tsb === undefined)
                tsb = [];
            if (tsa === undefined)
                tsa = tsb;            
            if (tsa == tsb) 
                return;
            for (var t of tsb)
                this._addToTypeSet(varNameA, t, location);
            if (tsa != this.typeSets[varNameA])
                throw new Error("Internal error: the type set associated with " + varNameA + " has been changed");
            this._validateTypeSet(tsa);
            this.typeSets[varNameB] = tsa;
        }

        // Unifies a constant with any type expression.
        _unifyConstant(tc:TypeConstant, t:TypeExpr, location:any) {
            if (t instanceof TypeVariable) {
                if (t.name in this.typeSets) {
                    var ts = this.typeSets[t.name];
                    for (var tb of ts) {
                        if (tb instanceof TypeVariable)
                            throw new Error("")
                        this._unifyConstant(tc, tb, location);
                    }
                }
                else
                    // The type set is just a constant
                    this.typeSets[t.name] = [t];
            }
            else 
            if (t instanceof TypeConstant) {
                if (t.name != tc.name)
                    this._logError("Unifying two different type constants " + t.name + " and " + tc.name, location);                
            }
            else 
            if (t instanceof TypeList) {
                this._logError("Unifying constant with list", location);
            }
            else 
                throw new Error("Unrecognized destination type of constraint");
        }

        // Unifies a type variable with any type expression
        _unifyVariable(tv:TypeVariable, t:TypeExpr, location:any) {            
            if (t instanceof TypeVariable) {
                this._unifyTypeSets(tv.name, t.name, location);
            }
            else 
            if (t instanceof TypeConstant) {
                this._unifyConstant(t, tv, location);
            }
            else 
            if (t instanceof TypeList) {
                if (tv.name in this.typeSets) {
                    var ts = this.typeSets[tv.name];
                    // Unify the list with each member of the set. 
                    for (var tb of ts) 
                        this._unifyList(t, tb, location);
                    ts.push(t);
                }
                else {
                    this.typeSets[tv.name] = [t];
                }
                this._logError("Unifying constant with list", location);
            }
            else 
                throw new Error("Unrecognized destination type of constraint");
        }

        // Unifies a type list with any type expression
        _unifyList(tl:TypeList, t:TypeExpr, location:any) {
            if (t instanceof TypeVariable) {
                // Logic implemented in _unifyVariable
                this._unifyVariable(t, tl, location);
            }
            else 
            if (t instanceof TypeConstant) {
                // Logic implemented in _unifyConstant
                this._unifyConstant(t, tl, location);
            }
            else 
            if (t instanceof TypeList) {
                if (tl.types.length != t.types.length) 
                    this._logError("Source and target type lists aren't the same length.", location);

                // Unify the type variables in the two lists
                for (var i=0; i < t.types.length && i < tl.types.length; ++i)
                    this._unifyTypes(t.types[i], tl.types[i], location);
            }
            else 
                throw new Error("Unrecognized destination type of constraint");
        }

        // Unifies two types together 
        _unifyTypes(ta:TypeExpr, tb:TypeExpr, location:any) {
            if (ta instanceof TypeVariable) {
                this._unifyVariable(ta, tb, location);
            }
            else 
            if (ta instanceof TypeConstant) {
                this._unifyConstant(ta, tb, location);
            }
            else 
            if (ta instanceof TypeList) {
                this._unifyList(ta, tb, location);
            }
            else 
                throw new Error("Unrecognized source type");
        }

        // Adds a type expression to a type-set
        _addToTypeSet(varName:string, tx:TypeExpr, location:any) {
            // Adding a typeVariable to a type set indicates we want to unify the two type-sets. 
            if (tx instanceof TypeVariable) {
                this._unifyTypeSets(varName, tx.name, location);
                return;
            }

            // If no type-set exists yet, we create one with the type in it.
            if (!(varName in this.typeSets))
            {
                if (tx instanceof TypeVariable)
                    // Unreachable code, but error is thrown in case of incorrect refactoring.
                    throw new Error("Internal error: unexpected code path reached");
                this.typeSets[varName] = [tx];
                return;
            }

            // Get the type set 
            var ts = this.typeSets[varName];            
            if (tx instanceof TypeConstant) {
                for (var tb of ts)
                    // This will log an error if the types are not the same 
                    this._unifyConstant(tx, tb, location);
                return; 
            }
            else 
            if (tx instanceof TypeList) {
                // Unify each member of the set with the list 
                for (var tb of ts) 
                    this._unifyList(tx, tb, location);

                // Add the typelist to the set 
                ts.push(tx);
            }
            else 
                // Unreachable code, but error is thrown in case of incorrect refactoring.
                throw new Error("Internal error: unexpected code path reached");

        }

        // Unifies the types of a constraint 
        _unifyConstraint(tc:TypeConstraint) {
            this._unifyTypes(tc.typeSrc, tc.typeDest, tc.location);
        }
    }
}
