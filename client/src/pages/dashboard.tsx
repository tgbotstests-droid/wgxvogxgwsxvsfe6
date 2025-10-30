import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Activity, TrendingUp, Percent, Fuel, DollarSign, Shield, Play, Square, AlertTriangle, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ActivityFeed } from "@/components/activity-feed";
import { TelegramMessagesPanel } from "@/components/telegram-messages-panel";
import { OpenPositionsPanel } from "@/components/open-positions-panel";
import { PotentialOpportunitiesPanel } from "@/components/potential-opportunities-panel";
import { ErrorLogsDetailed } from "@/components/error-logs-detailed";
import { PerformanceAnalytics } from "@/components/performance-analytics";
import type { BotStatus, BotConfig, ArbitrageTransaction } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [showRealTradingDialog, setShowRealTradingDialog] = useState(false);

  const { data: botStatus, isLoading: statusLoading } = useQuery<BotStatus>({
    queryKey: ["/api/bot/status"],
    refetchInterval: 5000,
  });

  const { data: config, isLoading: configLoading } = useQuery<BotConfig>({
    queryKey: ["/api/bot/config"],
  });

  const { data: recentTransactions } = useQuery<ArbitrageTransaction[]>({
    queryKey: ["/api/arbitrage/transactions"],
  });

  const startBotMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bot/start", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start bot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "✅ Успех",
        description: "Бот успешно запущен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить бота",
        variant: "destructive",
      });
    },
  });

  const stopBotMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bot/stop", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to stop bot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/status"] });
      toast({
        title: "✅ Успех",
        description: "Бот остановлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось остановить бота",
        variant: "destructive",
      });
    },
  });

  const toggleModeMutation = useMutation({
    mutationFn: async (newConfig: Partial<BotConfig>) => {
      return await apiRequest("POST", "/api/bot/config", newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/config"] });
      toast({
        title: "✅ Успех",
        description: "Режим торговли изменен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить режим",
        variant: "destructive",
      });
    },
  });

  const handleToggleRealTrading = () => {
    if (config) {
      const newValue = !config.enableRealTrading;
      if (newValue) {
        setShowRealTradingDialog(true);
      } else {
        toggleModeMutation.mutate({
          enableRealTrading: false,
          useSimulation: true,
        });
      }
    }
  };

  const confirmEnableRealTrading = () => {
    toggleModeMutation.mutate({
      enableRealTrading: true,
      useSimulation: false,
    });
    setShowRealTradingDialog(false);
  };

  if (statusLoading || configLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    {
      title: "Общая Прибыль",
      value: `$${botStatus?.totalProfitUsd || "0.00"}`,
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      title: "Успешность",
      value: `${botStatus?.successRate || "0"}%`,
      icon: Percent,
      color: "text-blue-500",
    },
    {
      title: "Активные Возможности",
      value: botStatus?.activeOpportunities || 0,
      icon: Activity,
      color: "text-purple-500",
    },
    {
      title: "Затраты на Gas",
      value: `$${botStatus?.gasCostUsd || "0.00"}`,
      icon: Fuel,
      color: "text-orange-500",
    },
    {
      title: "Чистая Прибыль 24ч",
      value: `$${botStatus?.net24hUsd || "0.00"}`,
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Страховой Фонд",
      value: `$${botStatus?.insuranceFundUsd || "0.00"}`,
      icon: Shield,
      color: "text-cyan-500",
    },
  ];

  const tradingMode = config?.enableRealTrading ? "real" : "simulation";

  const chartData = (recentTransactions || [])
    .slice(-10)
    .map((tx, index) => ({
      name: `#${index + 1}`,
      profit: parseFloat(tx.profitUsd || "0"),
      gas: parseFloat(tx.gasCostUsd || "0"),
      net: parseFloat(tx.netProfitUsd || "0"),
    }));

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Панель Управления</h1>
          <p className="text-muted-foreground">Мониторинг и управление арбитражным ботом</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={botStatus?.isRunning ? "default" : "secondary"} className="text-sm px-3 py-1" data-testid="badge-bot-status">
            {botStatus?.isRunning ? "● Бот Активен" : "○ Бот Остановлен"}
          </Badge>
        </div>
      </div>

      {botStatus?.isPaused && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Бот На Паузе
            </CardTitle>
            <CardDescription>{botStatus.pauseReason || "Причина не указана"}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Режим Торговли</CardTitle>
          <CardDescription>
            Переключение между режимом симуляции и реальной торговлей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-6 rounded-lg border" 
               style={{ 
                 backgroundColor: tradingMode === "real" 
                   ? "hsl(var(--destructive) / 0.05)" 
                   : "hsl(var(--muted))"
               }}>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Badge 
                  variant={tradingMode === "simulation" ? "secondary" : "destructive"}
                  className="text-sm px-3 py-1"
                  data-testid="badge-trading-mode"
                >
                  {tradingMode === "simulation" ? "⚙️ Режим Симуляции" : "💰 Реальная Торговля"}
                </Badge>
                {tradingMode === "real" && (
                  <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                {tradingMode === "simulation" 
                  ? "Бот работает в режиме симуляции. Никакие реальные транзакции не выполняются."
                  : "⚠️ ВНИМАНИЕ: Бот выполняет реальные транзакции с использованием реальных средств!"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="trading-mode" className="text-sm font-medium">
                {tradingMode === "simulation" ? "Симуляция" : "Реальная"}
              </Label>
              <Switch
                id="trading-mode"
                checked={config?.enableRealTrading || false}
                onCheckedChange={handleToggleRealTrading}
                disabled={toggleModeMutation.isPending}
                data-testid="switch-trading-mode"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Управление Ботом</CardTitle>
          <CardDescription>Запуск и остановка арбитражного бота</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            disabled={botStatus?.isRunning || startBotMutation.isPending}
            onClick={() => startBotMutation.mutate()}
            data-testid="button-start-bot"
          >
            <Play className="mr-2 h-4 w-4" />
            {startBotMutation.isPending ? "Запуск..." : "Запустить"}
          </Button>
          <Button
            variant="destructive"
            disabled={!botStatus?.isRunning || stopBotMutation.isPending}
            onClick={() => stopBotMutation.mutate()}
            data-testid="button-stop-bot"
          >
            <Square className="mr-2 h-4 w-4" />
            {stopBotMutation.isPending ? "Остановка..." : "Остановить"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className={`h-5 w-5 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono" data-testid={`metric-${index}`}>{metric.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Прибыль vs Gas
              </CardTitle>
              <CardDescription>Последние 10 транзакций</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="profit" fill="hsl(var(--chart-1))" name="Прибыль ($)" />
                  <Bar dataKey="gas" fill="hsl(var(--chart-4))" name="Gas ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Чистая Прибыль
              </CardTitle>
              <CardDescription>Динамика по транзакциям</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    name="Чистая ($)"
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Potential Arbitrage Opportunities - Replaces empty positions list */}
      <PotentialOpportunitiesPanel />

      {/* Detailed Error Logs with Recommendations */}
      <ErrorLogsDetailed />

      {/* Open Positions Panel */}
      <OpenPositionsPanel />

      {/* Performance Analytics */}
      <PerformanceAnalytics />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Feed - Real-time logs */}
        <ActivityFeed limit={30} />

        {/* Telegram Messages */}
        <TelegramMessagesPanel />
      </div>

      <AlertDialog open={showRealTradingDialog} onOpenChange={setShowRealTradingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Включить Реальную Торговлю?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-medium">
                Вы собираетесь включить режим реальной торговли. Это означает:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Бот будет выполнять реальные транзакции</li>
                <li>Будут использованы реальные средства из вашего кошелька</li>
                <li>Вы можете потерять средства при неудачных сделках</li>
                <li>Убедитесь, что все настройки проверены</li>
              </ul>
              <p className="text-destructive font-medium text-sm">
                ⚠️ Рекомендуется сначала протестировать на небольших суммах!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-real-mode">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEnableRealTrading}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-real-mode"
            >
              Включить Реальную Торговлю
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
