import { trackCommandResult } from "../app/commandTracking";
import { application } from "../app/application";
import { createApiClient } from "@bedrock-server-manager/api-client";
import { request } from "./transport";

const client = createApiClient({ request });
export const {
  inspectBackendContract,
  resolveOperationUrl,
  createOperationClient,
  discoverOperationClient,
} = client;

/** Generated signatures are preserved at the application command boundary. */
/** @type {typeof client.callOperation} */
export const callOperation = (id, ...args) => {
  const options = args[0];
  const ticket = application.captureStateRequest(options?.signal);
  return Reflect.apply(client.callOperation, client, [id, ...args]).then(
    (result) => {
      const body = options?.body;
      const serverName =
        options?.path?.server_name ??
        (body && typeof body === "object" && "server_name" in body
          ? body.server_name
          : undefined);
      return trackCommandResult(result, {
        ticket,
        kind: id === "install_server" ? "install" : id,
        serverName,
      });
    },
  );
};
