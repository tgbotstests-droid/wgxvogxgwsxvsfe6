
export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
}

let telegramEnabled = false;

export function isTelegramEnabled(): boolean {
  return telegramEnabled;
}

export function setTelegramEnabled(enabled: boolean): void {
  telegramEnabled = enabled;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    enabled: telegramEnabled,
  };
}
