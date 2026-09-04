// ============================================================================
// AI Operations — Wallboard error boundary.
//
// A single broken wallboard component must never leave the 32-inch display
// blank. This boundary catches render errors in the wallboard subtree and
// renders a safe recovery state instead. Operational data, settings and the
// authenticated session are unaffected.
// ============================================================================

import { Component, type ReactNode } from 'react';

interface WallboardErrorBoundaryProps {
  children: ReactNode;
}

interface WallboardErrorBoundaryState {
  hasError: boolean;
}

export default class WallboardErrorBoundary extends Component<
  WallboardErrorBoundaryProps,
  WallboardErrorBoundaryState
> {
  state: WallboardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WallboardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log only — never render raw error details to the wall screen.
    console.error('Wallboard render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-background-50 text-foreground-50">
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="max-w-md text-center">
              <div className="w-16 h-16 bg-accent-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <i className="ri-error-warning-line text-accent-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">
                Wallboard display error
              </h1>
              <p className="text-sm text-foreground-400 mb-8 leading-relaxed">
                The wallboard encountered a display error. Operational data and settings are
                unaffected.
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Reload wallboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}