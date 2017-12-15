// An example implementation of a type environment. Used to implement a type inference algorithm
// in a typical language with variable tracking and scopes.
export class TypeEnv
{
    inferer : Unifier = new Unifier();
    scopes : ITypeLookup[] = [{}]
    contexts : Unifier[] = [];
    history : ITypeLookup[] = [{}];
    index : number = 0;

    pushScope() {
        var scope = {};
        this.history.push(scope);
        this.scopes.push(scope);
    }

    popScope() {
        this.scopes.pop();
    }

    currentScope() : ITypeLookup {
        return this.scopes[this.scopes.length-1];
    }
    
    pushFunctionContext() {
        this.pushScope();
        this.contexts.push(this.inferer);
        this.inferer = new Unifier();
    }

    popFunctionContext() {
        this.inferer = this.contexts.pop();
        this.popScope();
    }

    addName(name:string) { 
        var scope = this.currentScope();
        if (name in scope) throw new Error("Name already defined in current scope: " + name);
        return scope[name] = null;
    }

    findNameScope(name:string) : ITypeLookup {
        for (var i=this.scopes.length-1; i >= 0; ++i) {
            var scope = this.scopes[i];
            if (name in scope)
                return scope;
        }
        throw new Error("Could not find name in any of the scopes: "+ name)
    }

    addAssignment(name:string, type:Type) : Type { 
        var t = renameTypeVars(type, this.index++);
        var scope = this.findNameScope(name);        
        if (scope[name] == null)
            return scope[name] = t;
        return scope[name] = this.inferer.unifyTypes(scope[name], t);
    }
    
    getName(name:string) : Type { 
        for (var scope of this.scopes)
            if (name in scope)
                return scope[name];
        throw new Error("Could not find name: " + name);
    }

    addFunctionCall(name:string, args:Type[]) : Type { 
        var funcType = this.findNameScope(name)[name] as TypeArray;
        if (funcType == null) throw new Error("Could not find function type: " + name);
        funcType = renameTypeVars(funcType, this.index++) as TypeArray;
        var argsType = typeCons(args);
        var inputs = functionInput(funcType);
        var e = new Unifier();
        e.unifyTypes(input, args);
        return e.getUnifiedType(output) as TypeArray;
       }
}