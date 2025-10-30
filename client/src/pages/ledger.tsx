import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ledgerClient } from "@/lib/ledgerClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Usb, Battery, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Info, Power, PowerOff } from "lucide-react";
import type { LedgerStatus } from "@shared/schema";

export default function Ledger() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: ledgerStatus, isLoading, refetch } = useQuery<LedgerStatus>({
    queryKey: ["/api/ledger/status"],
    refetchInterval: 10000,
  });

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const deviceInfo = await ledgerClient.connect();
      
      // Refetch status from server
      await refetch();
      
      toast({
        title: "✅ Ledger подключен",
        description: `Устройство ${deviceInfo.model} ус��ешно подключено`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Ошибка подключения",
        description: error.message || "Не удалось подключить Ledger",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await ledgerClient.disconnect();
      
      // Refetch status from server
      await refetch();
      
      toast({
        title: "Отключено",
        description: "Ledger устройство отключено",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отключить Ledger",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const batteryColor = (level: number | undefined | null) => {
    if (!level) return "bg-gray-500";
    if (level > 50) return "bg-green-500";
    if (level > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger Hardware Wallet</h1>
        <p className="text-muted-foreground">Управление аппаратным кошельком через WebUSB</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Usb className="h-5 w-5" />
              Статус Подключения
            </CardTitle>
            <Badge variant={ledgerStatus?.connected ? "default" : "secondary"} data-testid="badge-ledger-status">
              {ledgerStatus?.connected ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Подключен</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Отключен</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ledgerStatus?.connected ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Модель</p>
                  <p className="font-medium" data-testid="text-ledger-model">
                    {ledgerStatus.deviceModel || "Неизвестно"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Прошивка</p>
                  <p className="font-medium" data-testid="text-ledger-firmware">
                    {ledgerStatus.firmwareVersion || "—"}
                  </p>
                </div>
              </div>

              {ledgerStatus.address && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ethereum Адрес</p>
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded block" data-testid="text-ledger-address">
                    {ledgerStatus.address}
                  </code>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className="h-4 w-4" />
                    <span className="text-sm font-medium">Уровень Батареи</span>
                  </div>
                  <span className="text-sm font-medium" data-testid="text-battery-level">
                    {ledgerStatus.batteryLevel || 0}%
                  </span>
                </div>
                <Progress
                  value={ledgerStatus.batteryLevel || 0}
                  className={`h-2 ${batteryColor(ledgerStatus.batteryLevel)}`}
                />
                {ledgerStatus.batteryLevel && ledgerStatus.batteryLevel < 20 && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Низкий заряд батареи. Подключите устройство к зарядке.
                  </p>
                )}
              </div>

              {ledgerStatus.lastConnectedAt && (
                <p className="text-xs text-muted-foreground">
                  Последнее подключение: {new Date(ledgerStatus.lastConnectedAt).toLocaleString('ru-RU')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-4">
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  data-testid="button-refresh-ledger"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Обновить
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  disabled={isDisconnecting}
                  data-testid="button-disconnect-ledger"
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  {isDisconnecting ? "Отключение..." : "Отключить"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Usb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Ledger устройство не подключено
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                1. Подключите Ledger через USB<br />
                2. Разблокируйте устройство<br />
                3. Откройте приложение Ethereum
              </p>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                data-testid="button-connect-ledger"
              >
                <Power className="mr-2 h-4 w-4" />
                {isConnecting ? "Подключение..." : "Подключить Ledger"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последние Подписи</CardTitle>
          <CardDescription>История подписанных транзакций через Ledger</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Нет данных о подписях
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Возможности WebUSB
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• Подключение Ledger напрямую из браузера (Chrome/Edge)</p>
          <p>• Безопасное подписание транзакций на устройстве</p>
          <p>• Автоматическое отображение деталей транзакции на экране Ledger</p>
          <p>• Поддержка использования для второй подписи Safe Multisig</p>
          <p>• Контроль батареи и автоматический fallback на альтернативные методы</p>
        </CardContent>
      </Card>
    </div>
  );
}
