import { Component, type ErrorInfo, type ReactNode } from "react";
import { buttonClass } from "../../components/ui/Button";
import { Card } from "../ui/Card";

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
        <Card as="div" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-tt42-text">Something went wrong</h1>
          <p className="mt-2 text-sm text-tt42-muted">
            The app hit an unexpected UI error. Reload to recover.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={buttonClass({ variant: "secondary", size: "md", className: "mt-4" })}
          >
            Reload App
          </button>
        </Card>
      </div>
    );
  }
}
