import { useEffect, type ReactNode } from 'react';
import { refreshGroupLiveData, useGroupLiveData } from './groupLiveDataStore';

export function GroupLiveDataProvider({ children }: { children: ReactNode }) {
  useGroupLiveData();
  useEffect(() => { void refreshGroupLiveData(); }, []);
  return <>{children}</>;
}
