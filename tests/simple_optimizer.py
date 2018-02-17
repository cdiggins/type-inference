// https://www.codementor.io/zhuojiadai/julia-vs-r-vs-python-simple-optimization-gnqi4njro

import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm

# generate the data
odr=[0.10,0.20,0.15,0.22,0.15,0.10,0.08,0.09,0.12]
Q_t = norm.ppf(odr)
maxQ_t = max(Q_t)

# define a function that will return a return to optimize based on the input data
def neglik_trunc_tn(Q_t):
    maxQ_t = max(Q_t)
    def neglik_trunc_fn(musigma):
        return -sum(norm.logpdf(Q_t, musigma[0], musigma[1])) + len(Q_t)*norm.logcdf(maxQ_t, musigma[0], musigma[1])
    return neglik_trunc_fn

# the likelihood function to optimize
neglik = neglik_trunc_tn(Q_t)

# optimize!
res = minimize(neglik, [np.mean(Q_t), np.std(Q_t)])
res