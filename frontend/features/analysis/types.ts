/**
 * Public types for the AI analysis pipeline.
 *
 * These are the contract between the runner, the UI, and any
 * future real AI provider. A real implementation MUST emit
 * the same stage list, the same status values, and the same
 * percent range so the UI does not have to change.
 *
 * Kept in a tiny standalone file so both the runner and the
 * UI can import without pulling in any of each other's
 * dependencies.
 */

export type AnalysisStageId =
  | "profile"
  | "dna"
  | "scores"
  | "decision"
  | "recommendations"
  | "advisor";

export type AnalysisStatus = "running" | "complete" | "failed";

export interface AnalysisStage {
  id: AnalysisStageId;
  label: string;
  description: string;
  /** Weight of this stage in the overall progress. */
  weight: number;
}

export interface AnalysisRunHandle
  extends AsyncIterableIterator<{
    /** Index of the stage that just completed. -1 = run is starting. */
    completedIndex: number;
    /** Cumulative progress 0..100. */
    percent: number;
    status: AnalysisStatus;
  }> {}
