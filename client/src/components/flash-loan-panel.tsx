import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, TrendingUp, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { FlashLoanRequest, BotConfig } from "@shared/schema";

export function FlashLoanPanel() {
  const { toast } = useToast();
  const [token, setToken] = useState("USDC");
  const [amount, setAmount] = useState("10000");
  const [provider, setProvider] = useState("aave_v3");

  const { data: requests, isLoading: requestsLoading } = useQuery<FlashLoanRequest[]>({
    queryKey: ["/api/flashloan/requests"],
    refetchInterval: 5000,
  });

  const { data: config } = useQuery<BotConfig>({
    queryKey: ["/api/bot/config"],
  });

  const executeFlashLoanMutation = useMutation({
    mutationFn: async (data: { token: string; amount: string; provider: string }) => {
      return await apiRequest("POST", "/api/flashloan/execute", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashloan/requests"] });
      toast({
        title: "✅ Flash Loan выполнен",
        description: "Запрос на flash loan успешно отправлен",
      });
      setAmount("10000");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось выполнить flash loan",
        variant: "destructive",
      });
    },
  });

  const handleExecute = () => {
    if (!config?.flashLoanContract) {
      toast({
        title: "Контракт не настроен",
        description: "Пожалуйста, настройте Flash Loan контракт в Settings",
        variant: "destructive",
      });
      return;
    }

    executeFlashLoanMutation.mutate({ token, amount, provider });
  };

  const recentRequests = requests?.slice(0, 10) || [];
  const successCount = requests?.filter((r) => r.status === "SUCCESS").length || 0;
  const totalProfit = requests
    ?.filter((r) => r.status === "SUCCESS")
    .reduce((sum, r) => sum + parseFloat(r.profitUsd || "0"), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Execute Flash Loan Card */}
      <Card data-testid="card-flash-loan-execute">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Aave V3 Flash Loans
          </CardTitle>
          <CardDescription>
            Выполнение мгновенных займов для арбитражных операций
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Токен</Label>
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger id="token" data-testid="select-token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="DAI">DAI</SelectItem>
                    <SelectItem value="WETH">WETH</SelectItem>
                    <SelectItem value="WMATIC">WMATIC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Сумма</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  data-testid="input-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Максимум: ${config?.maxLoanUsd || 50000}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Провайдер</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="provider" data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aave_v3">Aave V3</SelectItem>
                    <SelectItem value="balancer">Balancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleExecute}
                disabled={executeFlashLoanMutation.isPending || !config?.flashLoanContract}
                className="w-full"
                data-testid="button-execute-flash-loan"
              >
                <Zap className="mr-2 h-4 w-4" />
                {executeFlashLoanMutation.isPending ? "Выполнение..." : "Выполнить Flash Loan"}
              </Button>

              {!config?.flashLoanContract && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-500">
                    Настройте Flash Loan контракт в Settings для использования этой функции
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Успешных займов</p>
                    <p className="text-2xl font-bold" data-testid="text-success-count">
                      {successCount}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Общая прибыль</p>
                    <p className="text-2xl font-bold text-green-500" data-testid="text-total-profit">
                      ${totalProfit.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Как это работает
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Мгновенный займ без залога</li>
                  <li>• Выполнение арбитражной сделки</li>
                  <li>• Возврат займа + комиссия (0.09%)</li>
                  <li>• Прибыль зачисляется на кошелек</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests Table */}
      <Card data-testid="card-flash-loan-history">
        <CardHeader>
          <CardTitle>История Flash Loans</CardTitle>
          <CardDescription>Последние запросы на мгновенные займы</CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : recentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state-requests">
              <Zap className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Нет выполненных flash loans
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                История появится после первого запроса
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead>Токен</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Комиссия</TableHead>
                    <TableHead>Прибыль</TableHead>
                    <TableHead>Gas</TableHead>
                    <TableHead>Время</TableHead>
                    <TableHead>TX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRequests.map((request) => (
                    <TableRow key={request.id} data-testid={`request-${request.id}`}>
                      <TableCell>
                        {request.status === "SUCCESS" && (
                          <Badge variant="default" className="gap-1" data-testid="badge-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Успех
                          </Badge>
                        )}
                        {request.status === "FAILED" && (
                          <Badge variant="destructive" className="gap-1" data-testid="badge-failed">
                            <XCircle className="h-3 w-3" />
                            Ошибка
                          </Badge>
                        )}
                        {request.status === "PENDING" && (
                          <Badge variant="secondary" data-testid="badge-pending">
                            Ожидание
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium" data-testid="text-token">
                        {request.token}
                      </TableCell>
                      <TableCell className="font-mono" data-testid="text-amount">
                        {parseFloat(request.amount).toLocaleString()}
                      </TableCell>
                      <TableCell data-testid="text-provider">{request.provider}</TableCell>
                      <TableCell className="font-mono" data-testid="text-premium">
                        {request.premium ? parseFloat(request.premium).toFixed(4) : "-"}
                      </TableCell>
                      <TableCell>
                        {request.profitUsd ? (
                          <span
                            className={`font-mono ${
                              parseFloat(request.profitUsd) >= 0
                                ? "text-green-500"
                                : "text-destructive"
                            }`}
                            data-testid="text-profit"
                          >
                            ${parseFloat(request.profitUsd).toFixed(2)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="font-mono" data-testid="text-gas">
                        {request.gasCostUsd ? `$${parseFloat(request.gasCostUsd).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid="text-time">
                        {formatDistanceToNow(new Date(request.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </TableCell>
                      <TableCell>
                        {request.txHash ? (
                          <Button variant="ghost" size="sm" data-testid="button-view-tx">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
