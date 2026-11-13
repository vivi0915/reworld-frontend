export const tabs = ['home', 'roles', 'menu', 'history', 'member'] as const;
export type Tab = typeof tabs[number];
export function tabPath(tab: Tab) { return '/' + tab; }
export function tabFromPath(path: string): Tab | null {
  const value = path.replace(/\/$/, '').slice(1);
  return tabs.find(tab => tab === value) ?? null;
}
