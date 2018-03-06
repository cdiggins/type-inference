/*{
let $ = {
    at: (xs, i) => xs[i],
}

function x(obj) { return obj.x; }
function y(obj) { return obj.y; }
function z(obj) { return obj.z; }
function vector(x, y, z)
{
return  { x : x, y : y, z : z } ;
}
function vector(xs)
{
return (vector)($.at((xs), 0), $.at((xs), 1), $.at((xs), 2));
}
let origin = (vector)(0, 0, 0);
let ones = (vector)(1, 1, 1);
let xaxis = (vector)(1, 0, 0);
let yaxis = (vector)(0, 1, 0);
let zaxis = (vector)(0, 0, 1);
function array(v)
{
return $.array(x(v), y(v), z(v));
}
function zip(a, b, op)
{
return vector((zip)(array(a), array(b), op));
}
function map(v, op)
{
return vector((map(array(v)))(op));
}
function sum(v)
{
return (op_pls)((op_pls)(x(v), y(v)), y(v));
}
function dot(a, b)
{
return (sum)((op_mul)(a, b));
}
function length(v)
{
return (sqrt)(length2(v));
}
function length2(v)
{
return (dot(v))(v);
}
function op_min(a, b)
{
return (zip)(a, b, op_min);
}
function op_pls(a, b)
{
return (zip)(a, b, op_pls);
}
function op_mul(a, b)
{
return (zip)(a, b, op_mul);
}
function op_div(a, b)
{
return (zip)(a, b, op_div);
}
function op_mod(a, b)
{
return (zip)(a, b, op_mod);
}
function op_eq_eq(a, b)
{
return (zip)(a, b, op_eq_eq);
}
function op_not_eq(a, b)
{
return (zip)(a, b, op_not_eq);
}
function op_gt_eq(a, b)
{
return (zip)(a, b, op_gt_eq);
}
function op_lt_eq(a, b)
{
return (zip)(a, b, op_lt_eq);
}
function op_gt(a, b)
{
return (zip)(a, b, op_gt);
}
function op_lt(a, b)
{
return (zip)(a, b, op_lt);
}
function op_pls(v, x)
{
return (map)(v, (e) => (op_pls)(e, x));
}
function op_min(v, x)
{
return (map)(v, (e) => (op_min)(e, x));
}
function op_mul(v, x)
{
return (map)(v, (e) => (op_mul)(e, x));
}
function op_div(v, x)
{
return (map)(v, (e) => (op_div)(e, x));
}
function op_mod(v, x)
{
return (map)(v, (e) => (op_mod)(e, x));
}
function dist(a, b)
{
return length(((op_min)(a, b)));
}
function dist2(a, b)
{
return length2(((op_min)(a, b)));
}
function normal(v)
{
return (op_div)(v, length(v));
}
function cross(a, b)
{
return (vector3)((op_min)((op_mul)(y(a), z(b)), (op_mul)(z(a), y(b))), (op_min)((op_mul)(z(a), x(b)), (op_mul)(x(a), z(b))), (op_min)((op_mul)(x(a), y(b)), (op_mul)(y(a), x(b))));
}
function reflect(v, n)
{
return (op_min)(v, ((op_mul)((op_mul)(n, (dot)(v, n)), (dot)(v, n))));
}
function clamp(f, min, max)
{
return (op_gt)(f, max) ? max : ((op_lt)(f, min) ? min : f);
}
function clamp(v, min, max)
{
return (vector)((clamp)(x(v), x(min), x(max)), (clamp)(y(v), y(min), y(max)), (clamp)(z(v), z(min), z(max)));
}
function lerp(a, b, x)
{
return (op_pls)((op_mul)(a, ((op_min)(1.0, x))), (op_mul)(b, x));
}
function min(a, b)
{
return (op_lt)(a, b) ? a : b;
}
function max(a, b)
{
return (op_lt)(a, b) ? a : b;
}
function min(a, b)
{
return (zip)(a, b, min);
}
function max(a, b)
{
return (zip)(a, b, max);
}
function sqrt(v)
{
return (map(v))(sqrt);
}
}

*/ 
//# sourceMappingURL=heron-geometry.js.map