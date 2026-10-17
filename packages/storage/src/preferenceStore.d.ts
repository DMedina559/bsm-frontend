export interface PreferenceStorage {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface PreferenceDefinition {
  version?: number;
  validate?: (value: unknown) => boolean;
  migrations?: Record<number, (value: unknown) => unknown>;
}
export interface PreferenceEvents {
  addEventListener?(
    type: "storage",
    listener: (event: { key: string | null }) => void,
  ): void;
  removeEventListener?(
    type: "storage",
    listener: (event: { key: string | null }) => void,
  ): void;
}
type Identity = string | number | null | undefined;
export interface PreferenceStore {
  subscribe(identity: Identity, name: string, listener: () => void): () => void;
  read<T>(
    identity: Identity,
    name: string,
    fallback: T,
    validate?: (value: unknown) => boolean,
  ): T;
  validate(name: string, value: unknown): boolean;
  write(identity: Identity, name: string, value: unknown): boolean;
  remove(identity: Identity, name: string): boolean;
}
export function createPreferenceStore(
  storage?: PreferenceStorage | null,
  definitions?: Record<string, PreferenceDefinition>,
  events?: PreferenceEvents,
): PreferenceStore;
