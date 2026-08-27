import { Outlet } from 'react-router-dom';
import { SecurityProvider } from './SecurityContext';

export default function SecurityLayout() {
  return (
    <SecurityProvider>
      <Outlet />
    </SecurityProvider>
  );
}