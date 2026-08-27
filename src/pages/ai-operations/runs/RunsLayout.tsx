import { Outlet } from 'react-router-dom';
import { RunsProvider } from '@/pages/ai-operations/runs/RunsContext';

// Shared wrapper so the Tasks & Runs list and detail pages read from a single
// in-memory run store (frontend-only; no real execution).
export default function RunsLayout() {
  return (
    <RunsProvider>
      <Outlet />
    </RunsProvider>
  );
}