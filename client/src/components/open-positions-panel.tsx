import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, X, Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { OpenPosition } from "@shared/schema";

export function OpenPositionsPanel() {
  const { data: positions, isLoading } = useQuery<OpenPosition[]>({
    queryKey: ["/api/positions/open"],
    refetchInterval: 3000, // Обновляем каждые 3 секунды для real-time P&L
  });

  if (isLoading) {
    return (
      <Card data-testid="card-open-positions">
        <CardHeader>
          <CardTitle>Открытые позиции</CardTitle>
          <CardDescription>Мониторинг активных сделок с unrealized P&L</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalUnrealizedProfit = positions?.reduce((sum, pos) => {
    const profit = parseFloat(pos.unrealizedProfitUsd || "0");
    return sum + profit;
  }, 0) || 0;

  return (
    <Card data-testid="card-open-positions">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Открытые позиции</CardTitle>
            <CardDescription>
              Мониторинг активных сделок с unrealized P&L
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Unrealized</p>
            <p
              className={`text-2xl font-bold font-mono ${
                totalUnrealizedProfit >= 0 ? "text-green-500" : "text-destructive"
              }`}
              data-testid="text-total-unrealized"
            >
              {totalUnrealizedProfit >= 0 ? "+" : ""}${totalUnrealizedProfit.toFixed(2)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!positions || positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state-positions">
            <Clock className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Нет открытых позиций</p>
            <p className="text-sm text-muted-foreground mt-1">
              Позиции появятся после выполнения arbitrage сделок
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Токены</TableHead>
                  <TableHead>Количество</TableHead>
                  <TableHead>Цена входа</TableHead>
                  <TableHead>Текущая цена</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                  <TableHead>Flash Loan</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => {
                  const unrealizedProfit = parseFloat(position.unrealizedProfitUsd || "0");
                  const unrealizedPercent = parseFloat(position.unrealizedProfitPercent || "0");
                  const isProfitable = unrealizedProfit >= 0;

                  return (
                    <TableRow key={position.id} data-testid={`position-${position.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span data-testid="text-token-in">{position.tokenIn}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span data-testid="text-token-out">{position.tokenOut}</span>
                        </div>
                        {position.dexPath && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-dex-path">
                            {position.dexPath}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono" data-testid="text-amount">
                        {parseFloat(position.amountIn).toFixed(4)}
                      </TableCell>
                      <TableCell className="font-mono" data-testid="text-entry-price">
                        ${parseFloat(position.entryPriceUsd).toFixed(6)}
                      </TableCell>
                      <TableCell className="font-mono" data-testid="text-current-price">
                        ${position.currentPriceUsd ? parseFloat(position.currentPriceUsd).toFixed(6) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isProfitable ? (
                            <TrendingUp className="h-4 w-4 text-green-500" data-testid="icon-profit" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-destructive" data-testid="icon-loss" />
                          )}
                          <div>
                            <p
                              className={`font-mono font-medium ${
                                isProfitable ? "text-green-500" : "text-destructive"
                              }`}
                              data-testid="text-unrealized-profit"
                            >
                              {isProfitable ? "+" : ""}${unrealizedProfit.toFixed(2)}
                            </p>
                            <p
                              className={`text-xs ${
                                isProfitable ? "text-green-500/80" : "text-destructive/80"
                              }`}
                              data-testid="text-unrealized-percent"
                            >
                              {isProfitable ? "+" : ""}{unrealizedPercent.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {position.flashLoanAmount ? (
                          <div>
                            <p className="font-mono text-sm" data-testid="text-flash-amount">
                              {parseFloat(position.flashLoanAmount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid="text-flash-provider">
                              {position.flashLoanProvider}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid="text-time">
                        {formatDistanceToNow(new Date(position.openedAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={position.status === "OPEN" ? "default" : "secondary"}
                          data-testid={`badge-status-${position.status}`}
                        >
                          {position.status === "OPEN" && "Открыта"}
                          {position.status === "CLOSING" && "Закрывается"}
                          {position.status === "CLOSED" && "Закрыта"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {position.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-close-${position.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Закрыть
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
