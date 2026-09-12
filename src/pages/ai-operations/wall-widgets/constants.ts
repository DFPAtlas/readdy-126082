import type { WallWidgetBrandColor } from '@/lib/ai-operations/wallWidgetConfig';

// Tailwind swatch classes for the approved wall-widget brand colour palette.
// These are static class strings (Tailwind JIT picks them up from source) and
// represent each site's brand identity — not the DFP Command UI theme.
export const BRAND_SWATCH: Record<WallWidgetBrandColor, string> = {
  cyan: 'bg-cyan-400',
  blue: 'bg-sky-400',
  teal: 'bg-teal-400',
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
  yellow: 'bg-yellow-400',
  pink: 'bg-pink-400',
  violet: 'bg-violet-400',
};

export const BRAND_COLOR_LABELS: Record<WallWidgetBrandColor, string> = {
  cyan: 'Cyan',
  blue: 'Blue',
  teal: 'Teal',
  orange: 'Orange',
  purple: 'Purple',
  yellow: 'Yellow',
  pink: 'Pink',
  violet: 'Violet',
};

/** Derive a sensible default set of initials (≤4) from a site's name. */
export function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}