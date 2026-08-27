import { Outlet } from 'react-router-dom';
import { AlertsProvider } from './AlertsContext';

export default function AlertsLayout() {
  return (
    <AlertsProvider>
      <Outlet />
    </AlertsProvider>
  );
}