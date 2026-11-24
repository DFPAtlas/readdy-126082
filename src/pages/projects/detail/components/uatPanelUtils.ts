import type { UatTester } from '@/pages/admin/website-uat/types';

export function testerName(testers: UatTester[], id: string | null | undefined): string {
  if (!id) return 'Unknown tester';
  return testers.find((t) => t.id === id)?.full_name ?? 'Unknown tester';
}
