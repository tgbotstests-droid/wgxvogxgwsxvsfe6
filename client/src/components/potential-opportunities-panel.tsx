import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Sparkles, ArrowRight, Zap, Clock, DollarSign, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ArbitrageOpportunity {
  id: string;
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
  };
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  profitPercent: number;
  netProfitPercent: number;
  estimatedProfitUsd: number;
  flashLoanAmount: string;
  estimatedGasCostUsd: number;
  flashLoanFeeUsd: number;
  route: {
    buy: string[];
    sell: string[];
  };
  timestamp: number;
  isValid: boolean;
}

interface ExecuteTradeResponse {
  success: boolean;
  profitUsd?: number;
  txHash?: string;
  message?: string;
}

export function PotentialOpportunitiesPanel() {
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());

  const { data: initialOpportunities, isLoading } = useQuery<ArbitrageOpportunity[]>({
    queryKey: ["/api/scanner/opportunities"],
    queryFn: async () => {
      const response = await fetch("/api/scanner/opportunities");
      if (!response.ok) throw new Error("Failed to fetch opportunities");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const executeTradeMutation = useMutation<ExecuteTradeResponse, Error, string>({
    mutationFn: async (opportunityId: string) => {
      const response = await apiRequest("POST", "/api/arbitrage/execute", { opportunityId });
      return await response.json() as ExecuteTradeResponse;
    },
    onSuccess: (data, opportunityId) => {
      // Remove from executing set
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunityId);
        return newSet;
      });

      if (data.success) {
        toast({
          title: "✅ Сделка выполнена!",
          description: `Прибыль: $${data.profitUsd?.toFixed(2) || '0.00'}. TX: ${data.txHash?.substring(0, 10)}...`,
        });
      } else {
        toast({
          title: "❌ Ошибка выполнения",
          description: data.message || "Не удалось выполнить сделку",
          variant: "destructive",
        });
      }
    },
    onError: (error: any, opportunityId) => {
      // Remove from executing set
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunityId);
        return newSet;
      });

      toast({
        title: "❌ Ошибка",
        description: error.message || "Не удалось выполнить сделку",
        variant: "destructive",
      });
    },
  });

  const handleExecuteTrade = (opportunityId: string) => {
    // Add to executing set
    setExecutingIds(prev => new Set(prev).add(opportunityId));
    executeTradeMutation.mutate(opportunityId);
  };

  useEffect(() => {
    if (initialOpportunities) {
      setOpportunities(initialOpportunities);
    }
  }, [initialOpportunities]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('Opportunities WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'arbitrageOpportunity' && data.data) {
          setOpportunities(prev => {
            const exists = prev.find(o => o.id === data.data.id);
            if (exists) {
              return prev.map(o => o.id === data.data.id ? data.data : o);
            }
            return [data.data, ...prev].slice(0, 20);
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Opportunities WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  if (isLoading) {
    return (
      <Card data-testid="card-potential-opportunities">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Возможные Сделки
          </CardTitle>
          <CardDescription>Найденные арбитражные возможности</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const validOpportunities = opportunities.filter(o => o.isValid && o.netProfitPercent > 0);
  const totalPotentialProfit = validOpportunities.reduce((sum, o) => sum + o.estimatedProfitUsd, 0);

  return (
    <Card data-testid="card-potential-opportunities">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Возможные Сделки
            </CardTitle>
            <CardDescription>
              Real-time мониторинг арбитражных возможностей
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Потенциальная прибыль</p>
            <p className="text-2xl font-bold font-mono text-green-500" data-testid="text-total-potential">
              ${totalPotentialProfit.toFixed(2)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {validOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state-opportunities">
            <Sparkles className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Сканер ищет возможности...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Прибыльные сделки появятся автоматически
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Токены</TableHead>
                  <TableHead>DEX Маршрут</TableHead>
                  <TableHead>Цены</TableHead>
                  <TableHead>Прибыль</TableHead>
                  <TableHead>Чистая прибыль</TableHead>
                  <TableHead>Flash Loan</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validOpportunities.map((opp) => {
                  const timeSince = Date.now() - opp.timestamp;
                  const isRecent = timeSince < 30000;

                  return (
                    <TableRow 
                      key={opp.id} 
                      data-testid={`opportunity-${opp.id}`}
                      className={isRecent ? "bg-accent/20" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span data-testid="text-token-in">{opp.tokenIn.symbol}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span data-testid="text-token-out">{opp.tokenOut.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Badge variant="outline" className="text-xs" data-testid="badge-buy-dex">
                              📈 {opp.buyDex}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Badge variant="outline" className="text-xs" data-testid="badge-sell-dex">
                              📉 {opp.sellDex}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm font-mono">
                          <div className="text-green-600 dark:text-green-400" data-testid="text-buy-price">
                            Buy: ${opp.buyPrice.toFixed(6)}
                          </div>
                          <div className="text-blue-600 dark:text-blue-400" data-testid="text-sell-price">
                            Sell: ${opp.sellPrice.toFixed(6)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="font-mono font-medium text-green-500" data-testid="text-gross-profit">
                              +${opp.estimatedProfitUsd.toFixed(2)}
                            </p>
                            <p className="text-xs text-green-500/80" data-testid="text-profit-percent">
                              {opp.profitPercent.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="font-mono font-medium text-yellow-600 dark:text-yellow-400" data-testid="text-net-profit">
                              +${(opp.estimatedProfitUsd - opp.estimatedGasCostUsd - opp.flashLoanFeeUsd).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid="text-net-percent">
                              {opp.netProfitPercent.toFixed(2)}% чист.
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm" data-testid="text-flash-amount">
                            ${parseFloat(opp.flashLoanAmount).toFixed(0)}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid="text-flash-fee">
                            Fee: ${opp.flashLoanFeeUsd.toFixed(2)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid="text-time">
                        <div className="flex items-center gap-1">
                          {isRecent && <Badge variant="default" className="text-xs">NEW</Badge>}
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(opp.timestamp), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleExecuteTrade(opp.id)}
                          disabled={executingIds.has(opp.id)}
                          data-testid={`button-execute-${opp.id}`}
                        >
                          {executingIds.has(opp.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Выполняется...
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-4 w-4 mr-1" />
                              Выполнить
                            </>
                          )}
                        </Button>
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
