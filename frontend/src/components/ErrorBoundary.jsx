import React from "react";
export default class ErrorBoundary extends React.Component {
  state = {
    failed: false,
  };
  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="container error-page" role="alert">
          <h1>This workspace could not be opened</h1>
          <p>
            Reload the interface to try again. If the problem continues, review
            the server logs.
          </p>
          <button
            className="action-button primary-button"
            onClick={() => window.location.reload()}
          >
            Reload interface
          </button>
        </div>
      );
    return this.props.children;
  }
}
