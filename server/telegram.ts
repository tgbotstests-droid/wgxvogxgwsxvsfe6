
import { storage } from "./storage";
import { isTelegramEnabled } from "./telegramConfig";

let TelegramBot: any = null;
let botInstance: any = null;

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

export async function initializeTelegramBot(userId: string) {
  if (!isTelegramEnabled()) {
    return { 
      success: false, 
      error: "Telegram module is disabled in settings" 
    };
  }

  try {
    const config = await storage.getTelegramConfig(userId);
    
    if (!config || !config.telegramBotToken) {
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

    // Create new bot instance
    botInstance = new Bot(config.telegramBotToken, { polling: false });
    
    console.log("Telegram bot initialized successfully");
    return { success: true };
  } catch (error) {
    console.error("Failed to initialize Telegram bot:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function sendTelegramMessage(
  userId: string, 
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!isTelegramEnabled()) {
    console.log("Telegram disabled, skipping message:", message);
    return { success: false, error: "Telegram module disabled" };
  }

  try {
    const config = await storage.getTelegramConfig(userId);
    
    if (!config || !config.telegramBotToken || !config.telegramChatId) {
      return { success: false, error: "Telegram not configured" };
    }

    const Bot = await loadTelegramBot();
    if (!Bot) {
      return { success: false, error: "Telegram bot module not available" };
    }

    const bot = new Bot(config.telegramBotToken, { polling: false });
    
    // Parse Chat ID (support negative values for groups)
    const chatId = parseInt(config.telegramChatId, 10);
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: "HTML",
      disable_web_page_preview: true 
    });
    
    console.log("Telegram message sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function testTelegramConnection(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isTelegramEnabled()) {
    return { 
      success: false, 
      error: "Telegram module is disabled in settings" 
    };
  }

  try {
    const config = await storage.getTelegramConfig(userId);
    
    if (!config || !config.telegramBotToken || !config.telegramChatId) {
      return {
        success: false,
        error: "Telegram configuration incomplete",
      };
    }

    const Bot = await loadTelegramBot();
    if (!Bot) {
      return { 
        success: false, 
        error: "Telegram bot module not available" 
      };
    }

    const bot = new Bot(config.telegramBotToken, { polling: false });
    
    // Test bot connection
    const botInfo = await bot.getMe();
    console.log("Bot info:", botInfo);
    
    // Parse Chat ID
    const chatId = parseInt(config.telegramChatId, 10);
    
    // Test send message
    await bot.sendMessage(
      chatId,
      "🤖 Тест соединения с Telegram успешен!",
      { parse_mode: "HTML" }
    );
    
    return { success: true };
  } catch (error) {
    console.error("Telegram connection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function getTelegramBotInstance() {
  if (!isTelegramEnabled()) {
    return null;
  }
  return botInstance;
}
