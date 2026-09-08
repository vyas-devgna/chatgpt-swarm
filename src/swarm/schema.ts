/**
 * Valibot schemas for delegation, worker reports, and messages.
 *
 * These schemas are the ONLY trust boundary between ChatGPT model output
 * and extension orchestration. Every delegation and report passes through
 * schema validation before influencing scheduler behavior.
 */

import * as v from 'valibot';
import {
  MAX_AGENT_NAME_LENGTH,
  MAX_AGENT_ROLE_LENGTH,
  MAX_OBJECTIVE_LENGTH,
  MAX_PERSONA_LENGTH,
  MAX_REPORT_LENGTH,
  MAX_TASK_LENGTH,
  MAX_URL_LENGTH,
  MAX_WORKERS,
} from '../shared/constants.js';
import { isChatGPTUrl } from '../shared/utils.js';
import type { SwarmState } from './types.js';

const AgentNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_AGENT_NAME_LENGTH));
const AgentRoleSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_AGENT_ROLE_LENGTH));
const ObjectiveSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_OBJECTIVE_LENGTH));
const TaskSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_TASK_LENGTH));
const PersonaSchema = v.pipe(v.string(), v.maxLength(MAX_PERSONA_LENGTH));
const UrlSchema = v.pipe(
  v.string(),
  v.maxLength(MAX_URL_LENGTH),
  v.url(),
  v.check(isChatGPTUrl, 'URL must use an approved ChatGPT host'),
);
const ReportFieldSchema = v.pipe(v.string(), v.maxLength(MAX_REPORT_LENGTH));

// ─── Model Policy Schema ────────────────────────────────────────────

export const ModelPolicyTypeSchema = v.union([
  v.literal('auto'),
  v.literal('fast'),
  v.literal('deep'),
  v.literal('code'),
  v.literal('research'),
  v.literal('manual'),
]);

// ─── Delegation Schema ──────────────────────────────────────────────

export const DelegationWorkerSchema = v.object({
  name: AgentNameSchema,
  role: AgentRoleSchema,
  task: TaskSchema,
  persona: v.optional(PersonaSchema),
  model_policy: v.optional(
    v.union([
      v.literal('auto'),
      v.literal('fast'),
      v.literal('deep'),
      v.literal('code'),
      v.literal('research'),
    ]),
  ),
});

export const DelegationSchema = v.object({
  swarm_version: v.literal(1),
  objective: ObjectiveSchema,
  workers: v.pipe(v.array(DelegationWorkerSchema), v.maxLength(MAX_WORKERS)),
  review_after: v.optional(v.boolean()),
});

/** Type inferred from the delegation schema. */
export type DelegationInput = v.InferInput<typeof DelegationSchema>;
export type DelegationOutput = v.InferOutput<typeof DelegationSchema>;

// ─── Worker Report Schema ───────────────────────────────────────────

export const WorkerReportSchema = v.object({
  result: v.pipe(ReportFieldSchema, v.minLength(1)),
  evidence: v.optional(ReportFieldSchema, ''),
  risks: v.optional(ReportFieldSchema, ''),
  recommendation: v.optional(ReportFieldSchema, ''),
  openQuestions: v.optional(ReportFieldSchema, ''),
  rawResponse: ReportFieldSchema,
  capturedAt: v.number(),
});

// ─── Message Schemas ────────────────────────────────────────────────

export const WorkerStatusSchema = v.union([
  v.literal('PLANNED'),
  v.literal('CREATING'),
  v.literal('READY'),
  v.literal('RUNNING'),
  v.literal('WAITING'),
  v.literal('REQUIRES_USER'),
  v.literal('COMPLETE'),
  v.literal('FAILED'),
  v.literal('PAUSED'),
  v.literal('STOPPED'),
]);

const SwarmStatusSchema = v.union([
  v.literal('PLANNING'),
  v.literal('DELEGATING'),
  v.literal('RUNNING'),
  v.literal('SYNTHESIZING'),
  v.literal('COMPLETE'),
  v.literal('FAILED'),
  v.literal('PAUSED'),
  v.literal('STOPPED'),
]);

