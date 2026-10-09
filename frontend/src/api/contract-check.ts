import { callOperation } from "./operations";
async function contracts() {
  const servers = await callOperation("list_servers");
  servers.servers?.forEach((server) => server.name.toUpperCase());
  await callOperation("get_properties", { path: { server_name: "server" } });
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
