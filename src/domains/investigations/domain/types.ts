/**
 * Investigation domain contracts.
 *
 * These types describe auditable analytical work. They deliberately keep
 * computed evidence separate from AI-generated explanations and conclusions.
 */

export type EntityId = string;
export type IsoDateTime = string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type InvestigationStatus =
  | "draft"
  | "planning"
  | "active"
  | "review"
  | "completed"
  | "cancelled"
  | "archived";

export type InvestigationOrigin = "discovery" | "analyst" | "manual";

export type ClaimKind =
  | "descriptive"
  | "associational"
  | "predictive"
  | "causal"
  | "prescriptive";

export type HypothesisStatus =
  | "proposed"
  | "testing"
  | "supported"
  | "contradicted"
  | "inconclusive";

export type AnalysisRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AnalysisExecution = "browser" | "server" | "remote";

export type AnalysisMethod =
  | "sql"
  | "descriptive-statistics"
  | "statistical-test"
  | "machine-learning"
  | "data-quality"
  | "manual-review"
  | "other";

export interface DatasetSnapshotRef {
  projectId: EntityId;
  sourceId: EntityId;
  assetId?: EntityId;
  sourceVersion: string;
  schemaFingerprint: string;
  contentFingerprint?: string;
}

export type ClaimStudyDesign =
  | "descriptive"
  | "observational"
  | "randomized-experiment"
  | "quasi-experiment"
  | "predictive-evaluation"
  | "other";

export interface ClaimMethodology {
  design: ClaimStudyDesign;
  population?: string;
  exposure?: string;
  outcome?: string;
  confounderStrategy?: string;
  identificationStrategy?: string;
  assumptions: string[];
}

export interface Investigation {
  id: EntityId;
  workspaceId: EntityId;
  projectId: EntityId;
  title: string;
  researchQuestion: string;
  status: InvestigationStatus;
  origin: InvestigationOrigin;
  datasetRefs: DatasetSnapshotRef[];
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Hypothesis {
  id: EntityId;
  investigationId: EntityId;
  statement: string;
  claimKind: ClaimKind;
  methodology: ClaimMethodology;
  status: HypothesisStatus;
  rationale?: string;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AnalysisEngine {
  name: string;
  version: string;
}

export interface AnalysisQuery {
  language: "sql";
  text: string;
  hash: string;
}

export interface AnalysisFailure {
  code: string;
  message: string;
  retriable: boolean;
}

export interface AnalysisRun {
  id: EntityId;
  investigationId: EntityId;
  hypothesisId?: EntityId;
  status: AnalysisRunStatus;
  method: AnalysisMethod;
  execution: AnalysisExecution;
  engine: AnalysisEngine;
  sourceRefs: DatasetSnapshotRef[];
  query?: AnalysisQuery;
  parameters: Record<string, JsonValue>;
  resultHash?: string;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  failure?: AnalysisFailure;
  version: number;
  createdAt: IsoDateTime;
}

export type EvidencePolarity = "supports" | "contradicts" | "neutral";

export type EvidenceKind =
  | "query-result"
  | "statistical-test"
  | "model-evaluation"
  | "data-quality"
  | "visual-review"
  | "literature"
  | "manual-note";

export type EvidenceOrigin =
  | { kind: "analysis-run"; analysisRunId: EntityId }
  | {
      kind: "external-reference";
      citation: {
        title: string;
        locator?: string;
        publisher?: string;
        publishedAt?: IsoDateTime;
      };
    }
  | { kind: "manual-observation"; recordedBy: EntityId };

export type EvidenceAssessmentLevel =
  | "unassessed"
  | "insufficient"
  | "limited"
  | "moderate"
  | "strong";

export interface EvidenceAssessment {
  level: EvidenceAssessmentLevel;
  rationale: string;
  assessedBy?: EntityId;
  assessedAt?: IsoDateTime;
}

export interface EvidenceProvenance {
  method: string;
  computedAt: IsoDateTime;
  schemaFingerprints: string[];
  resultHash?: string;
  queryHash?: string;
  rowCount?: number;
  filters?: JsonValue;
  timeWindow?: {
    from?: IsoDateTime;
    to?: IsoDateTime;
  };
  engine?: AnalysisEngine;
  limitations: string[];
}

export interface EvidenceResult {
  format: "scalar" | "metric" | "table-summary" | "distribution" | "series" | "text";
  value: JsonValue;
}

export interface Evidence {
  id: EntityId;
  investigationId: EntityId;
  hypothesisId?: EntityId;
  title: string;
  summary: string;
  kind: EvidenceKind;
  polarity: EvidencePolarity;
  origin: EvidenceOrigin;
  sourceRefs: DatasetSnapshotRef[];
  result: EvidenceResult;
  provenance: EvidenceProvenance;
  assessment: EvidenceAssessment;
  createdAt: IsoDateTime;
  version: number;
}

export type EvidenceRelation =
  | "supports"
  | "contradicts"
  | "derived-from"
  | "qualifies"
  | "related-to";

export interface EvidenceEdge {
  id: EntityId;
  investigationId: EntityId;
  fromEvidenceId: EntityId;
  toEvidenceId: EntityId;
  relation: EvidenceRelation;
  rationale?: string;
  createdAt: IsoDateTime;
}

export type ConclusionOutcome =
  | "supported"
  | "partially-supported"
  | "not-supported"
  | "inconclusive";

export type ConclusionStatus = "draft" | "in-review" | "approved" | "rejected";

export interface Conclusion {
  id: EntityId;
  investigationId: EntityId;
  hypothesisId?: EntityId;
  statement: string;
  rationale: string;
  outcome: ConclusionOutcome;
  status: ConclusionStatus;
  evidenceIds: EntityId[];
  limitations: string[];
  createdBy: "user" | "assistant";
  approvedBy?: EntityId;
  approvedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
