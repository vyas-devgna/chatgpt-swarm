import { describe, expect, it } from 'vitest';
import { parseWorkerReport } from './report.js';

describe('worker report parser', () => {
  it('extracts every stable heading', () => {
    const report = parseWorkerReport(
      '## Result\nDone\n## Evidence\nTests\n## Risks\nNone\n## Recommendation\nShip\n## Open Questions\nNo questions',
      42,
    );
    expect(report).toMatchObject({
      result: 'Done',
      evidence: 'Tests',
      risks: 'None',
      recommendation: 'Ship',
      openQuestions: 'No questions',
      capturedAt: 42,
    });
  });

  it('falls back to plain response text', () => {
    expect(parseWorkerReport('Plain result', 1).result).toBe('Plain result');
  });
});
