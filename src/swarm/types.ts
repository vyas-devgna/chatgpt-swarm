/**
 * Core domain types for ChatGPT Swarm.
 *
 * These types define the fundamental data model for swarm orchestration,
 * agent identity, worker lifecycle, and inter-context communication.
 */

// ─── Worker Lifecycle ───────────────────────────────────────────────

/** Worker states form a forward-moving state machine with controlled backward edges. */
export type WorkerStatus =
  | 'PLANNED'
  | 'CREATING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING'
  | 'REQUIRES_USER'
  | 'COMPLETE'
  | 'FAILED'
  | 'PAUSED'
  | 'STOPPED';

/** Swarm-level status. */
export type SwarmStatus =
  | 'PLANNING'
  | 'DELEGATING'
  | 'RUNNING'
  | 'SYNTHESIZING'
  | 'COMPLETE'
  | 'FAILED'
  | 'STOPPED';

// ─── Agent Identity ─────────────────────────────────────────────────

/** First-class agent identity with persona and model policy. */
export interface AgentIdentity {
  /** Unique agent ID (UUID v4). */
  readonly id: string;
  /** Human-readable display name (e.g., "Iris"). */
  displayName: string;
  /** Functional role (e.g., "Architecture Analyst"). */
  role: string;
  /** What this agent should accomplish. */
  objective: string;
  /** Behavioral persona guiding the agent's reasoning style. */
  persona: string;
  /** Model selection policy. */
  modelPolicy: ModelPolicy;
  /** The task assigned to this agent. */
  task: string;
  /** Current lifecycle status. */
  status: WorkerStatus;
  /** ChatGPT conversation ID (extracted from URL). */
  conversationId: string | null;
  /** Full ChatGPT conversation URL. */
  conversationUrl: string | null;
  /** ChatGPT Project ID this agent belongs to. */
  projectId: string | null;
}

// ─── Model Policy ───────────────────────────────────────────────────

/** How the extension should select a model for an agent. */
export type ModelPolicyType = 'auto' | 'fast' | 'deep' | 'code' | 'research' | 'manual';

export interface ModelPolicy {
  type: ModelPolicyType;
  /** Specific model name if type is 'manual'. */
  manualModel?: string;
}

/** Information about an available ChatGPT model. */
export interface ModelInfo {
  /** Model display name as shown in the UI. */
  name: string;
  /** Capability tags inferred from the model name/description. */
  capabilities: string[];
  /** Whether this model is currently selected. */
  isSelected: boolean;
}

// ─── Swarm State ────────────────────────────────────────────────────

/** Complete persisted state for one swarm execution. */
export interface SwarmState {
  /** Unique swarm ID (UUID v4). */
  readonly swarmId: string;
  /** ChatGPT Project ID. */
  projectId: string | null;
  /** Captain conversation URL. */
  captainConversationUrl: string;
  /** Captain tab ID (transient — may change). */
  captainTabId: number | null;
  /** Worker records. */
  workers: WorkerRecord[];
  /** Swarm-level status. */
  status: SwarmStatus;
  /** User's original objective. */
  objective: string;
  /** Delegation plan from Captain. */
  delegationPlan: DelegationPlan | null;
  /** Swarm working memory. */
  memory: SwarmWorkingMemory;
  /** Schema version for migration. */
  schemaVersion: number;
  /** Timestamps. */
  createdAt: number;
  updatedAt: number;
}

/** Persisted record for a single worker. */
export interface WorkerRecord {
  /** Agent identity. */
  agent: AgentIdentity;
  /** Chrome tab ID (transient). */
  tabId: number | null;
  /** Hash of the task content for duplicate prevention. */
  taskHash: string;
  /** Unique submission ID. */
  submissionId: string;
  /** When the task was submitted. */
  submittedAt: number | null;
  /** Extracted worker report (null until complete). */
  report: WorkerReport | null;
  /** Which wave this worker belongs to (1 or 2). */
  wave: number;
  /** Model actually used (may differ from policy due to fallback). */
  actualModel: string | null;
  /** If a fallback model was used, what was originally requested. */
  requestedModel: string | null;
}

// ─── Delegation ─────────────────────────────────────────────────────

/** Validated delegation plan from Captain. */
export interface DelegationPlan {
  swarmVersion: number;
  objective: string;
  workers: DelegationWorker[];
  reviewAfter: boolean;
}

