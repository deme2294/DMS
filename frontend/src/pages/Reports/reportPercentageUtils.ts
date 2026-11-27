export interface PercentageTier {
  key: 'dominant' | 'high' | 'substantial' | 'moderate' | 'emerging' | 'low' | 'zero';
  minPct: number;
  label: string;
  badgeLabel: string;
  fill: string;
  color: string;
  bg: string;
  border: string;
  shadow: string;
}

export const PERCENTAGE_SPECTRUM_TIERS: PercentageTier[] = [
  {
    key: 'dominant',
    minPct: 50,
    label: '≥50% Dominant',
    badgeLabel: '≥50%',
    fill: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
    color: '#059669',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    shadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
  },
  {
    key: 'high',
    minPct: 35,
    label: '35–49% High',
    badgeLabel: '35–49%',
    fill: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
    color: '#2563eb',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.35)',
    shadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
  },
  {
    key: 'substantial',
    minPct: 20,
    label: '20–34% Substantial',
    badgeLabel: '20–34%',
    fill: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
    color: '#0891b2',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.35)',
    shadow: '0 2px 8px rgba(6, 182, 212, 0.35)',
  },
  {
    key: 'moderate',
    minPct: 10,
    label: '10–19% Moderate',
    badgeLabel: '10–19%',
    fill: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
    color: '#d97706',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    shadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
  },
  {
    key: 'emerging',
    minPct: 5,
    label: '5–9% Emerging',
    badgeLabel: '5–9%',
    fill: 'linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#7c3aed',
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.35)',
    shadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
  },
  {
    key: 'low',
    minPct: 1,
    label: '<5% Low',
    badgeLabel: '<5%',
    fill: 'linear-gradient(90deg, #ec4899 0%, #be185d 100%)',
    color: '#db2777',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.35)',
    shadow: '0 2px 8px rgba(236, 72, 153, 0.35)',
  },
  {
    key: 'zero',
    minPct: 0,
    label: '0% None',
    badgeLabel: '0%',
    fill: '#94a3b8',
    color: '#64748b',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.25)',
    shadow: 'none',
  },
];

/**
 * Returns color gradient and badge styling mapped directly to the percentage value.
 */
export function getPercentageColor(pct: number): PercentageTier {
  if (pct >= 50) return PERCENTAGE_SPECTRUM_TIERS[0];
  if (pct >= 35) return PERCENTAGE_SPECTRUM_TIERS[1];
  if (pct >= 20) return PERCENTAGE_SPECTRUM_TIERS[2];
  if (pct >= 10) return PERCENTAGE_SPECTRUM_TIERS[3];
  if (pct >= 5) return PERCENTAGE_SPECTRUM_TIERS[4];
  if (pct > 0) return PERCENTAGE_SPECTRUM_TIERS[5];
  return PERCENTAGE_SPECTRUM_TIERS[6];
}
