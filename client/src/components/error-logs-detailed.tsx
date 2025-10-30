import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  XCircle,
  Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ActivityLog {
  id: number;
  userId: string;
  type: string;
  level: string;
  message: string;
  metadata?: any;
  createdAt: string;
}

export function ErrorLogsDetailed() {
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const { data: logs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const response = await fetch("/api/activity-logs?limit=200");
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    refetchInterval: 10000,
  });

  // Filter for errors and warnings only
  const errorLogs = logs?.filter(l => l.level === 'error' || l.level === 'warning') || [];
  const criticalErrors = errorLogs.filter(l => l.level === 'error');
  const warnings = errorLogs.filter(l => l.level === 'warning');

  const toggleExpanded = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive" className="font-mono text-xs">КРИТИЧЕСКАЯ</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="font-mono text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">ПРЕДУПРЕЖДЕНИЕ</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-xs">ИНФО</Badge>;
    }
  };

  const getErrorDescription = (log: ActivityLog): string => {
    const metadata = log.metadata;
    
    // Analyze metadata to provide helpful description
    if (metadata?.error === 'private_key_not_configured') {
      return 'Приватный ключ не настроен для реальной торговли. Это необходимо для подписания транзакций.';
    }
    
    if (metadata?.step === '4_gas_too_high') {
      return 'Цена газа превышает установленный максимум. Транзакция может быть слишком дорогой.';
    }
    
    if (metadata?.step === '3_balance_check_failed' || log.message.includes('MATIC')) {
      return 'Недостаточно MATIC на балансе для оплаты газа. Пополните кошелек.';
    }
    
    if (log.message.includes('Telegram') || log.type === 'telegram') {
      return 'Проблема с подключением к Telegram боту. Проверьте токен и Chat ID.';
    }
    
    if (log.message.includes('API') || log.message.includes('1inch')) {
      return 'Ошибка при обращении к внешнему API. Возможно, превышен лимит запросов или API недоступен.';
    }
    
    // Default description
    return 'Произошла ошибка во время выполнения операции. Подробности в метаданных.';
  };

  const getRecommendation = (log: ActivityLog): string => {
    const metadata = log.metadata;
    
    if (metadata?.recommendation) {
      return metadata.recommendation;
    }
    
    if (metadata?.error === 'private_key_not_configured') {
      return 'Добавьте PRIVATE_KEY в переменные окружения (Secrets) или настройте в Settings → Safe & Ledger';
    }
    
    if (metadata?.step === '4_gas_too_high') {
      return `Дождитесь снижения цены газа или увеличьте лимит maxGasPriceGwei в Settings (текущий: ${metadata.maxGasGwei} Gwei)`;
    }
    
    if (log.message.includes('MATIC') || metadata?.step === '3_balance_check_failed') {
      return 'Пополните кошелек MATIC токенами для оплаты транзакций';
    }
    
    if (log.message.includes('Telegram')) {
      return 'Проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в Settings → Telegram. Для групп используйте отрицательный Chat ID.';
    }
    
    return 'Проверьте логи и настройки. При повторении ошибки обратитесь к документации.';
  };

  if (isLoading) {
    return (
      <Card data-testid="card-error-logs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Детальные Логи Ошибок
          </CardTitle>
          <CardDescription>Подробный анализ ошибок с рекомендациями</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-error-logs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Детальные Логи Ошибок
            </CardTitle>
            <CardDescription>Подробный анализ каждой ошибки с причинами и решениями</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive" data-testid="badge-critical-errors">
              <XCircle className="h-3 w-3 mr-1" />
              {criticalErrors.length} критических
            </Badge>
            <Badge variant="secondary" className="bg-yellow-500/20" data-testid="badge-warnings">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {warnings.length} предупреждений
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {errorLogs.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500/50" />
            <p className="text-lg font-medium">Ошибок нет! 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">
              Бот работает без проблем
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {errorLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const description = getErrorDescription(log);
                const recommendation = getRecommendation(log);
                
                return (
                  <Collapsible 
                    key={log.id} 
                    open={isExpanded} 
                    onOpenChange={() => toggleExpanded(log.id)}
                    className="border rounded-lg"
                  >
                    <div className={cn(
                      "p-4",
                      log.level === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
                    )}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getLevelIcon(log.level)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getLevelBadge(log.level)}
                            <span className="text-xs text-muted-foreground font-mono">
                              {new Date(log.createdAt).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="font-medium text-sm mb-1">{log.message}</p>
                          <p className="text-sm text-muted-foreground mb-3">{description}</p>
                          
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2">
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  Скрыть детали
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-4 w-4" />
                                  Показать детали и решение
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent className="mt-3 space-y-3">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                                    Рекомендуемое действие:
                                  </p>
                                  <p className="text-sm text-blue-600 dark:text-blue-300">
                                    {recommendation}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="bg-muted/50 rounded-md p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Технические детали:
                                </p>
                                <pre className="text-xs font-mono overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Тип:</span> {log.type} • 
                              <span className="font-medium ml-2">ID:</span> {log.id}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </div>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
