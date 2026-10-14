import { callOperation } from "./operations";
async function contracts() {
  const diagnostic = await callOperation("get_application_diagnostics");
  diagnostic.summary.status.toUpperCase();
  await callOperation("get_diagnostic_history", {
    query: { outcome: "failed", limit: 50 },
  });
  await callOperation("get_diagnostic_trace", {
    path: { correlation_id: "trace" },
  });
  await callOperation("compare_diagnostic_snapshots", {
    body: { before: diagnostic, after: diagnostic },
  });

  const runtime = await callOperation("get_web_runtime");
  runtime.phase.toUpperCase();
  const catalog = await callOperation("list_application_events");
  catalog.events.forEach((event) => event.name.toUpperCase());
  const activity = await callOperation("get_event_activity", {
    query: { limit: 5, status: "partial", correlation_id: "operation-1" },
  });
  activity.recent.forEach((event) => event.event_id.toUpperCase());
  const receipt = await callOperation("shutdown_web_runtime", { body: {} });
  receipt.instance_id.toUpperCase();
  // @ts-expect-error Shutdown still requires its empty request body.
  await callOperation("shutdown_web_runtime");
  // @ts-expect-error Activity filters must use a declared status.
  await callOperation("get_event_activity", { query: { status: "unknown" } });
  const servers = await callOperation("list_servers");
  servers.servers?.forEach((server) => server.name.toUpperCase());
  await callOperation("get_properties", { path: { server_name: "server" } });
  await callOperation("login", {
    body: { username: "user", password: "password" },
  });
  const file = await callOperation("get_server_addon_icon", {
    path: { server_name: "server" },
    query: { uuid: "uuid", pack_type: "behavior" },
    responseType: "blob",
  });
  file?.slice();
  // @ts-expect-error Required paths cannot be omitted.
  await callOperation("get_properties");
  // @ts-expect-error Required request bodies cannot be omitted.
  await callOperation("set_properties", { path: { server_name: "server" } });
  // @ts-expect-error The generated contract disallows unknown operations.
  await callOperation("not_a_real_operation");
  // @ts-expect-error Server paths require the schema's server_name parameter.
  await callOperation("get_properties", { path: { name: "server" } });
}
void contracts;
