import { Outlet } from 'react-router-dom';
import { SitesProvider } from '@/pages/ai-operations/sites/SitesContext';

// Shared wrapper so the registry list and detail pages read from a single
// in-memory registry store (frontend-only; no production data).
export default function SitesLayout() {
  return (
    <SitesProvider>
      <Outlet />
    </SitesProvider>
  );
}