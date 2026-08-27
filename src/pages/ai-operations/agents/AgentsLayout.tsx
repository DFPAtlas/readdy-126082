import { Outlet } from 'react-router-dom';
import { AgentsProvider } from '@/pages/ai-operations/agents/AgentsContext';

// Shared wrapper so the agent registry list and detail pages read from a single
// in-memory agent store (frontend-only; no production agent execution).
export default function AgentsLayout() {
  return (
    <AgentsProvider>
      <Outlet />
    </AgentsProvider>
  );
}