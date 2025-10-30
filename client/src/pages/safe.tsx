import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { safeClient } from "@/lib/safeClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Copy, ExternalLink, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react";
import type { SafeTransaction } from "@shared/schema";

interface SafeInfo {
  address: string;
  owners: string[];
  threshold: number;
  nonce: number;
}

export default function Safe() {
  const { toast } = useToast();
  const [proposalForm, setProposalForm] = useState({ to: "", value: "0", data: "0x" });
  const [safeAddress, setSafeAddress] = useState("");
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [confirmingTx, setConfirmingTx] = useState<string | null>(null);
  const [executingTx, setExecutingTx] = useState<string | null>(null);

  const { data: transactions, isLoading } = useQuery<SafeTransaction[]>({
    queryKey: ["/api/safe/transactions"],
    refetchInterval: 30000,
  });

  const handleInitializeSafe = async () => {
    if (!safeAddress || safeAddress.length !== 42 || !safeAddress.startsWith('0x')) {
      toast({
        title: "❌ Неверный адрес",
        description: "Введите корректный адрес Safe (0x...)",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsInitializing(true);
      await safeClient.initialize(safeAddress, 137);
      const info = await safeClient.getSafeInfo();
      setSafeInfo(info);
      toast({
        title: "✅ Safe подключен",
        description: `Владельцев: ${info?.owners.length}, Порог: ${info?.threshold}`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Ошибка инициализации",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProposing(true);
      await safeClient.proposeTransaction(proposalForm);
      queryClient.invalidateQueries({ queryKey: ["/api/safe/transactions"] });
      toast({ title: "✅ Транзакция предложена", description: "Транзакция успешно создана" });
      setProposalForm({ to: "", value: "0", data: "0x" });
    } catch (error: any) {
      toast({ title: "❌ Ошибка", description: error.message, variant: "destructive" });
    } finally {
      setIsProposing(false);
    }
  };

  const handleConfirm = async (safeTxHash: string) => {
    try {
      setConfirmingTx(safeTxHash);
      await safeClient.confirmTransaction(safeTxHash);
      queryClient.invalidateQueries({ queryKey: ["/api/safe/transactions"] });
      toast({ title: "✅ Подпись добавлена" });
    } catch (error: any) {
      toast({ title: "❌ Ошибка подписания", description: error.message, variant: "destructive" });
    } finally {
      setConfirmingTx(null);
    }
  };

  const handleExecute = async (safeTxHash: string) => {
    try {
      setExecutingTx(safeTxHash);
      const result = await safeClient.executeTransaction(safeTxHash);
      queryClient.invalidateQueries({ queryKey: ["/api/safe/transactions"] });
      
      if (result.success) {
        toast({ title: "✅ Транзакция исполнена", description: `TX: ${result.txHash?.substring(0, 10)}...` });
      } else {
        toast({ title: "❌ Ошибка", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "❌ Ошибка исполнения", description: error.message, variant: "destructive" });
    } finally {
      setExecutingTx(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Ожидает</Badge>;
      case "READY": return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Готово</Badge>;
      case "EXECUTED": return <Badge><CheckCircle2 className="h-3 w-3 mr-1" />Исполнено</Badge>;
      case "FAILED": return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Ошибка</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Gnosis Safe Multisig
        </h1>
        <p className="text-muted-foreground">Управление мультиподписными транзакциями (browser wallet)</p>
      </div>

      {!safeInfo ? (
        <Card>
          <CardHeader>
            <CardTitle>Подключить Safe</CardTitle>
            <CardDescription>Введите адрес вашего Gnosis Safe на Polygon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="safeAddress">Safe Address</Label>
              <Input
                id="safeAddress"
                value={safeAddress}
                onChange={(e) => setSafeAddress(e.target.value)}
                placeholder="0x..."
                data-testid="input-safe-address"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Адрес должен начинаться с 0x и иметь 42 символа
              </p>
            </div>
            <Button
              onClick={handleInitializeSafe}
              disabled={isInitializing || !safeAddress}
              data-testid="button-initialize-safe"
            >
              {isInitializing ? "Подключение..." : "Подключить Safe"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Информация о Safe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Адрес Safe</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-safe-address">
                    {safeInfo.address}
                  </code>
                  <button onClick={() => copyToClipboard(safeInfo.address)} className="p-1 hover:bg-muted rounded" data-testid="button-copy-safe-address">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Владельцы</p>
                <p className="text-lg font-medium" data-testid="text-safe-owners">{safeInfo.owners.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Порог Подписей</p>
                <p className="text-lg font-medium" data-testid="text-safe-threshold">{safeInfo.threshold} из {safeInfo.owners.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {safeInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Создать Транзакцию</CardTitle>
            <CardDescription>Предложить новую мультиподписную транзакцию</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePropose} className="space-y-4">
              <div>
                <Label htmlFor="to">Получатель (To)</Label>
                <Input id="to" value={proposalForm.to} onChange={(e) => setProposalForm({ ...proposalForm, to: e.target.value })} placeholder="0x..." data-testid="input-tx-to" />
              </div>
              <div>
                <Label htmlFor="value">Сумма (Wei)</Label>
                <Input id="value" value={proposalForm.value} onChange={(e) => setProposalForm({ ...proposalForm, value: e.target.value })} placeholder="0" data-testid="input-tx-value" />
              </div>
              <div>
                <Label htmlFor="data">Data (Hex)</Label>
                <Input id="data" value={proposalForm.data} onChange={(e) => setProposalForm({ ...proposalForm, data: e.target.value })} placeholder="0x" data-testid="input-tx-data" />
              </div>
              <Button type="submit" disabled={isProposing || !proposalForm.to} data-testid="button-propose-tx">
                <Send className="mr-2 h-4 w-4" />
                {isProposing ? "Создание..." : "Предложить Транзакцию"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ожидающие Транзакции</CardTitle>
          <CardDescription>Транзакции, требующие дополнительных подписей</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Получатель</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Подписи</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm" data-testid={`text-tx-hash-${tx.id}`}>{tx.safeTxHash.substring(0, 12)}...</TableCell>
                    <TableCell className="font-mono text-sm">{tx.to.substring(0, 10)}...</TableCell>
                    <TableCell>{getStatusBadge(tx.status)}</TableCell>
                    <TableCell data-testid={`text-tx-confirmations-${tx.id}`}>{tx.confirmations}/{tx.requiredConfirmations}</TableCell>
                    <TableCell className="text-sm">{new Date(tx.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {tx.status === "PENDING" && (
                          <Button size="sm" variant="outline" onClick={() => handleConfirm(tx.safeTxHash)} disabled={confirmingTx === tx.safeTxHash} data-testid={`button-confirm-${tx.id}`}>
                            {confirmingTx === tx.safeTxHash ? "..." : "Подписать"}
                          </Button>
                        )}
                        {tx.status === "READY" && (
                          <Button size="sm" onClick={() => handleExecute(tx.safeTxHash)} disabled={executingTx === tx.safeTxHash} data-testid={`button-execute-${tx.id}`}>
                            {executingTx === tx.safeTxHash ? "..." : "Исполнить"}
                          </Button>
                        )}
                        <button className="p-1 hover:bg-muted rounded"><ExternalLink className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Нет ожидающих транзакций</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">💡 Gnosis Safe SDK (Browser Wallet)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• Интеграция с Gnosis Safe Protocol Kit через browser wallet (MetaMask)</p>
          <p>• Безопасная работа БЕЗ передачи private keys на сервер</p>
          <p>• Создание, подписание и исполнение мультисиг транзакций</p>
          <p>• Автоматическая синхронизация с Safe Transaction Service</p>
          <p>• Поддержка Ledger для подписи транзакций</p>
        </CardContent>
      </Card>
    </div>
  );
}
