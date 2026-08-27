import { Outlet } from 'react-router-dom';
import { OrchestratorProvider } from '@/pages/ai-operations/orchestrator/OrchestratorContext';

export default function OrchestratorLayout() {
  return (
    <OrchestratorProvider>
      <Outlet />
    </OrchestratorProvider>
  );
}