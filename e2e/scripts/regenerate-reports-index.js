const fs = require('fs');
const path = require('path');

// Rebuilds reports/README.md from scratch by scanning the reports/ directory —
// stateless and idempotent, so unlike the old read-then-prepend approach it can
// never produce a git merge conflict (two runs regenerating it always converge
// on the same content once both report files exist on disk).
function regenerateReportsIndex(reportsDir) {
  const files = fs.readdirSync(reportsDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse();

  const lines = [
    '# E2E run reports',
    '',
    'Generated automatically at the end of each `npx playwright test` run — newest first.',
    '',
  ];

  for (const file of files) {
    const content = fs.readFileSync(path.join(reportsDir, file), 'utf-8');
    const overallMatch = content.match(/^\*\*Overall:\*\* (.+)$/m);
    lines.push(`- [${file}](./${file}) — ${overallMatch ? overallMatch[1] : '(summary unavailable)'}`);
  }

  fs.writeFileSync(path.join(reportsDir, 'README.md'), lines.join('\n') + '\n', 'utf-8');
  return files.length;
}

module.exports = { regenerateReportsIndex };

if (require.main === module) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'reports');
  const count = regenerateReportsIndex(dir);
  console.log(`Regenerated reports/README.md from ${count} report file(s) in ${dir}`);
}
