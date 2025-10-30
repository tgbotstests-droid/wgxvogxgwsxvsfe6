import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { TelegramMessage, BotConfig } from "@shared/schema";

interface TelegramConnectionStatusProps {
  config?: BotConfig;
}

function TelegramConnectionStatus({ config }: TelegramConnectionStatusProps) {
  const isConfigured = Boolean(config?.telegramBotToken && config?.telegramChatId);

  return (
    <div className="flex items-center gap-2" data-testid="telegram-connection-status">
      {isConfigured ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" data-testid="status-indicator-connected" />
          <span className="text-sm text-muted-foreground">Подключен</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-gray-400" data-testid="status-indicator-disconnected" />
          <span className="text-sm text-muted-foreground">Не настроен</span>
        </>
      )}
    </div>
  );
}

export function TelegramMessagesPanel() {
  const { data: messages, isLoading } = useQuery<TelegramMessage[]>({
    queryKey: ["/api/telegram/messages"],
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  const { data: config } = useQuery<BotConfig>({
    queryKey: ["/api/bot/config"],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-telegram-messages">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Telegram Уведомления
              </CardTitle>
              <CardDescription>История отправленных сообщений</CardDescription>
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedMessages = messages?.slice().sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) || [];

  return (
    <Card data-testid="card-telegram-messages">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Telegram Уведомления
            </CardTitle>
            <CardDescription>История отправленных сообщений</CardDescription>
          </div>
          <TelegramConnectionStatus config={config} />
        </div>
      </CardHeader>
      <CardContent>
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-state-messages">
            <Send className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Нет отправленных сообщений
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Сообщения появятся после настройки Telegram бота
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {sortedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="border rounded-lg p-4 hover-elevate transition-all"
                  data-testid={`message-${msg.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {msg.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" data-testid="icon-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" data-testid="icon-error" />
                      )}
                      <Badge
                        variant={
                          msg.messageType === "alert"
                            ? "destructive"
                            : msg.messageType === "trade"
                            ? "default"
                            : "secondary"
                        }
                        data-testid={`badge-type-${msg.messageType}`}
                      >
                        {msg.messageType === "notification" && "Уведомление"}
                        {msg.messageType === "alert" && "Тревога"}
                        {msg.messageType === "trade" && "Сделка"}
                        {msg.messageType === "error" && "Ошибка"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span data-testid="text-time">
                        {formatDistanceToNow(new Date(msg.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-foreground mb-2 whitespace-pre-wrap" data-testid="text-message">
                    {msg.message}
                  </p>

                  {msg.error && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <p className="text-xs text-destructive" data-testid="text-error">
                        {msg.error}
                      </p>
                    </div>
                  )}

                  {msg.metadata && (
                    <div className="mt-2 text-xs text-muted-foreground font-mono">
                      {Object.entries(msg.metadata).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-semibold">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
