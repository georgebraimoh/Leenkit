import React from 'react';

// Turns a render crash into a recoverable screen instead of a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('LEENKIT crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <h1 className="text-xl font-bold font-heading text-[#172121]">Something went wrong</h1>
          <p className="text-sm text-[#3D4948]">
            This page hit an unexpected error. Reload to try again, or go back to Explore.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full bg-[#18A999] text-white text-sm font-bold hover:bg-[#087F73] cursor-pointer"
            >
              Reload page
            </button>
            <a
              href="/explore"
              className="px-5 py-2.5 rounded-full border border-[#DDE3E0] text-sm font-bold text-[#172121] hover:bg-[#DDF4EF]"
            >
              Go to Explore
            </a>
          </div>
        </div>
      </div>
    );
  }
}
