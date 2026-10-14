import React from "react";
/** Cached data remains visible during recoverable fetch errors. */
export default function QueryStatus({ query }) {
  if (!query.error) return null;
  return (
    <div role="alert" className="message-box message-error">
      <span>
        {query.error.message || "This information could not be refreshed."}
      </span>{" "}
      <button
        type="button"
        onClick={() => query.refetch()}
        disabled={query.isFetching}
      >
        Retry
      </button>
    </div>
  );
}
