import React from 'react';
import { AlertTriangle, RefreshCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ErrorBoundary — Catches React rendering errors gracefully
 *
 * Features:
 *  - Catches unhandled errors in child component tree
 *  - Shows a friendly, ASD-safe error screen (no alarming red)
 *  - Provides recovery options (retry, go home)
 *  - Logs errors for debugging
 *  - Optional error detail expansion
 */

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // Log error for debugging
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        // Future: send to error tracking service
        // sendErrorReport({ error, errorInfo, component: this.props.name });
    }

    handleRetry = () => {
        this.setState(prev => ({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: prev.retryCount + 1
        }));
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback
            if (this.props.fallback) {
                return this.props.fallback({
                    error: this.state.error,
                    retry: this.handleRetry
                });
            }

            const { showDetails, error, errorInfo, retryCount } = this.state;
            const componentName = this.props.name || 'Component';

            return (
                <div className="min-h-[300px] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
                        {/* Icon */}
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-200">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                        </div>

                        {/* Message */}
                        <h2 className="text-lg font-semibold text-slate-800 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-slate-500 mb-6">
                            The {componentName} section ran into a problem.
                            {retryCount > 0 && ` (Retry ${retryCount})`}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-3 justify-center mb-4">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </button>
                        </div>

                        {/* Expandable error details */}
                        <button
                            onClick={() => this.setState({ showDetails: !showDetails })}
                            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto transition-colors"
                        >
                            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {showDetails ? 'Hide details' : 'Show details'}
                        </button>

                        {showDetails && (
                            <div className="mt-3 p-3 bg-slate-100 rounded-lg text-left overflow-auto max-h-48">
                                <p className="text-xs text-red-600 font-mono mb-2">
                                    {error?.toString()}
                                </p>
                                {errorInfo?.componentStack && (
                                    <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap">
                                        {errorInfo.componentStack.slice(0, 500)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
