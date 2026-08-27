import { Outlet } from 'react-router-dom';
import { ApprovalsProvider } from '@/pages/ai-operations/approvals/ApprovalsContext';

// Shared wrapper so the Approvals queue and detail pages read from a single
// in-memory approvals store (frontend-only; no real execution or writes).
export default function ApprovalsLayout() {
  return (
    <ApprovalsProvider>
      <Outlet />
    </ApprovalsProvider>
  );
}