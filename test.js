"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var type_inference_1 = require("./type_inference");
{
    console.log("Constraint Tests");
    {
        console.log("");
        console.log("## Test A");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test B");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeVariable('U'));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInference.TypeConstant('int'));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t1, t2);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test C");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeConstant('int'), new type_inference_1.TypeInference.TypeVariable('U')]));
        var t2 = te.addVarConstraint('z', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('V'), new type_inference_1.TypeInference.TypeConstant('float')]));
        var t3 = te.addVarConstraint('r', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('U'), new type_inference_1.TypeInference.TypeVariable('V')]));
        te.addTypeConstraint(t0, t1);
        te.addTypeConstraint(t0, t2);
        te.addReturnStatement(t3, null);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Recursion");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeVariable('T'));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('T'), new type_inference_1.TypeInference.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
    {
        console.log("");
        console.log("## Test Row Variables");
        var te = new type_inference_1.TypeInference.Engine();
        var t0 = te.addVarConstraint('x', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeVariable('T'), new type_inference_1.TypeInference.TypeVariable('U')]));
        var t1 = te.addVarConstraint('y', new type_inference_1.TypeInference.TypeList([new type_inference_1.TypeInference.TypeConstant('int'), new type_inference_1.TypeInference.TypeConstant('float'), new type_inference_1.TypeInference.TypeConstant('float')]));
        te.addTypeConstraint(t0, t1);
        te.resolve();
        te.logState();
    }
}
process.exit();
//# sourceMappingURL=test.js.map