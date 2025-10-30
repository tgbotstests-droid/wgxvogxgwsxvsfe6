import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Search, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { ExportTransactions } from "@/components/export-transactions";
import type { ArbitrageTransaction } from "@shared/schema";

export default function Transactions() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: transactions, isLoading } = useQuery<ArbitrageTransaction[]>({
    queryKey: ["/api/arbitrage/transactions"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const filteredTransactions = (transactions || []).filter((tx) => {
    const matchesSearch = tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (tx.tokenIn && tx.tokenIn.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (tx.tokenOut && tx.tokenOut.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      SUCCESS: "default",
      FAILED: "destructive",
      PENDING: "secondary",
    } as const;
    return variants[status as keyof typeof variants] || "secondary";
  };

  const openPolygonscan = (txHash: string) => {
    window.open(`https://polygonscan.com/tx/${txHash}`, "_blank");
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          История Транзакций
        </h1>
        <p className="text-muted-foreground">Все арбитражные операции</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего Транзакций</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{transactions?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Успешных</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-500">
              {transactions?.filter(tx => tx.status === "SUCCESS").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Неудачных</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-500">
              {transactions?.filter(tx => tx.status === "FAILED").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Арбитражные Транзакции</CardTitle>
              <CardDescription>История выполненных сделок с PolygonScan интеграцией</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по hash, токену..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-transactions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="SUCCESS">Успех</SelectItem>
                  <SelectItem value="FAILED">Неудача</SelectItem>
                  <SelectItem value="PENDING">Ожидание</SelectItem>
                </SelectContent>
              </Select>
              <ExportTransactions transactions={filteredTransactions} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Токены</TableHead>
                    <TableHead className="text-right">Прибыль</TableHead>
                    <TableHead className="text-right">Gas</TableHead>
                    <TableHead className="text-right">Чистая</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover-elevate" data-testid={`row-transaction-${tx.id}`}>
                      <TableCell className="text-sm">
                        {new Date(tx.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{tx.tokenIn || "?"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{tx.tokenOut || "?"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${tx.profitUsd ? parseFloat(tx.profitUsd).toFixed(2) : "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        ${tx.gasCostUsd ? parseFloat(tx.gasCostUsd).toFixed(2) : "0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={tx.netProfitUsd && parseFloat(tx.netProfitUsd) > 0 ? "text-green-500" : "text-red-500"}>
                          ${tx.netProfitUsd ? parseFloat(tx.netProfitUsd).toFixed(2) : "0.00"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadge(tx.status)} data-testid={`badge-status-${tx.id}`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openPolygonscan(tx.txHash)}
                          data-testid={`button-polygonscan-${tx.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет транзакций</p>
              {searchQuery && (
                <p className="text-sm mt-2">Попробуйте изменить поисковый запрос</p>
              )}
            </div>
          )}

          {filteredTransactions.length > 0 && (
            <div className="text-sm text-muted-foreground mt-4">
              Показано {filteredTransactions.length} из {transactions?.length || 0} транзакций
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">💡 Информация</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• Транзакции обновляются автоматически каждые 30 секунд</p>
          <p>• Нажмите на иконку <ExternalLink className="inline h-3 w-3" /> для просмотра в PolygonScan</p>
          <p>• Зеленый цвет = прибыльная сделка, красный = убыточная</p>
          <p>• Используйте фильтры для быстрого поиска нужных транзакций</p>
        </CardContent>
      </Card>
    </div>
  );
}
