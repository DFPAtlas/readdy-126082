import { Outlet } from 'react-router-dom';
import { AuditProvider } from './AuditContext';

export default function AuditLayout() {
  return (
    <AuditProvider>
      <Outlet />
    </AuditProvider>
  );
}