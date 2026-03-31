import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash captured by AppErrorBoundary", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-tt42-bg px-4">
        <div className="w-full max-w-sm rounded-card border border-tt42-border bg-tt42-surface p-5 text-center shadow-soft">
          <h1 className="text-lg font-semibold text-tt42-text">Something went wrong</h1>
          <p className="mt-2 text-sm text-tt42-muted">
            The app hit an unexpected UI error. Reload to recover.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-tt42-border bg-tt42-surface2 px-4 py-2 text-sm"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
