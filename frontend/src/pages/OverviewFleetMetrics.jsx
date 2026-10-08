import { Activity, Server, Users } from "lucide-react";
import { summarizeFleet } from "../utils/fleetStatus";

export default function OverviewFleetMetrics({ servers, unavailable }) {
  const { running, stopped, playersKnown, players } = summarizeFleet(servers);
  const metrics = [
    { label: "Managed servers", value: servers.length, detail: "Servers visible to your account", Icon: Server },
    { label: "Running", value: running, detail: `${stopped} stopped · ${servers.length - running - stopped} other`, Icon: Activity },
    { label: "Players online", value: playersKnown ? players : "—", detail: playersKnown ? "Across your visible fleet" : "Some player counts unavailable", Icon: Users },
  ];

  return (
    <section className="workspace-metrics overview-metrics" aria-label="Fleet status">
      {metrics.map(({ label, value, detail, Icon }) => (
        <article className="workspace-metric" key={label}>
          <div className="overview-metric-heading">
            <span className="overview-metric-title">{label}</span>
            <Icon size={18} aria-hidden="true" />
          </div>
          <strong>{unavailable ? "—" : value}</strong>
          <small>{detail}</small>
        </article>
      ))}
    </section>
  );
}
