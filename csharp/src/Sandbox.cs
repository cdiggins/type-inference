using System;
using System.Diagnostics;
using System.Threading;

namespace TypeInference
{
    public enum RunStatus { Ok, Faulted, TimedOut }

    /// <summary>Outcome of running a guarded computation in the sandbox.</summary>
    public sealed class RunResult<T>
    {
        public RunStatus Status { get; }
        public T Value { get; }
        public Exception Error { get; }
        public long ElapsedMs { get; }

        private RunResult(RunStatus s, T v, Exception e, long ms)
        {
            Status = s; Value = v; Error = e; ElapsedMs = ms;
        }

        public static RunResult<T> Ok(T v, long ms) => new(RunStatus.Ok, v, null, ms);
        public static RunResult<T> Faulted(Exception e, long ms) => new(RunStatus.Faulted, default, e, ms);
        public static RunResult<T> TimedOut(long ms) => new(RunStatus.TimedOut, default, null, ms);

        public bool IsOk => Status == RunStatus.Ok;
        public bool IsFaulted => Status == RunStatus.Faulted;
        public bool IsTimedOut => Status == RunStatus.TimedOut;

        /// <summary>The innermost message, whatever the failure mode was.</summary>
        public string FailureMessage =>
            Status switch
            {
                RunStatus.Faulted => Error.Message,
                RunStatus.TimedOut => $"timed out after ~{ElapsedMs} ms",
                _ => null
            };

        public override string ToString() => Status switch
        {
            RunStatus.Ok => $"OK ({ElapsedMs} ms): {Value}",
            RunStatus.Faulted => $"FAULT ({ElapsedMs} ms): {Error.GetType().Name}: {Error.Message}",
            _ => $"TIMEOUT (>{ElapsedMs} ms)"
        };
    }

    /// <summary>
    /// Runs a possibly-dangerous computation on a dedicated worker thread with a large
    /// stack and a wall-clock timeout.
    ///
    /// The in-algorithm <see cref="Guard"/> is the primary, deterministic defense; this
    /// sandbox adds (a) a big isolated stack so the depth guard fires long before a real
    /// stack overflow, and (b) a hard wall-clock backstop. A runaway worker is a
    /// background thread and will self-terminate via the Guard's step budget, so it can
    /// never block the process or a subsequent test.
    /// </summary>
    public static class Sandbox
    {
        public static RunResult<T> Run<T>(Func<T> f, int timeoutMs = 2000, int stackMb = 16)
        {
            Exception error = null;
            T value = default;
            var sw = Stopwatch.StartNew();

            var thread = new Thread(() =>
            {
                try { Guard.Reset(); value = f(); }
                catch (Exception e) { error = e; }
            }, stackMb * 1024 * 1024)
            {
                IsBackground = true,
                Name = "ti-sandbox"
            };

            thread.Start();
            if (!thread.Join(timeoutMs))
                return RunResult<T>.TimedOut(sw.ElapsedMilliseconds);

            sw.Stop();
            return error != null
                ? RunResult<T>.Faulted(error, sw.ElapsedMilliseconds)
                : RunResult<T>.Ok(value, sw.ElapsedMilliseconds);
        }
    }
}
