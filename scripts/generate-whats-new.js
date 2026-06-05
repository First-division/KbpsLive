const fs = require('fs');
const path = require('path');

const releaseNotesDir = path.join(__dirname, '..', 'release-notes');
const outputFile = path.join(__dirname, '..', 'constants', 'whats-new.ts');

function readLatestReleaseNote() {
  const files = fs.readdirSync(releaseNotesDir).filter((file) => file.endsWith('.md'));

  if (files.length === 0) {
    throw new Error('No release notes found.');
  }

  const latestFile = files.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[files.length - 1];
  const fullPath = path.join(releaseNotesDir, latestFile);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return { latestFile, raw };
}

function collectSection(raw, heading) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?:\\n## |$)`, 'i');
  const match = raw.match(pattern);
  if (!match) {
    return [];
  }

  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function extractTitle(raw) {
  const match = raw.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "What's New";
}

function extractSummary(raw) {
  const match = raw.match(/## Store Summary\n([\s\S]*?)(?:\n## |$)/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

function extractReleaseLabel(title, latestFile) {
  const titleMatch = title.match(/(\d+\.\d+\.\d+(?:[-\w.]*)?)/);
  if (titleMatch) {
    return titleMatch[1];
  }

  const fileMatch = latestFile.match(/(\d+\.\d+\.\d+(?:[-\w.]*)?)/);
  return fileMatch ? fileMatch[1] : '1.0.0';
}

function buildContent() {
  const { latestFile, raw } = readLatestReleaseNote();
  const title = extractTitle(raw);
  const releaseLabel = extractReleaseLabel(title, latestFile);
  const subtitle = extractSummary(raw) || `Highlights from KBPS Live ${releaseLabel}.`;
  const features = collectSection(raw, 'New Features');
  const bugFixes = collectSection(raw, 'Bug Fixes');
  const guideTip = collectSection(raw, 'Full Release Notes')[0] || 'You can reopen this screen later from Settings.';

  return `export type WhatsNewContent = {
  releaseLabel: string;
  title: string;
  subtitle: string;
  features: string[];
  bugFixes: string[];
  guideTip: string;
};

export const WHATS_NEW_CONTENT: WhatsNewContent = ${JSON.stringify(
    {
      releaseLabel,
      title,
      subtitle,
      features,
      bugFixes,
      guideTip,
    },
    null,
    2
  )};
`;
}

fs.writeFileSync(outputFile, buildContent());
console.log(`Generated ${outputFile}`);