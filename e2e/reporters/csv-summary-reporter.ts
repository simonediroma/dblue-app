import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes a Markdown summary of the run to e2e/reports/<timestamp>.md, grouped by the
 * CSV Area (the enclosing `describe('CSV coverage — <Area>')` title) with one row per
 * [H-XX] test. Tests outside the CSV-coverage convention (the 11 pre-existing
 * regression/smoke files) are aggregated per file instead of row-by-row.
 *
 * Committed to the repo (not just an artifact) so the result history survives across
 * CI runs — see .github/workflows/e2e.yml and e2e/README.md.
 */

interface Row {
  hId: string | null;
  title: string;
  area: string;
  status: TestResult['status'];
  errorMessage?: string;
  errorDetail?: string;
  location?: string;
  file: string;
}

const MAX_DETAIL_LENGTH = 4000;

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

const STATUS_ICON: Record<TestResult['status'], string> = {
  passed: '✅',
  failed: '❌',
  timedOut: '⏱️',
  skipped: '⏭️',
  interrupted: '⏹️',
};

export default class CsvSummaryReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = new Date();

  onTestEnd(test: TestCase, result: TestResult): void {
    const title = test.title;
    const match = title.match(/\[(H-\d+[a-z]?)\]/i);
    const error = result.errors[0];

    const rawFirstLine = error?.message?.split('\n')[0];
    const errorMessage = rawFirstLine ? stripAnsi(rawFirstLine).replace(/\|/g, '\\|') : undefined;

    // Full message (includes the expected/received diff) + source snippet (the failing
    // line with surrounding context) — this is the part meant to be read directly from
    // the committed file to diagnose a failure without opening the HTML report/trace.
    let errorDetail: string | undefined;
    let location: string | undefined;
    if (error) {
      const parts = [error.message, error.snippet].filter((p): p is string => !!p).map(stripAnsi);
      const joined = parts.join('\n\n').trim();
      if (joined) {
        errorDetail = joined.length > MAX_DETAIL_LENGTH
          ? `${joined.slice(0, MAX_DETAIL_LENGTH)}\n… (truncated)`
          : joined;
      }
      if (error.location) {
        location = `${path.basename(error.location.file)}:${error.location.line}:${error.location.column}`;
      }
    }

    this.rows.push({
      hId: match ? match[1].toUpperCase() : null,
      title,
      area: test.parent.title,
      status: result.status,
      errorMessage,
      errorDetail,
      location,
      file: path.basename(test.location.file),
    });
  }

  onEnd(result: FullResult): void {
    // `playwright test --list` (and any other zero-test invocation) still calls onEnd —
    // skip writing so it never pollutes the committed report history with an empty run.
    if (this.rows.length === 0) return;

    const reportsDir = path.resolve(__dirname, '..', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const timestamp = this.startedAt.toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}.md`;

    fs.writeFileSync(path.join(reportsDir, fileName), this.buildMarkdown(result, timestamp), 'utf-8');
    this.updateIndex(reportsDir, fileName, result);
  }

  private counts(rows: Row[]) {
    return {
      passed: rows.filter((r) => r.status === 'passed').length,
      failed: rows.filter((r) => r.status === 'failed' || r.status === 'timedOut').length,
      skipped: rows.filter((r) => r.status === 'skipped').length,
      total: rows.length,
    };
  }

  private buildMarkdown(result: FullResult, timestamp: string): string {
    const csvRows = this.rows.filter((r) => r.hId !== null && r.area.startsWith('CSV coverage'));
    const otherRows = this.rows.filter((r) => r.hId === null || !r.area.startsWith('CSV coverage'));
    const overall = this.counts(this.rows);

    const lines: string[] = [
      `# E2E Run Summary — ${timestamp}`,
      '',
      `**Target:** ${process.env.BASE_URL ?? '(not set)'}`,
      `**Overall:** ${overall.passed} passed, ${overall.failed} failed, ${overall.skipped} skipped (${overall.total} total) — run status: ${result.status}`,
      '',
      '## CSV coverage',
      '',
    ];

    const areaMap = new Map<string, Row[]>();
    for (const row of csvRows) {
      const areaName = row.area.replace(/^CSV coverage — /, '');
      if (!areaMap.has(areaName)) areaMap.set(areaName, []);
      areaMap.get(areaName)!.push(row);
    }

    for (const [areaName, rows] of [...areaMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${areaName}`, '', '| Ref | Test | Esito |', '|---|---|---|');
      const sorted = [...rows].sort((a, b) => (a.hId ?? '').localeCompare(b.hId ?? '', undefined, { numeric: true }));
      for (const row of sorted) {
        const icon = STATUS_ICON[row.status] ?? row.status;
        const cleanTitle = row.title.replace(/^\[H-\d+[a-z]?\]\s*/i, '').replace(/\|/g, '\\|');
        const errSuffix = row.errorMessage ? ` — ${row.errorMessage}` : '';
        lines.push(`| ${row.hId} | ${cleanTitle} | ${icon} ${row.status}${errSuffix} |`);
      }
      lines.push('');
      lines.push(...this.renderErrorDetails(sorted, (row) => row.hId ?? row.title));
    }

    lines.push('## Altri test (regressione / smoke pre-esistenti)', '', '| File | Pass | Fail | Skip | Totale |', '|---|---|---|---|---|');
    const byFile = new Map<string, Row[]>();
    for (const row of otherRows) {
      if (!byFile.has(row.file)) byFile.set(row.file, []);
      byFile.get(row.file)!.push(row);
    }
    for (const [file, rows] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const c = this.counts(rows);
      lines.push(`| ${file} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.total} |`);
    }
    lines.push('');
    lines.push(...this.renderErrorDetails(otherRows, (row) => `${row.file} — ${row.title}`));

    return lines.join('\n');
  }

  // One <details> block per failed/timed-out test with captured error detail — full
  // message (expected/received diff included) + source snippet, so a failure can be
  // diagnosed directly from the committed file without opening the HTML report/trace.
  // <details> is a plain HTML tag: GitHub renders it collapsed, but the raw text (and
  // therefore every byte of the error) is still there for anyone/anything reading the
  // file as plain text.
  private renderErrorDetails(rows: Row[], label: (row: Row) => string): string[] {
    const withDetail = rows.filter((r) => r.errorDetail);
    if (withDetail.length === 0) return [];

    const lines: string[] = [];
    for (const row of withDetail) {
      const heading = row.location ? `${label(row)} (${row.location})` : label(row);
      lines.push('<details>', `<summary>${heading}</summary>`, '', '```', row.errorDetail!, '```', '', '</details>', '');
    }
    return lines;
  }

  private updateIndex(reportsDir: string, fileName: string, result: FullResult): void {
    const indexPath = path.join(reportsDir, 'README.md');
    const overall = this.counts(this.rows);
    const summaryLine = `- [${fileName}](./${fileName}) — ${overall.passed} passed, ${overall.failed} failed, ${overall.skipped} skipped — run status: ${result.status}`;

    const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';
    const previousEntries = existing.split('\n').filter((l) => l.startsWith('- ['));
    const header = '# E2E run reports\n\nGenerated automatically at the end of each `npx playwright test` run — newest first.\n\n';

    fs.writeFileSync(indexPath, header + [summaryLine, ...previousEntries].join('\n') + '\n', 'utf-8');
  }
}
