/**
 * AI analysis pipeline runner.
 *
 * Demo implementation that walks the user through the stages a real
 * AI analyser would execute — Reading Business Profile, Building
 * Business DNA, Computing Health Scores, Running Decision Engine,
 * Generating Recommendations, Preparing Advisor Report.
 *
 * The runner is intentionally framework-agnostic: it returns an
 * async iterator that emits progress events. A future real
 * implementation can swap the internal delays for actual provider
 * calls without changing the consumer API.
 *
 * The consumer drives progress by iterating the handle with
 * `for await (...)`. Cancellation: pass an `AbortSignal`.
 *
 * Reusable contract:
 *   - ANALYSIS_STAGES is exported so the UI renders the same
 *     six steps the runner drives.
 *   - Weight is preserved so the percent calculation stays
 *     correct regardless of the underlying provider.
 */

import {
  type AnalysisRunHandle,
  type AnalysisStage,
  type AnalysisStatus,
} from "./types";

// ---- Stage definitions ---------------------------------------------------- //

/** The canonical, ordered list of analysis stages. */
export const ANALYSIS_STAGES: AnalysisStage[] = [
  {
    id: "profile",
    label: "Reading Business Profile",
    description: "Loading basic info, products, certifications, and history.",
    weight: 10,
  },
  {
    id: "dna",
    label: "Building Business DNA",
    description: "Deriving archetype, strengths, and risk fingerprint.",
    weight: 18,
  },
  {
    id: "scores",
    label: "Computing Health Scores",
    description: "Running the 6-dimension readiness rubric.",
    weight: 16,
  },
  {
    id: "decision",
    label: "Running Decision Engine",
    description: "Evaluating rules, scenarios, and trade-offs.",
    weight: 20,
  },
  {
    id: "recommendations",
    label: "Generating Recommendations",
    description: "Ranking opportunities by impact and effort.",
    weight: 18,
  },
  {
    id: "advisor",
    label: "Preparing Advisor Report",
    description: "Assembling the executive summary and action board.",
    weight: 18,
  },
];

/** Total wall-clock budget for the demo run, in ms. */
const DEFAULT_TOTAL_MS = 4500;
/** Minimum time per stage so the user perceives animation. */
const MIN_STAGE_MS = 350;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

interface RunOptions {
  /** Override total wall-clock. Defaults to 4500ms. */
  totalMs?: number;
  /** Optional abort signal to cancel mid-run. */
  signal?: AbortSignal;
  /** Optional per-tick progress callback (0..100, status). */
  onProgress?: (percent: number, status: AnalysisStatus) => void;
}

interface RunEvent {
  /** Index of the stage that just completed. -1 = run is starting. */
  completedIndex: number;
  /** Cumulative progress percent, 0..100. */
  percent: number;
  /** Current run status. */
  status: AnalysisStatus;
}

/**
 * Run the demo analysis pipeline.
 *
 * The handle is also an `AsyncIterableIterator` so the consumer
 * can use `for await (const tick of runAnalysis())` and stay
 * decoupled from the internals. The handle emits:
 *   - { completedIndex: -1, percent: 0, status: "running" }   — start
 *   - { completedIndex: i, percent, status: "running" }      — each stage done
 *   - { completedIndex: last, percent: 100, status: "complete" } — done
 *
 * Replaces the demo body with a real provider later; the
 * contract stays the same.
 */
export function runAnalysis(options: RunOptions = {}): AnalysisRunHandle {
  const total = options.totalMs ?? DEFAULT_TOTAL_MS;
  const signal = options.signal;
  const totalWeight = ANALYSIS_STAGES.reduce((s, st) => s + st.weight, 0);
  let cumulativeWeight = 0;

  const events: RunEvent[] = [];
  let nextResolve: ((v: IteratorResult<RunEvent>) => void) | null = null;
  let done = false;

  function push(event: RunEvent) {
    options.onProgress?.(event.percent, event.status);
    if (nextResolve) {
      const r = nextResolve;
      nextResolve = null;
      r({ value: event, done: false });
    } else {
      events.push(event);
    }
  }

  function finish() {
    done = true;
    if (nextResolve) {
      const r = nextResolve;
      nextResolve = null;
      r({ value: undefined, done: true });
    }
  }

  async function execute() {
    if (signal?.aborted) {
      push({ completedIndex: -1, percent: 0, status: "failed" });
      finish();
      return;
    }

    push({ completedIndex: -1, percent: 0, status: "running" });

    for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
      const stage = ANALYSIS_STAGES[i]!;
      const stageMs = Math.max(
        MIN_STAGE_MS,
        Math.round((stage.weight / totalWeight) * total),
      );
      try {
        await delay(stageMs, signal);
      } catch {
        push({ completedIndex: i, percent: 0, status: "failed" });
        finish();
        return;
      }
      cumulativeWeight += stage.weight;
      const percent = Math.min(
        100,
        Math.round((cumulativeWeight / totalWeight) * 100),
      );
      const status: AnalysisStatus =
        i === ANALYSIS_STAGES.length - 1 ? "complete" : "running";
      push({ completedIndex: i, percent, status });
    }

    finish();
  }

  void execute();

  const handle: AnalysisRunHandle = {
    next(): Promise<IteratorResult<RunEvent>> {
      if (events.length > 0) {
        return Promise.resolve({ value: events.shift()!, done: false });
      }
      if (done) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise((resolve) => {
        nextResolve = resolve;
      });
    },
    // AsyncIterableIterator needs these; we delegate to next().
    [Symbol.asyncIterator]() {
      return handle;
    },
    return(): Promise<IteratorResult<RunEvent>> {
      done = true;
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(err: unknown): Promise<IteratorResult<RunEvent>> {
      done = true;
      return Promise.reject(err);
    },
  };
  return handle;
}
