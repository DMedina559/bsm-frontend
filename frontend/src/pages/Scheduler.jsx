import React, { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useServer } from "../contexts/ServerContext";
import BackupSchedules from "../components/BackupSchedules";
import "../styles/backup-settings.css";

export default function Scheduler() {
  const { user, sessionGeneration } = useAuth();
  const { servers, selectedServer } = useServer();
  const [filter, setFilter] = useState("");
  const names = (
    Array.isArray(servers)
      ? servers.map((server) =>
          typeof server === "string" ? server : server.name,
        )
      : Object.keys(servers ?? {})
  ).filter(Boolean);
  if (user?.role !== "admin")
    return (
      <div className="container">
        <p>Administrator access is required to manage schedules.</p>
      </div>
    );
  return (
    <div className="container scheduler-page">
      <div className="header">
        <h1>
          <CalendarClock size={24} /> Scheduler
        </h1>
      </div>
      <div className="scheduler-overview">
        <p>Back up and verify your servers automatically.</p>
        <label>
          Show server
          <select
            className="form-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All servers</option>
            {names.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <BackupSchedules
        key={`${sessionGeneration}:${filter}`}
        serverName={filter || undefined}
        defaultServer={selectedServer || names[0]}
        serverNames={names}
      />
    </div>
  );
}
