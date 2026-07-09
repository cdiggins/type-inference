using System;
using System.Threading;
using NUnit.Framework;

namespace TypeInference.Tests
{
    /// <summary>
    /// Verifies the safety harness itself: that infinite recursion, would-be stack
    /// overflows, and non-terminating loops are all converted into fast, catchable
    /// outcomes so no experiment can hang or crash the test runner.
    /// </summary>
    [TestFixture]
    public class TerminationTests
    {
        [Test]
        public void Guard_converts_infinite_recursion_into_a_fast_exception()
        {
            // A cyclic type structure (a TypeArray that contains itself). Walking it would
            // recurse forever / overflow the stack; the depth guard stops it in milliseconds.
            var run = Sandbox.Run(() =>
            {
                var cyclic = new TypeArray(Array.Empty<Type>(), false);
                cyclic.Types.Add(cyclic);                       // <-- the cycle
                return TypeOps.DescendantTypes(cyclic).Count;   // would never terminate
            });

            Assert.That(run.IsFaulted, Is.True, $"expected the guard to fire, got: {run}");
            Assert.That(run.Error, Is.TypeOf<GuardException>(),
                "infinite recursion must surface as a GuardException, never a process-killing StackOverflow");
            Assert.That(run.ElapsedMs, Is.LessThan(2000), "and it must fail fast");
        }

        [Test]
        public void Sandbox_timeout_backstops_a_nonrecursive_infinite_loop()
        {
            // The step guard only counts guarded recursion; a tight non-recursive loop needs
            // the wall-clock backstop. (We sleep rather than spin so no core is burned after
            // the timeout; the background worker exits on its own well before the process does.)
            var run = Sandbox.Run(() =>
            {
                for (var i = 0; i < 100; i++) Thread.Sleep(50); // ~5 s of work
                return 0;
            }, timeoutMs: 300);

            Assert.That(run.IsTimedOut, Is.True, $"expected a timeout, got: {run}");
            Assert.That(run.ElapsedMs, Is.LessThan(2000), "the timeout must return promptly");
        }

        [Test]
        public void Normal_inference_stays_far_under_the_guard_budget()
        {
            Cat.Infer("dup"); // warm up the cached vocabulary

            // Measure the work of a representative real inference in isolation.
            Guard.Reset();
            Cat.InferNormalized("swap quote compose apply pop"); // a non-trivial std term (dip pop)
            var steps = Guard.Steps;

            Assert.That(steps, Is.GreaterThan(0));
            Assert.That(steps, Is.LessThan(Guard.MaxSteps / 10),
                $"real programs must have ample headroom under the budget (used {steps:N0} of {Guard.MaxSteps:N0})");
        }

        [Test]
        public void Guard_depth_limit_is_below_a_real_stack_overflow()
        {
            // Documents the safety margin: the guard trips at a depth the CLR can unwind
            // from, rather than at the true (uncatchable) stack limit.
            Assert.That(Guard.MaxDepth, Is.LessThan(10000));
        }
    }
}
