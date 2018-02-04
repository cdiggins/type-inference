import { Type, Unifier, isFunctionType, TypeVariable, functionType, functionOutput, functionInput, trace, typeVariable, TypeArray } from "./type_inference";


//=========================================================
// A simple helper class for implementing scoped programming languages with names like the lambda calculus.
// This class is more intended as an example of usage of the algorithm than for use in production code    
export class ScopedTypeInferenceEngine 
{
    id : number = 0;
    names : string[] = [];
    types : Type[] = [];
    unifier : Unifier = new Unifier();

    applyFunction(t:Type, args:Type) : Type 
    {
        if (!isFunctionType(t)) 
        {
            // Only variables and functions can be applied 
            if (!(t instanceof TypeVariable))
                throw new Error("Type is neither a function type or a type variable: " + t);

            // Generate a new function type 
            var newInputType = this.introduceVariable(t.name + "_i");
            var newOutputType = this.introduceVariable(t.name + "_o");
            var fxnType = functionType(newInputType, newOutputType);
            fxnType.computeParameters();
            
            // Unify the new function type with the old variable                 
            this.unifier.unifyTypes(t, fxnType);
            t = fxnType;
        }

        // What is the input of the function: unify with the argument
        var input = functionInput(t);
        var output = functionOutput(t);  
        if (trace) this.logState("before function application");
        this.unifier.unifyTypes(input, args);    
        if (trace) this.logState("after function application");
        //return this.unifier.getUnifiedType(output, [], {});
        return output;
    }

    introduceVariable(name:string) : TypeVariable{
        var t = typeVariable(name + '$' + this.id++);
        this.names.push(name);
        this.types.push(t);
        return t;
    }

    lookupOrIntroduceVariable(name:string) : Type {
        var n = this.indexOfVariable(name);
        return (n < 0) ? this.introduceVariable(name) : this.getUnifiedType(this.types[n]);
    }

    assignVariable(name:string, t:Type) : Type {
        return this.unifier.unifyTypes(this.lookupVariable(name), t);
    }

    indexOfVariable(name:string) : number {
        return this.names.lastIndexOf(name);
    }

    lookupVariable(name:string) : Type {
        var n = this.indexOfVariable(name);
        if (n < 0) throw new Error("Could not find variable: " + name);
        return this.getUnifiedType(this.types[n]);
    }

    getUnifiedType(t:Type) : Type {
        var r = this.unifier.getUnifiedType(t, [], {});
        if (r instanceof TypeArray)
            r.computeParameters();
        return r;
    }

    popVariable() {
        this.types.pop();
        this.names.pop();
    }

    get state() : string {
        var r = [];
        for (var i=0; i < this.types.length; ++i) {
            var t = this.types[i];
            var n = this.names[i]
            var u = this.getUnifiedType(t);
            r.push(n + " : " + t + " = " + u);
        }
        return r.join("\n");
    }

    logState(msg:string = "") {
        console.log("Inference engine state " + msg);
        console.log(this.state);
        console.log(this.unifier.state);
    }
}

