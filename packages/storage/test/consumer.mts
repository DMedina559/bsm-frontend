import {
  createPreferenceStore,
  getSessionStorageKey,
} from "@bedrock-server-manager/storage";
const store = createPreferenceStore();
const density = store.read("account", "density", "compact");
density.toUpperCase();
getSessionStorageKey("account", "density")?.toUpperCase();
