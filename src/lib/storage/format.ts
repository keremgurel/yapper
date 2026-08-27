export function formatStorageBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  if (safe === 0) return "0 B";
  const unit = Math.min(
    units.length - 1,
    Math.floor(Math.log(safe) / Math.log(1024)),
  );
  const value = safe / 1024 ** unit;
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function storageUsagePercent(used: number, quota: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, Math.max(0, (used / quota) * 100));
}
