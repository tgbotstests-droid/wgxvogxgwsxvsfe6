// Telegram Bot with Command Handlers
import { storage } from "./storage";
import { isTelegramEnabled } from "./telegramConfig";

type Message = any;

let TelegramBot: any = null;
let botInstance: any = null;
let botConfig: { token: string; chatId: string } | null = null;

async function loadTelegramBot() {
  if (!TelegramBot && isTelegramEnabled()) {
    try {
      const module = await import("node-telegram-bot-api");
      TelegramBot = module.default;
    } catch (error) {
      console.warn("Telegram bot module not available:", error);
      return null;
    }
  }
  return TelegramBot;
}

export async function initializeTelegramBotWithCommands(userId: string) {
  if (!isTelegramEnabled()) {
    console.log("Telegram module is disabled");
    return { success: false, error: "Telegram module disabled" };
  }

  try {
    const config = await storage.getTelegramConfig(userId);

    if (!config || !config.telegramBotToken || !config.telegramChatId) {
      return { 
        success: false, 
        error: "Telegram not configured" 
      };
    }

    const Bot = await loadTelegramBot();
    if (!Bot) {
      return { 
        success: false, 
        error: "Telegram bot module not available" 
      };
    }

    // Create new bot instance with polling
    botInstance = new Bot(config.telegramBotToken, { 
      polling: {
        interval: 1000,
        autoStart: true,
      }
    });

    botConfig = {
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
    };

    setupCommandHandlers();

    console.log("Telegram bot with commands initialized successfully");
    return { success: true };
  } catch (error) {
    console.error("Failed to initialize Telegram bot:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

function setupCommandHandlers() {
  if (!botInstance || !isTelegramEnabled()) return;

  botInstance.onText(/\/start/, async (msg: Message) => {
    const chatId = msg.chat.id;
    await botInstance.sendMessage(
      chatId,
      "👋 Добро пожаловать в ArbitrageBot!\n\n" +
      "Доступные команды:\n" +
      "/status - Текущий статус бота\n" +
      "/balance - Баланс кошелька\n" +
      "/stats - Статистика арбитража"
    );
  });

  botInstance.onText(/\/status/, async (msg: Message) => {
    const chatId = msg.chat.id;
    await botInstance.sendMessage(
      chatId,
      "✅ Бот активен и готов к работе"
    );
  });

  botInstance.on("polling_error", (error: Error) => {
    console.error("Telegram polling error:", error);
  });
}

export async function stopTelegramBot() {
  if (botInstance && isTelegramEnabled()) {
    try {
      await botInstance.stopPolling();
      botInstance = null;
      botConfig = null;
      console.log("Telegram bot stopped");
    } catch (error) {
      console.error("Error stopping Telegram bot:", error);
    }
  }
}

export function getTelegramBotInstance() {
  if (!isTelegramEnabled()) {
    return null;
  }
  return botInstance;
}