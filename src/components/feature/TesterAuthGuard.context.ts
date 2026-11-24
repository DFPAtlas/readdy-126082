import { createContext, useContext } from 'react';
import type { TesterContextValue } from './TesterAuthGuard';

export const TesterContext = createContext<TesterContextValue>({
  tester: null,
  accessState: 'loading',
  loading: true,
  error: '',
  reload: () => {},
});

export const useTester = () => useContext(TesterContext);
