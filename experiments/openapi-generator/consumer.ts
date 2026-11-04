import type {
  CompletedItem,
  CreateIntegrationToken,
} from "./generated/models/index.js";
const omitted: CreateIntegrationToken = {
  name: "example",
  permissions: ["account:read"],
};
const nullable: CreateIntegrationToken = {
  ...omitted,
  expires_in_days: null,
  server_ids: null,
};
const completed: CompletedItem = {
  outcome: "completed",
  error: null,
  reason: null,
};
// @ts-expect-error Required request body fields must remain required.
const invalid: CreateIntegrationToken = { name: "example" };
// @ts-expect-error Null-only fields cannot become unconstrained objects.
const invalidCompleted: CompletedItem = { error: "failure" };
void [omitted, nullable, completed, invalid, invalidCompleted];

import {
  AccessManagementApi,
  BackupRestoreApi,
} from "./generated/apis/index.js";
import { Configuration } from "./generated/runtime.js";
const configuration = new Configuration({ basePath: "https://bsm.example" });
const tokens = new AccessManagementApi(configuration);
const backups = new BackupRestoreApi(configuration);
// Compile-time examples only; these functions are never executed by the tests.
function typedCalls() {
  void tokens.createIntegrationToken({ CreateIntegrationToken: nullable });
  void backups.importServerSnapshot({
    server_name: "example",
    file: new Blob(["archive"]),
  });
  // @ts-expect-error Generated endpoint requires its typed request body.
  void tokens.createIntegrationToken({});
  void backups.importServerSnapshot({
    server_name: "example",
    // @ts-expect-error A file upload must receive a Blob, not a filesystem path.
    file: "/tmp/backup.zip",
  });
}
void typedCalls;
