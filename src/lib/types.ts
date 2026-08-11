export type DataType = "numeric" | "text" | "date" | "boolean" | "category";

export type PriorityLevel = "high" | "medium" | "low";

export type ConfidenceLevel = "high" | "medium" | "low";

export type AnalysisStatus = "pending" | "running" | "completed" | "error";

export interface Dataset {
  id: string;
  name: string;
  fileType: "csv" | "xlsx";
  rows: number;
  columns: number;
  size: number;
  qualityScore: number;
  uploadedAt: Date;
}

export interface Column {
  id: string;
  name: string;
  type: DataType;
  missingValues: number;
  uniqueValues: number;
  sampleValues: any[];
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  confidence: ConfidenceLevel;
  evidence: Evidence[];
  createdAt: Date;
}

export interface Evidence {
  type: "correlation" | "trend" | "anomaly" | "statistic";
  value: string;
  description: string;
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: AnalysisStatus;
  duration?: number;
  details?: string;
}

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

export interface WhatIfVariable {
  id: string;
  name: string;
  min: number;
  max: number;
  current: number;
  step: number;
}

export interface QualityIssue {
  id: string;
  dimension: string;
  severity: PriorityLevel;
  affectedColumns: string[];
  affectedRows: number;
  description: string;
  recommendedAction: string;
}
