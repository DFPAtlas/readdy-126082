import { Outlet } from 'react-router-dom';
import { ToolsProvider } from './ToolsContext';

export default function ToolsLayout() {
  return (
    <ToolsProvider>
      <Outlet />
    </ToolsProvider>
  );
}