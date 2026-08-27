import { Outlet } from 'react-router-dom';
import { NotificationsProvider } from './NotificationsContext';

export default function NotificationsLayout() {
  return (
    <NotificationsProvider>
      <Outlet />
    </NotificationsProvider>
  );
}