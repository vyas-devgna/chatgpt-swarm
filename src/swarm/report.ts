import { MAX_REPORT_LENGTH } from '../shared/constants.js';
import { truncate } from '../shared/utils.js';
import type { WorkerReport } from './types.js';

/** Parse the stable human-readable worker report format without requiring brittle JSON. */
export function parseWorkerReport(rawResponse: string, capturedAt = Date.now()): WorkerReport {
  const read = (heading: string, next: string): string => {
    const match = rawResponse.match(
      new RegExp(`##\\s*${heading}\\s*([\\s\\S]*?)(?=##\\s*(?:${next})|$)`, 'i'),
    );
    return match?.[1]?.trim() ?? '';
  };
  return {
    result:
      read('Result', 'Evidence|Risks|Recommendation|Open Questions') ||
      truncate(rawResponse, 2_000),
    evidence: read('Evidence', 'Risks|Recommendation|Open Questions'),
    risks: read('Risks', 'Recommendation|Open Questions'),
    recommendation: read('Recommendation', 'Open Questions'),
    openQuestions: read('Open Questions', '(?!)'),
    rawResponse: truncate(rawResponse, MAX_REPORT_LENGTH),
    capturedAt,
  };
}
