import { callOperation } from "../api/operations";
import { queryKeys } from "../app/queryKeys";
import QueryStatus from "../components/QueryStatus";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React, { useState } from "react";

import { useToast } from "../contexts/ToastContext";
import { RefreshCw, Plus, Scan } from "lucide-react";
const GlobalPlayers = () => {
  const resourceQuery = useResourceQuery("globalPlayers");
  const players = resourceQuery.data ?? [];
  const loading = resourceQuery.isFetching;

  // Add form state
  const [newPlayerString, setNewPlayerString] = useState(""); // Format: Name:XUID

  const { addToast } = useToast();
  const write = useResourceMutation(
    ({ id, options }, { session }) =>
      callOperation(id, { ...options, session }),
    [queryKeys.globalPlayers()],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });
  const scanLoading = write.pendingVariables.some(
    (variables) => variables?.id === "scan_players",
  );
  const addLoading = write.pendingVariables.some(
    (variables) => variables?.id === "add_players",
  );

  const fetchPlayers = async () => {
    const result = await resourceQuery.refetch();
    if (result.error) addToast(result.error.message, "error");
    return result.isSuccess;
  };
  const handleRefresh = async () => {
    const success = await fetchPlayers();
    if (success) {
      addToast("Players list refreshed.", "success");
    }
  };
  const handleScan = async () => {
    try {
      const response = await writeOperation("scan_players");
      if (response && response.status === "success") {
        addToast(response.message || "Scan started.", "success");
      } else {
        addToast(response?.message || "Scan failed.", "error");
      }
    } catch {
      addToast("Error triggering scan.", "error");
    }
  };
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPlayerString) return;

    // Split by comma if multiple
    const inputs = newPlayerString
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (inputs.length === 0) return;
    try {
      // payload expects { players: ["Name:XUID", ...] }
      const response = await writeOperation("add_players", {
        body: {
          players: inputs,
        },
      });
      if (response && response.status === "success") {
        addToast(response.message || "Players added/updated.", "success");
        setNewPlayerString("");
      } else {
        addToast(response?.message || "Failed to add players.", "error");
      }
    } catch (error) {
      addToast(error.message || "Error adding players.", "error");
    }
  };
  return (
    <div className="container">
      <QueryStatus query={resourceQuery} />
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Global Player Database</h1>
        <div
          style={{
            display: "flex",
            gap: "calc(10px * var(--bsm-spacing-scale))",
          }}
        >
          <button
            className="action-button secondary"
            onClick={handleScan}
            disabled={scanLoading}
            title="Scan server logs for players"
            type="button"
            aria-label="Scan server logs for players"
          >
            <Scan
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
              className={scanLoading ? "spin" : ""}
            />
            {scanLoading ? "Scanning..." : "Scan Logs"}
          </button>
          <button
            className="action-button secondary"
            onClick={handleRefresh}
            disabled={loading}
            type="button"
          >
            <RefreshCw
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
              className={loading ? "spin" : ""}
            />{" "}
            Refresh
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--input-background-color)",
          padding: "calc(20px * var(--bsm-spacing-scale))",
          borderRadius: "5px",
          border: "1px solid var(--border-color)",
        }}
      >
        <p
          style={{
            marginBottom: "calc(20px * var(--bsm-spacing-scale))",
            color: "var(--text-color-secondary)",
          }}
        >
          This is the central database of all known players across all servers.
          Adding players here makes them available for permissions management.
        </p>

        {/* Add Form */}
        <form
          onSubmit={handleAdd}
          className="form-group"
          style={{
            display: "flex",
            gap: "calc(10px * var(--bsm-spacing-scale))",
            alignItems: "flex-end",
            marginBottom: "calc(20px * var(--bsm-spacing-scale))",
            background: "rgba(0,0,0,0.1)",
            padding: "calc(15px * var(--bsm-spacing-scale))",
            borderRadius: "5px",
          }}
        >
          <div
            style={{
              flexGrow: 1,
            }}
          >
            <label
              className="form-label"
              style={{
                display: "block",
                marginBottom: "calc(5px * var(--bsm-spacing-scale))",
              }}
              htmlFor="globalplayers-field-1"
            >
              Add Players (Format: <code>Gamertag:XUID</code>)
            </label>
            <input
              type="text"
              className="form-input"
              value={newPlayerString}
              onChange={(e) => setNewPlayerString(e.target.value)}
              placeholder="e.g. Steve:123456789, Alex:987654321"
              style={{
                width: "100%",
              }}
              id="globalplayers-field-1"
            />
          </div>
          <button
            type="submit"
            className="action-button"
            disabled={addLoading || !newPlayerString}
          >
            <Plus
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
            />{" "}
            Add / Update
          </button>
        </form>

        {/* List */}
        {loading ? (
          <div
            className="loader-container"
            style={{
              textAlign: "center",
              padding: "calc(40px * var(--bsm-spacing-scale))",
            }}
          >
            <div className="spinner"></div>
            <p>Loading players...</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table
              className="server-table"
              style={{
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th>Gamertag</th>
                  <th>XUID</th>
                </tr>
              </thead>
              <tbody>
                {players.length > 0 ? (
                  players.map((p, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          fontWeight: "bold",
                        }}
                      >
                        {p.name}
                      </td>
                      <td className="mono-text">{p.xuid}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="no-servers-row">
                    <td
                      colSpan={2}
                      className="no-servers"
                      style={{
                        textAlign: "center",
                        padding: "calc(30px * var(--bsm-spacing-scale))",
                        fontStyle: "italic",
                        color: "var(--text-color-secondary)",
                      }}
                    >
                      No players found in database. Scan logs or add manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default GlobalPlayers;