/** A single worker entry in the delegation plan. */
export interface DelegationWorker {
  name: string;
  role: string;
  task: string;
  persona?: string;
  modelPolicy?: ModelPolicyType;
}

// ─── Worker Reports ─────────────────────────────────────────────────

/** Structured report extracted from a worker's completed response. */
export interface WorkerReport {
  /** The main result/answer. */
  result: string;
  /** Supporting evidence cited by the worker. */
  evidence: string;
  /** Risks or concerns identified. */
  risks: string;
  /** Worker's recommendation. */
  recommendation: string;
  /** Unresolved questions. */
  openQuestions: string;
  /** Raw full response text (for fallback). */
  rawResponse: string;
  /** When the report was captured. */
  capturedAt: number;
}

// ─── Working Memory ─────────────────────────────────────────────────

/** Lightweight swarm working memory — NOT a vector store, NOT an embedding. */
export interface SwarmWorkingMemory {
  objective: string;
  findings: Finding[];
  decisions: Decision[];
  unresolvedQuestions: string[];
  workerReports: WorkerReportSummary[];
}

/** A finding from a worker with provenance. */
export interface Finding {
  content: string;
  sourceAgent: string;
  timestamp: number;
  status: 'provisional' | 'confirmed' | 'disputed';
}

/** A decision made during swarm execution. */
export interface Decision {
  content: string;
  rationale: string;
  madeBy: string;
  timestamp: number;
}

/** Compact summary of a worker report for memory. */
export interface WorkerReportSummary {
  agentId: string;
  agentName: string;
  role: string;
  resultSummary: string;
  hasRisks: boolean;
  hasOpenQuestions: boolean;
  capturedAt: number;
}

// ─── Adapter Types ──────────────────────────────────────────────────

/** Result of a capability detection with confidence scoring. */
export interface CapabilityResult<T> {
  /** The detected value, or null if detection failed. */
  value: T | null;
  /** Confidence score 0.0–1.0. */
  confidence: number;
  /** Which detection strategy succeeded. */
  strategy: string;
  /** Which strategies were attempted but failed. */
  fallbacksUsed: string[];
}

/** ChatGPT generation state. */
export type GenerationState = 'idle' | 'streaming' | 'complete' | 'error';

/** Detected ChatGPT project information. */
export interface ProjectInfo {
  /** Project identifier (from URL or DOM). */
  projectId: string;
  /** Project display name. */
  projectName: string;
}

// ─── Messaging ──────────────────────────────────────────────────────

/** Discriminated union of all cross-context messages. */
export type SwarmMessage =
  | { type: 'WORKER_CREATE'; payload: WorkerCreatePayload }
  | { type: 'WORKER_STATUS'; payload: WorkerStatusPayload }
  | { type: 'WORKER_RESULT'; payload: WorkerResultPayload }
  | { type: 'SWARM_COMMAND'; payload: SwarmCommandPayload }
  | { type: 'ADAPTER_EVENT'; payload: AdapterEventPayload }
  | { type: 'CAPABILITY_CHECK'; payload: CapabilityCheckPayload }
  | { type: 'PING'; payload: PingPayload };

export interface WorkerCreatePayload {
  swarmId: string;
  agent: AgentIdentity;
  projectId: string | null;
}

export interface WorkerStatusPayload {
  swarmId: string;
  agentId: string;
  status: WorkerStatus;
  tabId?: number;
  conversationUrl?: string;
}

export interface WorkerResultPayload {
  swarmId: string;
  agentId: string;
  report: WorkerReport;
}

export interface SwarmCommandPayload {
  command: 'START' | 'STOP' | 'PAUSE' | 'RESUME' | 'MERGE_NOW' | 'ADD_AGENT' | 'RETRY';
  swarmId: string;
  agentId?: string;
  data?: Record<string, unknown>;
}

export interface AdapterEventPayload {
  event: 'PAGE_READY' | 'GENERATION_START' | 'GENERATION_COMPLETE' | 'NAVIGATION' | 'ERROR';
  tabId: number;
  data?: Record<string, unknown>;
}

export interface CapabilityCheckPayload {
  tabId: number;
  capabilities: Record<string, { confidence: number; strategy: string }>;
}

export interface PingPayload {
  timestamp: number;
}
