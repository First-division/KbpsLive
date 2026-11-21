export function getIOSMajorVersion(version: unknown): number | null {
  if (typeof version === 'number') {
    if (!Number.isFinite(version)) {
      return null;
    }

    return Math.trunc(version);
  }

  if (typeof version !== 'string') {
    return null;
  }

  const normalized = version.trim();
  if (!normalized) {
    return null;
  }

  const majorSegment = normalized.split('.')[0];
  const parsed = Number.parseInt(majorSegment, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function supportsIOSNativeTabCompaction(version: unknown): boolean {
  const majorVersion = getIOSMajorVersion(version);
  return majorVersion !== null && majorVersion >= 26;
}
