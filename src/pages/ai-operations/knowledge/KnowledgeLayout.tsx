import { Outlet } from 'react-router-dom';
import { KnowledgeProvider } from './KnowledgeContext';

export default function KnowledgeLayout() {
  return (
    <KnowledgeProvider>
      <Outlet />
    </KnowledgeProvider>
  );
}