using System;

namespace TypeInference
{
    /// <summary>
    /// Thrown when the recursion-depth or step budget is exceeded. This converts
    /// would-be stack overflows (which are UNCATCHABLE and crash the process in
    /// .NET) and infinite loops into a fast, catchable exception so no experiment
    /// can hang or take down the test runner.
    /// </summary>
    public sealed class GuardException : Exception
    {
        public GuardException(string message) : base(message) { }
    }

    /// <summary>
    /// A per-thread recursion/step budget. Every recursive hot-path in the ported
    /// algorithm opens a <c>using (Guard.Enter())</c> scope.
    ///
    ///  * Depth protects against genuine stack overflow.
    ///  * Steps protects against non-deep infinite loops and exponential blow-up.
    ///
    /// Budgets are deliberately small so pathological inputs fail in milliseconds,
    /// yet far larger than any well-formed type in this study needs.
    /// </summary>
    public static class Guard
    {
        // 3500 frames sits comfortably below a real stack overflow on the 16 MB
        // worker stack that Sandbox uses, but dwarfs the depth of any sane type here.
        public const int MaxDepth = 3500;

        // ~4M recursive entries complete in well under a second.
        public const long MaxSteps = 4_000_000;

        [ThreadStatic] private static int _depth;
        [ThreadStatic] private static long _steps;

        public static int Depth => _depth;
        public static long Steps => _steps;

        /// <summary>Reset the budget. Called by every top-level entry point.</summary>
        public static void Reset() { _depth = 0; _steps = 0; }

        public static Scope Enter()
        {
            if (++_depth > MaxDepth)
            {
                _depth--;
                throw new GuardException(
                    $"Recursion depth limit ({MaxDepth}) exceeded — non-terminating recursion / infinite type.");
            }
            if (++_steps > MaxSteps)
            {
                _depth--;
                throw new GuardException(
                    $"Step budget ({MaxSteps:N0}) exceeded — divergent or exponential inference.");
            }
            return default;
        }

        /// <summary>Disposable scope that decrements the depth counter on exit.</summary>
        public readonly struct Scope : IDisposable
        {
            public void Dispose() { _depth--; }
        }
    }
}
