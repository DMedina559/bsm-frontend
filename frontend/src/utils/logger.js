const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// 1. Check local storage first (so you can toggle logs live in production)
const storedOverride =
  typeof window !== "undefined" ? localStorage.getItem("APP_LOG_LEVEL") : null;

// 2. Resolve the level
const currentLevel = storedOverride
  ? (LogLevel[storedOverride.toUpperCase()] ?? LogLevel.INFO)
  : import.meta.env.VITE_LOG_LEVEL
    ? (LogLevel[import.meta.env.VITE_LOG_LEVEL.toUpperCase()] ?? LogLevel.INFO)
    : import.meta.env.MODE === "development"
      ? LogLevel.DEBUG
      : LogLevel.WARN;

const getPrefix = (level, module) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return module ? `${prefix} [${module}]` : prefix;
};

export function redactLogValue(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Error)
    return { name: value.name, message: value.message };
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value))
    return value.map((item) => redactLogValue(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /token|password|secret|authorization|credential|registration_url|command/i.test(
        key,
      )
        ? "[REDACTED]"
        : redactLogValue(item, seen),
    ]),
  );
}

const createLogger = (moduleName) => {
  return {
    debug: (...args) => {
      if (currentLevel <= LogLevel.DEBUG) {
        console.log(
          getPrefix("DEBUG", moduleName),
          ...args.map((value) => redactLogValue(value)),
        );
      }
    },
    info: (...args) => {
      if (currentLevel <= LogLevel.INFO) {
        console.info(
          getPrefix("INFO", moduleName),
          ...args.map((value) => redactLogValue(value)),
        );
      }
    },
    warn: (...args) => {
      if (currentLevel <= LogLevel.WARN) {
        console.warn(
          getPrefix("WARN", moduleName),
          ...args.map((value) => redactLogValue(value)),
        );
      }
    },
    error: (...args) => {
      if (currentLevel <= LogLevel.ERROR) {
        console.error(
          getPrefix("ERROR", moduleName),
          ...args.map((value) => redactLogValue(value)),
        );
      }
    },
  };
};

export const logger = createLogger();
export default createLogger;
