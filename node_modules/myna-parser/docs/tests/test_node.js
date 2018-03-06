let m = require('../myna');

for (let r of m.allGrammarRules())
    console.log(r.toString());

process.exit();

