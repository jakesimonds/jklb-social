export const themeConfig = {
  beginning: { bg: '#1e1e3a' },
  middle:    { bg: '#1a1a2e' },
  end:       { bg: '#161628' },
};

export function getPhaseBackground(phase: 'beginning' | 'middle' | 'end'): string {
  return themeConfig[phase].bg;
}