export const SwarmCommandSchema = v.union([
  v.literal('START'),
  v.literal('STOP'),
  v.literal('PAUSE'),
  v.literal('RESUME'),
  v.literal('MERGE_NOW'),
  v.literal('ADD_AGENT'),
  v.literal('RETRY'),
]);

export const AdapterEventSchema = v.union([
  v.literal('PAGE_READY'),
  v.literal('GENERATION_START'),
  v.literal('GENERATION_COMPLETE'),
  v.literal('NAVIGATION'),
  v.literal('ERROR'),
]);

const RuntimeWorkerReportSchema = v.object({
  result: v.pipe(ReportFieldSchema, v.minLength(1)),
  evidence: ReportFieldSchema,
  risks: ReportFieldSchema,
  recommendation: ReportFieldSchema,
  openQuestions: ReportFieldSchema,
  rawResponse: ReportFieldSchema,
  capturedAt: v.number(),
});

const RuntimeDelegationPlanSchema = v.object({
  swarmVersion: v.literal(1),
  objective: ObjectiveSchema,
  workers: v.pipe(
    v.array(
      v.object({
        name: AgentNameSchema,
        role: AgentRoleSchema,
        task: TaskSchema,
        persona: v.optional(PersonaSchema),
        modelPolicy: v.optional(ModelPolicyTypeSchema),
      }),
    ),
    v.maxLength(MAX_WORKERS),
  ),
  reviewAfter: v.boolean(),
});

const PersistedAgentSchema = v.object({
  id: v.string(),
  displayName: AgentNameSchema,
  role: AgentRoleSchema,
  objective: ObjectiveSchema,
  persona: PersonaSchema,
  modelPolicy: v.object({ type: ModelPolicyTypeSchema, manualModel: v.optional(v.string()) }),
  task: TaskSchema,
  status: WorkerStatusSchema,
  conversationId: v.nullable(v.string()),
  conversationUrl: v.nullable(UrlSchema),
  projectId: v.nullable(v.string()),
});

const PersistedWorkerSchema = v.object({
  agent: PersistedAgentSchema,
  tabId: v.nullable(v.number()),
  taskHash: v.string(),
  submissionId: v.string(),
  submittedAt: v.nullable(v.number()),
  report: v.nullable(RuntimeWorkerReportSchema),
  wave: v.union([v.literal(1), v.literal(2)]),
  actualModel: v.nullable(v.string()),
  requestedModel: v.nullable(v.string()),
});

