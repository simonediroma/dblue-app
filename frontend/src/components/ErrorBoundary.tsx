import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-surface text-on-surface p-8 text-center z-[9999]">
          <p className="font-headline font-bold text-xl mb-4">Something went wrong</p>
          <p className="text-sm text-on-surface-variant mb-6 max-w-sm">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
