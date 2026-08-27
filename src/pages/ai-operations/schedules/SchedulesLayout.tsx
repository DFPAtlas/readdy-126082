import { Outlet } from 'react-router-dom';
import { SchedulesProvider } from './SchedulesContext';

export default function SchedulesLayout() {
  return (
    <SchedulesProvider>
      <Outlet />
    </SchedulesProvider>
  );
}