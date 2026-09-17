import path from 'node:path';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databasePath?: string;
  persistentDataPath?: string;
  requirePersistentStorage: boolean;
  strictPersistenceAbort: boolean;
  hasAuthSecret: boolean;
  hasGeminiKey: boolean;
  isProduction: boolean;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  const value = String(raw).trim().toLowerCase();
  if (value === '' || value === 'undefined' || value === 'null') return fallback;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on' || value === 'enabled') {
    return true;
  }
  if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off' || value === 'disabled') {
    return false;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric !== 0;
  }
  console.warn(`[Config] Non-standard boolean value for ${name}="${raw}". Using fallback: ${fallback}`);
  return fallback;
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const port = 3000;

  const authSecret = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (isProduction && (!authSecret || authSecret.length < 32)) {
    throw new Error('[Config] Production requires AUTH_TOKEN_SECRET or JWT_SECRET with at least 32 characters.');
  }

  const requirePersistentStorage = readBoolean(
    'REQUIRE_PERSISTENT_STORAGE',
    isProduction,
  );
  const strictPersistenceAbort = readBoolean(
    'STRICT_PERSISTENCE_ABORT',
    isProduction,
  );

  const databasePath = process.env.DATABASE_PATH;
  const persistentDataPath = process.env.PERSISTENT_DATA_PATH || process.env.DATA_DIR;
  if (isProduction && requirePersistentStorage && !databasePath && !persistentDataPath) {
    throw new Error('[Config] Production persistent storage requires DATABASE_PATH or PERSISTENT_DATA_PATH.');
  }

  return {
    nodeEnv,
    port,
    databasePath: databasePath ? path.resolve(databasePath) : undefined,
    persistentDataPath: persistentDataPath ? path.resolve(persistentDataPath) : undefined,
    requirePersistentStorage,
    strictPersistenceAbort,
    hasAuthSecret: Boolean(authSecret),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    isProduction,
  };
}

export function logConfigSummary(config: AppConfig): void {
  console.info(
    `[Config] environment=${config.nodeEnv} port=${config.port} ` +
    `authSecret=${config.hasAuthSecret ? 'configured' : 'missing'} ` +
    `gemini=${config.hasGeminiKey ? 'configured' : 'not-configured'} ` +
    `persistentStorage=${config.requirePersistentStorage ? 'required' : 'optional'}`,
  );
}
