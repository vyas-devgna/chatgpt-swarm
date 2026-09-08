/**
 * Valibot schemas for delegation, worker reports, and messages.
 *
 * These schemas are the ONLY trust boundary between ChatGPT model output
 * and extension orchestration. Every delegation and report passes through
 * schema validation before influencing scheduler behavior.
 */

import * as v from 'valibot';
import { MAX_WORKERS } from '../shared/constants.js';

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
  name: v.pipe(v.string(), v.minLength(1)),
  role: v.pipe(v.string(), v.minLength(1)),
  task: v.pipe(v.string(), v.minLength(1)),
  persona: v.optional(v.string()),
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
  objective: v.pipe(v.string(), v.minLength(1)),
  workers: v.pipe(
    v.array(DelegationWorkerSchema),
    v.maxLength(MAX_WORKERS),
  ),
  review_after: v.optional(v.boolean()),
});

/** Type inferred from the delegation schema. */
export type DelegationInput = v.InferInput<typeof DelegationSchema>;
export type DelegationOutput = v.InferOutput<typeof DelegationSchema>;

// ─── Worker Report Schema ───────────────────────────────────────────

export const WorkerReportSchema = v.object({
  result: v.pipe(v.string(), v.minLength(1)),
  evidence: v.optional(v.string(), ''),
  risks: v.optional(v.string(), ''),
  recommendation: v.optional(v.string(), ''),
  openQuestions: v.optional(v.string(), ''),
  rawResponse: v.string(),
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
