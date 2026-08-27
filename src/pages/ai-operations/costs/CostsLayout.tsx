import { Outlet } from 'react-router-dom';
import { CostsProvider } from './CostsContext';

export default function CostsLayout() {
  return (
    <CostsProvider>
      <Outlet />
    </CostsProvider>
  );
}