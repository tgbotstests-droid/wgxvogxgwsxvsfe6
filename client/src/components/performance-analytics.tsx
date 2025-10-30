import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Target, PieChart, BarChart3, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PerformanceMetrics } from "@shared/schema";

export function PerformanceAnalytics() {
  const { data: metrics, isLoading } = useQuery<PerformanceMetrics[]>({
    queryKey: ["/api/analytics/performance"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const latestMetric = metrics && metrics.length > 0 ? metrics[0] : null;

  const sharpeRatio = latestMetric?.sharpeRatio ? parseFloat(latestMetric.sharpeRatio) : 0;
  const maxDrawdown = latestMetric?.maxDrawdownPercent ? parseFloat(latestMetric.maxDrawdownPercent) : 0;
  const winRate = latestMetric?.winRate ? parseFloat(latestMetric.winRate) : 0;
  const profitFactor = latestMetric?.profitFactor ? parseFloat(latestMetric.profitFactor) : 0;

  // Prepare chart data for performance over time
  const performanceData = metrics?.slice(0, 10).reverse().map(m => ({
    period: new Date(m.periodStart).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
    netProfit: parseFloat(m.netProfitUsd || "0"),
    winRate: parseFloat(m.winRate || "0"),
    sharpe: parseFloat(m.sharpeRatio || "0"),
  })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Performance Analytics
        </CardTitle>
        <CardDescription>
          Расширенные метрики эффективности и риска
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!latestMetric ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет данных о производительности</p>
            <p className="text-sm mt-2">Метрики появятся после первых сделок</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview" data-testid="tab-analytics-overview">
                Обзор
              </TabsTrigger>
              <TabsTrigger value="charts" data-testid="tab-analytics-charts">
                Графики
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Sharpe Ratio */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Sharpe Ratio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono" data-testid="metric-sharpe-ratio">
                      {sharpeRatio.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sharpeRatio > 1 ? "Отлично" : sharpeRatio > 0.5 ? "Хорошо" : "Требует улучшения"}
                    </p>
                  </CardContent>
                </Card>

                {/* Max Drawdown */}
                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      Max Drawdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-destructive" data-testid="metric-max-drawdown">
                      {maxDrawdown.toFixed(2)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${latestMetric.maxDrawdownUsd ? parseFloat(latestMetric.maxDrawdownUsd).toFixed(2) : "0.00"}
                    </p>
                  </CardContent>
                </Card>

                {/* Win Rate */}
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Win Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono" data-testid="metric-win-rate">
                      {winRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestMetric.successfulTrades}/{latestMetric.totalTrades} сделок
                    </p>
                  </CardContent>
                </Card>

                {/* Profit Factor */}
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PieChart className="h-4 w-4" />
                      Profit Factor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono" data-testid="metric-profit-factor">
                      {profitFactor.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profitFactor > 2 ? "Отлично" : profitFactor > 1 ? "Прибыльно" : "Убыточно"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Metrics */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Детальная статистика</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Всего сделок</span>
                      <span className="font-mono font-medium">{latestMetric.totalTrades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Успешных</span>
                      <span className="font-mono font-medium text-green-600">{latestMetric.successfulTrades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Неудачных</span>
                      <span className="font-mono font-medium text-red-600">{latestMetric.failedTrades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Волатильность</span>
                      <span className="font-mono font-medium">
                        {latestMetric.volatility ? parseFloat(latestMetric.volatility).toFixed(4) : "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">P&L Метрики</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Средний профит</span>
                      <span className="font-mono font-medium text-green-600">
                        ${latestMetric.averageProfitUsd ? parseFloat(latestMetric.averageProfitUsd).toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Средний убыток</span>
                      <span className="font-mono font-medium text-red-600">
                        ${latestMetric.averageLossUsd ? parseFloat(latestMetric.averageLossUsd).toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Наибольший выигрыш</span>
                      <span className="font-mono font-medium">
                        ${latestMetric.largestWinUsd ? parseFloat(latestMetric.largestWinUsd).toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Наибольший проигрыш</span>
                      <span className="font-mono font-medium">
                        ${latestMetric.largestLossUsd ? parseFloat(latestMetric.largestLossUsd).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="charts" className="space-y-4">
              {performanceData.length > 0 && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Динамика Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={performanceData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="netProfit" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            name="Net Profit ($)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Win Rate Тренд</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={performanceData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip />
                            <Bar dataKey="winRate" fill="hsl(var(--primary))" name="Win Rate (%)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Sharpe Ratio Динамика</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={performanceData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip />
                            <Line 
                              type="monotone" 
                              dataKey="sharpe" 
                              stroke="hsl(var(--chart-2))" 
                              strokeWidth={2}
                              name="Sharpe Ratio"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
