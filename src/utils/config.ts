
import conf from 'config';

export const enum ConfParams {
  LOG_DIR,
  STORAGE_PATH,
  XTRANSFER,
  SOURCE,
  TARGET,
  VERBOSE,
  MIN_CHARS,
  APPEND_WILDCARD,
  FETCH_LEVEL,
  MAX_ASSOCIATIONS,
  C_GET,
  HTTP_PORT,
  WEBSOCKET_URL,
  WEBSOCKET_TOKEN,
}

const ConfDef: any = new Map([
  [ConfParams.LOG_DIR, 'logDir'],
  [ConfParams.STORAGE_PATH, 'storagePath'],
  [ConfParams.XTRANSFER, 'transferSyntax'],
  [ConfParams.SOURCE, 'source'],
  [ConfParams.TARGET, 'target'],
  [ConfParams.VERBOSE, 'verboseLogging'],
  [ConfParams.MIN_CHARS, 'qidoMinChars'],
  [ConfParams.APPEND_WILDCARD, 'qidoAppendWildcard'],
  [ConfParams.FETCH_LEVEL, 'useFetchLevel'],
  [ConfParams.MAX_ASSOCIATIONS, 'maxAssociations'],
  [ConfParams.C_GET, 'useCget'],
  [ConfParams.HTTP_PORT, 'webserverPort'],
  [ConfParams.WEBSOCKET_URL, 'websocketUrl'],
  [ConfParams.WEBSOCKET_TOKEN, 'websocketToken'],
]);

interface IConfig {
  get<T>(setting: ConfParams): T;
  has(setting: ConfParams): boolean;
}

class Config implements IConfig {
  get<T>(setting: ConfParams): T {
    const s = ConfDef.get(setting);
    return conf.get(s);
  }
  has(setting: ConfParams): boolean {
    const s = ConfDef.get(setting);
    return conf.has(s);
  }
}

export const config = new Config();
