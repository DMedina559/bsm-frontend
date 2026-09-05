const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

const currentLevel = import.meta.env.VITE_LOG_LEVEL
  ? LogLevel[import.meta.env.VITE_LOG_LEVEL.toUpperCase()] || LogLevel.INFO
  : import.meta.env.MODE === "development"
    ? LogLevel.DEBUG
    : LogLevel.WARN;

const getPrefix = (level, module) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return module ? `${prefix} [${module}]` : prefix;
};

const createLogger = (moduleName) => {
  return {
    debug: (...args) => {
      if (currentLevel <= LogLevel.DEBUG) {
        console.log(getPrefix("DEBUG", moduleName), ...args);
      }
    },
    info: (...args) => {
      if (currentLevel <= LogLevel.INFO) {
        console.info(getPrefix("INFO", moduleName), ...args);
      }
    },
    warn: (...args) => {
      if (currentLevel <= LogLevel.WARN) {
        console.warn(getPrefix("WARN", moduleName), ...args);
      }
    },
    error: (...args) => {
      if (currentLevel <= LogLevel.ERROR) {
        console.error(getPrefix("ERROR", moduleName), ...args);
      }
    },
  };
};

export const logger = createLogger();
export default createLogger;
