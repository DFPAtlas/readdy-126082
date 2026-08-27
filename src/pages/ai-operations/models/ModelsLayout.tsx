import { Outlet } from 'react-router-dom';
import { ModelsProvider } from './ModelsContext';

export default function ModelsLayout() {
  return (
    <ModelsProvider>
      <Outlet />
    </ModelsProvider>
  );
}