"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Standard operations 
exports.catStdOps = {
    papply: "swap quote swap compose",
    dip: "swap quote compose apply",
    dipd: "swap [dip] dip",
    popd: "[pop] dip",
    pop2: "pop pop",
    pop3: "pop pop pop",
    dupd: "[dup] dip",
    dupdd: "[dup] dipd",
    swapd: "[swap] dip",
    swapdd: "[swap] dipd",
    rollup: "swap swapd",
    rolldown: "swapd swap",
    dup3: "dup dup",
    dup4: "dup3 dup",
    dup5: "dup4 dup",
    dup6: "dup5 dup",
    dup7: "dup6 dup",
    dup8: "dup7 dup",
};
//# sourceMappingURL=cat-library.js.map