export const subsystemDescriptions = {
  scheduler:
    "Scheduler runtime, enabled jobs, task availability, and timezone data.",
  runtime: "Application lifecycle and readiness",
  events: "Event dispatch, listeners and worker capacity",
  state: "Registered resources and changes awaiting persistence",
  storage: "Database operations and storage contention",
  tasks: "Background work and task capacity",
  plugins: "Registered plugins and their runtime observations",
  transport: "Client connections, message delivery and queue health",
  metrics: "Measurement collection and unavailable readings",
  processes: "Expected and observed Bedrock processes",
};
