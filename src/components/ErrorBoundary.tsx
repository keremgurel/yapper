"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <div className="text-4xl">😵</div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Something went wrong
          </h3>
          <p className="max-w-md text-sm text-red-600 dark:text-red-300">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PracticeErrorFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="text-5xl">🎤</div>
      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
        Practice session encountered an issue
      </h3>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        There was a problem with the video recording or camera access. Please
        refresh the page and ensure your browser has permission to use the
        camera and microphone.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Refresh Page
      </button>
    </div>
  );
}
