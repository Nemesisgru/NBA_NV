// Grade from a percentage with the thresholds set by the Admin (bootstrap.settings).
// Same rule as calculate_grade on the server: Y above the Y threshold, then C, W, D.
export function gradeFor(pct, settings) {
  const y = (settings?.y_threshold ?? 0.75) * 100;
  const c = (settings?.c_threshold ?? 0.60) * 100;
  const w = (settings?.w_threshold ?? 0.40) * 100;
  if (pct > y) return 'Y';
  if (pct >= c) return 'C';
  if (pct >= w) return 'W';
  return 'D';
}