/** Complete schema for persisted state rehydration. */
export const SwarmStateSchema = v.object({
  swarmId: v.string(),
  projectId: v.nullable(v.string()),
  captainConversationUrl: UrlSchema,
  captainTabId: v.nullable(v.number()),
  workers: v.pipe(v.array(PersistedWorkerSchema), v.maxLength(MAX_WORKERS)),
  status: SwarmStatusSchema,
  objective: ObjectiveSchema,
  delegationPlan: v.nullable(RuntimeDelegationPlanSchema),
  memory: v.object({
    objective: ObjectiveSchema,
    findings: v.array(
      v.object({
        content: v.string(),
        sourceAgent: v.string(),
        timestamp: v.number(),
        status: v.union([v.literal('provisional'), v.literal('confirmed'), v.literal('disputed')]),
      }),
    ),
    decisions: v.array(
      v.object({
        content: v.string(),
        rationale: v.string(),
        madeBy: v.string(),
        timestamp: v.number(),
      }),
    ),
    unresolvedQuestions: v.array(v.string()),
    workerReports: v.pipe(
      v.array(
        v.object({
          agentId: v.string(),
          agentName: AgentNameSchema,
          role: AgentRoleSchema,
          resultSummary: v.pipe(v.string(), v.maxLength(500)),
          hasRisks: v.boolean(),
          hasOpenQuestions: v.boolean(),
          capturedAt: v.number(),
        }),
      ),
      v.maxLength(MAX_WORKERS),
    ),
  }),
  schemaVersion: v.literal(1),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Runtime message schema used at every extension messaging boundary. */
export const RuntimeMessageSchema = v.union([
  v.object({ type: v.literal('PING'), payload: v.object({ timestamp: v.number() }) }),
  v.object({ type: v.literal('PAGE_READY'), payload: v.object({ url: UrlSchema }) }),
  v.object({
    type: v.literal('START_SWARM'),
    payload: v.object({
      captainUrl: UrlSchema,
      projectId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
      plan: RuntimeDelegationPlanSchema,
    }),
  }),
  v.object({
    type: v.literal('WORKER_RUNNING'),
    payload: v.object({ swarmId: v.string(), agentId: v.string(), url: UrlSchema }),
  }),
  v.object({
    type: v.literal('WORKER_RESULT'),
    payload: v.object({
      swarmId: v.string(),
      agentId: v.string(),
      report: RuntimeWorkerReportSchema,
    }),
  }),
  v.object({
    type: v.literal('SWARM_COMMAND'),
    payload: v.object({
      command: v.union([
        v.literal('STOP'),
        v.literal('PAUSE'),
        v.literal('RESUME'),
        v.literal('MERGE_NOW'),
        v.literal('RETRY'),
      ]),
      swarmId: v.string(),
      agentId: v.optional(v.string()),
    }),
  }),
  v.object({
    type: v.literal('RUN_WORKER'),
    payload: v.object({
      swarmId: v.string(),
      agentId: v.string(),
      prompt: v.pipe(
        v.string(),
        v.maxLength(MAX_TASK_LENGTH + MAX_PERSONA_LENGTH + MAX_OBJECTIVE_LENGTH),
      ),
    }),
  }),
  v.object({
    type: v.literal('STOP_WORKER'),
    payload: v.object({ swarmId: v.string(), agentId: v.string() }),
  }),
  v.object({
    type: v.literal('SYNTHESIZE'),
    payload: v.object({
      swarmId: v.string(),
      prompt: v.pipe(
        v.string(),
        v.maxLength(MAX_REPORT_LENGTH * MAX_WORKERS + MAX_OBJECTIVE_LENGTH),
      ),
    }),
  }),
]);

export type RuntimeMessageOutput = v.InferOutput<typeof RuntimeMessageSchema>;

/** Validate a message received across an extension boundary. */
export function validateRuntimeMessage(input: unknown): RuntimeMessageOutput | null {
  const result = v.safeParse(RuntimeMessageSchema, input);
  return result.success ? result.output : null;
}

/** Validate persisted state before rehydrating the stateless service worker. */
export function validateSwarmState(input: unknown): SwarmState | null {
  const result = v.safeParse(SwarmStateSchema, input);
  return result.success ? result.output : null;
}

// ─── Validation Helpers ─────────────────────────────────────────────

/**
 * Validate a delegation plan from Captain's response.
 * Returns the validated plan or null if validation fails.
 */
export function validateDelegation(input: unknown): DelegationOutput | null {
  const result = v.safeParse(DelegationSchema, input);
  return result.success ? result.output : null;
}

/**
 * Attempt to extract JSON from a markdown-wrapped response.
 * Captain may wrap JSON in ```json ... ``` code blocks.
 */
export function extractJsonFromResponse(response: string): unknown | null {
  // Try direct JSON parse first
  try {
    return JSON.parse(response);
  } catch {
    // Continue to extraction
  }

  // Try extracting from markdown code block
  const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      // Continue
    }
  }

  // Try finding JSON object in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Give up
    }
  }

  return null;
}

/**
 * Validate a delegation from a raw Captain response string.
 * Handles JSON extraction, validation, and returns typed result.
 */
export function parseDelegationResponse(response: string): {
  success: boolean;
  plan: DelegationOutput | null;
  error: string | null;
} {
  const extracted = extractJsonFromResponse(response);
  if (extracted === null) {
    return { success: false, plan: null, error: 'Could not extract JSON from response' };
  }

  const result = v.safeParse(DelegationSchema, extracted);
  if (result.success) {
    return { success: true, plan: result.output, error: null };
  }

  const issues = result.issues.map((issue) => issue.message).join('; ');
  return { success: false, plan: null, error: `Schema validation failed: ${issues}` };
}
