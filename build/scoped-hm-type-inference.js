"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_system_1 = require("./type-system");
//=========================================================
// A simple helper class for implementing scoped programming languages with names like the lambda calculus.
// This class is more intended as an example of usage of the algorithm than for use in production code    
var ScopedTypeInferenceEngine = /** @class */ (function () {
    function ScopedTypeInferenceEngine() {
        this.id = 0;
        this.names = [];
        this.types = [];
        this.unifier = new type_system_1.Unifier();
    }
    ScopedTypeInferenceEngine.prototype.applyFunction = function (t, args) {
        if (!type_system_1.isFunctionType(t)) {
            // Only variables and functions can be applied 
            if (!(t instanceof type_system_1.TypeVariable))
                throw new Error("Type is neither a function type or a type variable: " + t);
            // Generate a new function type 
            var newInputType = this.introduceVariable(t.name + "_i");
            var newOutputType = this.introduceVariable(t.name + "_o");
            var fxnType = type_system_1.functionType(newInputType, newOutputType);
            fxnType.computeParameters();
            // Unify the new function type with the old variable                 
            this.unifier.unifyTypes(t, fxnType);
            t = fxnType;
        }
        // What is the input of the function: unify with the argument
        var input = type_system_1.functionInput(t);
        var output = type_system_1.functionOutput(t);
        if (type_system_1.trace)
            this.logState("before function application");
        this.unifier.unifyTypes(input, args);
        if (type_system_1.trace)
            this.logState("after function application");
        //return this.unifier.getUnifiedType(output, [], {});
        return output;
    };
    ScopedTypeInferenceEngine.prototype.introduceVariable = function (name) {
        var t = type_system_1.typeVariable(name + '$' + this.id++);
        this.names.push(name);
        this.types.push(t);
        return t;
    };
    ScopedTypeInferenceEngine.prototype.lookupOrIntroduceVariable = function (name) {
        var n = this.indexOfVariable(name);
        return (n < 0) ? this.introduceVariable(name) : this.getUnifiedType(this.types[n]);
    };
    ScopedTypeInferenceEngine.prototype.assignVariable = function (name, t) {
        return this.unifier.unifyTypes(this.lookupVariable(name), t);
    };
    ScopedTypeInferenceEngine.prototype.indexOfVariable = function (name) {
        return this.names.lastIndexOf(name);
    };
    ScopedTypeInferenceEngine.prototype.lookupVariable = function (name) {
        var n = this.indexOfVariable(name);
        if (n < 0)
            throw new Error("Could not find variable: " + name);
        return this.getUnifiedType(this.types[n]);
    };
    ScopedTypeInferenceEngine.prototype.getUnifiedType = function (t) {
        var r = this.unifier.getUnifiedType(t, [], {});
        if (r instanceof type_system_1.TypeArray)
            r.computeParameters();
        return r;
    };
    ScopedTypeInferenceEngine.prototype.popVariable = function () {
        this.types.pop();
        this.names.pop();
    };
    Object.defineProperty(ScopedTypeInferenceEngine.prototype, "state", {
        get: function () {
            var r = [];
            for (var i = 0; i < this.types.length; ++i) {
                var t = this.types[i];
                var n = this.names[i];
                var u = this.getUnifiedType(t);
                r.push(n + " : " + t + " = " + u);
            }
            return r.join("\n");
        },
        enumerable: true,
        configurable: true
    });
    ScopedTypeInferenceEngine.prototype.logState = function (msg) {
        if (msg === void 0) { msg = ""; }
        console.log("Inference engine state " + msg);
        console.log(this.state);
        console.log(this.unifier.state);
    };
    return ScopedTypeInferenceEngine;
}());
exports.ScopedTypeInferenceEngine = ScopedTypeInferenceEngine;
//# sourceMappingURL=scoped-hm-type-inference.js.map