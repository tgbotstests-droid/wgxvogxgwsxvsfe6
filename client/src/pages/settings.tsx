import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ExternalLink, AlertTriangle, CheckCircle2, Network, Zap, Shield, Bell, DollarSign, Info } from "lucide-react";
import { TokenWhitelistManager } from "@/components/token-whitelist-manager";
import { WebhookManager } from "@/components/webhook-manager";
import type { BotConfig } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

function TestTelegramButton({ savedConfig }: { savedConfig?: BotConfig }) {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  const testTelegram = async () => {
    if (!savedConfig?.telegramBotToken || !savedConfig?.telegramChatId) {
      toast({
        title: "Настройки не сохранены",
        description: "Сначала сохраните Bot Token и Chat ID",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await apiRequest("POST", "/api/telegram/test", {});

      if (response.success) {
        toast({
          title: "✅ Telegram подключен!",
          description: `Бот: @${response.botUsername}. Проверьте сообщение в чате.`,
        });
      } else {
        toast({
          title: "Ошибка подключения",
          description: response.error || "Не удалось подключиться к Telegram",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось проверить Telegram",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Button
      onClick={testTelegram}
      disabled={isTesting}
      variant="outline"
      className="w-full"
      data-testid="button-test-telegram"
    >
      <Bell className="mr-2 h-4 w-4" />
      {isTesting ? "Проверка..." : "Проверить Telegram"}
    </Button>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Partial<BotConfig>>({});
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const { data: savedConfig, isLoading } = useQuery<BotConfig>({
    queryKey: ["/api/bot/config"],
  });

  useEffect(() => {
    loadSettings();
    loadTelegramStatus();
  }, []);

  const loadSettings = () => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  };

  const loadTelegramStatus = async () => {
    try {
      const response = await fetch("/api/telegram/status", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTelegramEnabled(data.enabled);
        setTelegramBotToken(data.botToken || "");
        setTelegramChatId(data.chatId || "");
      }
    } catch (error) {
      console.error("Failed to load Telegram status:", error);
    }
  };

  const toggleTelegram = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/telegram/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setTelegramEnabled(enabled);
        toast({
          title: enabled ? "Telegram включен" : "Telegram выключен",
          description: enabled
            ? "Модуль Telegram активирован"
            : "Модуль Telegram деактивирован",
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось изменить настройки Telegram",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить настройки Telegram",
        variant: "destructive",
      });
    }
  };

  const saveTelegramConfig = async () => {
    try {
      const response = await fetch("/api/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          telegramBotToken,
          telegramChatId,
        }),
      });

      if (response.ok) {
        toast({
          title: "✅ Настройки Telegram сохранены",
          description: "Параметры Telegram успешно обновлены",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/bot/config"] });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить настройки Telegram",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки Telegram",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    saveMutation.mutate(config);
    if (telegramEnabled) {
      saveTelegramConfig();
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BotConfig>) => {
      return await apiRequest("POST", "/api/bot/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/config"] });
      toast({
        title: "✅ Сохранено",
        description: "Настройки успешно обновлены",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
          <p className="text-muted-foreground">Конфигурация арбитражного бота</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-settings"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>

      <Tabs defaultValue="network" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="network" data-testid="tab-network">
            <Network className="h-4 w-4 mr-2" />
            Сеть
          </TabsTrigger>
          <TabsTrigger value="trading" data-testid="tab-trading">
            <Zap className="h-4 w-4 mr-2" />
            Торговля
          </TabsTrigger>
          <TabsTrigger value="safe" data-testid="tab-safe">
            <Shield className="h-4 w-4 mr-2" />
            Safe & Ledger
          </TabsTrigger>
          <TabsTrigger value="telegram" data-testid="tab-telegram">
            <Bell className="h-4 w-4 mr-2" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <DollarSign className="h-4 w-4 mr-2" />
            Риски
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Сеть и RPC</CardTitle>
              <CardDescription>Настройки подключения к блокчейну Polygon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="network-mode">Режим Сети</Label>
                <select
                  id="network-mode"
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={config.networkMode || "testnet"}
                  onChange={(e) => setConfig({ ...config, networkMode: e.target.value })}
                  data-testid="select-network-mode"
                >
                  <option value="testnet">Testnet (Amoy)</option>
                  <option value="mainnet">Mainnet (Polygon)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="polygon-rpc">Polygon RPC URL</Label>
                <Input
                  id="polygon-rpc"
                  placeholder="https://polygon-rpc.com"
                  value={config.polygonRpcUrl || ""}
                  onChange={(e) => setConfig({ ...config, polygonRpcUrl: e.target.value })}
                  data-testid="input-polygon-rpc"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testnet-rpc">Testnet RPC URL</Label>
                <Input
                  id="testnet-rpc"
                  placeholder="https://rpc.ankr.com/polygon_amoy"
                  value={config.polygonTestnetRpcUrl || ""}
                  onChange={(e) => setConfig({ ...config, polygonTestnetRpcUrl: e.target.value })}
                  data-testid="input-testnet-rpc"
                />
                <p className="text-xs text-muted-foreground">
                  Получить RPC:
                  <a href="https://chainlist.org/chain/137" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                    Chainlist <ExternalLink className="inline h-3 w-3" />
                  </a>
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="flash-loan-contract">Flash Loan Contract Address</Label>
                <div className="space-y-2">
                  <Input
                    id="flashLoanContract"
                    value={config.flashLoanContract || ""}
                    onChange={(e) => setConfig({ ...config, flashLoanContract: e.target.value })}
                    placeholder="0x..."
                    data-testid="input-flashloan-contract"
                  />
                  {!config.flashLoanContract && (
                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-blue-500">Контракт не развернут</p>
                        <p>Для реальной торговли разверните ArbitrageExecutor контракт:</p>
                        <code className="block mt-2 p-2 bg-muted rounded text-xs">
                          cd contracts && npm install && npm run deploy:{config.networkMode === 'mainnet' ? 'polygon' : 'mumbai'}
                        </code>
                        <p className="mt-2">См. contracts/README.md для подробностей</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">API Keys</h4>

              <div className="space-y-2">
                <Label htmlFor="private-key" className="flex items-center gap-2">
                  Private Key (для реальной торговли)
                  {!config.privateKey && (
                    <Badge variant="destructive" className="text-xs">
                      Требуется для реальной торговли
                    </Badge>
                  )}
                </Label>
                <Input
                  id="private-key"
                  placeholder="0x... (64 символа после 0x)"
                  type="password"
                  value={config.privateKey || ''}
                  onChange={(e) => setConfig({ ...config, privateKey: e.target.value })}
                  data-testid="input-private-key"
                />
                <p className="text-xs text-muted-foreground">
                  {!config.privateKey ? (
                    <span className="text-destructive font-medium">
                      ⚠️ ОБЯЗАТЕЛЬНО для реальной торговли!
                    </span>
                  ) : (
                    <span className="text-green-600">✅ Private key настроен</span>
                  )}
                  {' '}Приватный ключ кошелька Ethereum/Polygon (начинается с 0x). Хранится в зашифрованном виде.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="polygonscan-api-key" className="flex items-center gap-2">
                  PolygonScan API Key
                  <Badge variant="outline" className="text-xs">
                    Для верификации контрактов
                  </Badge>
                </Label>
                <Input
                  id="polygonscan-api-key"
                  placeholder="Введите ваш PolygonScan API ключ"
                  type="password"
                  value={config.polygonscanApiKey || ''}
                  onChange={(e) => setConfig({ ...config, polygonscanApiKey: e.target.value })}
                  data-testid="input-polygonscan-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  {config.polygonscanApiKey ? (
                    <span className="text-green-600">✅ API ключ настроен</span>
                  ) : (
                    <span>Необходим для верификации смарт-контрактов.</span>
                  )}
                  {' '}Получите бесплатный ключ на{' '}
                  <a
                    href="https://polygonscan.com/myapikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    polygonscan.com/myapikey
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="oneinch-api-key" className="flex items-center gap-2">
                  1inch API Key
                  {!config.oneinchApiKey && (
                    <Badge variant="destructive" className="text-xs">
                      Требуется для реальной торговли
                    </Badge>
                  )}
                </Label>
                <Input
                  id="oneinch-api-key"
                  placeholder="Введите ваш 1inch API ключ"
                  type="password"
                  value={config.oneinchApiKey || ''}
                  onChange={(e) => setConfig({ ...config, oneinchApiKey: e.target.value })}
                  data-testid="input-oneinch-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  {!config.oneinchApiKey ? (
                    <span className="text-destructive font-medium">
                      ⚠️ ОБЯЗАТЕЛЬНО для реальной торговли!
                    </span>
                  ) : (
                    <span className="text-green-600">✅ API ключ настроен</span>
                  )}
                  {' '}Получите бесплатный ключ на{' '}
                  <a
                    href="https://portal.1inch.dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    portal.1inch.dev
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gecko-terminal-enabled">GeckoTerminal API (Бесплатно)</Label>
                  <Switch
                    id="gecko-terminal-enabled"
                    checked={config.geckoTerminalEnabled !== false}
                    onCheckedChange={(checked) => setConfig({ ...config, geckoTerminalEnabled: checked })}
                    data-testid="switch-gecko-terminal"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  GeckoTerminal API - бесплатный, без регистрации. 30 запросов/мин.
                </p>
              </div>

              <Separator />

              <h4 className="font-medium">Rate Limits</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="oneinch-rate">1inch Rate Limit</Label>
                  <Input
                    id="oneinch-rate"
                    type="number"
                    value={config.oneinchRateLimit || 150}
                    onChange={(e) => setConfig({ ...config, oneinchRateLimit: parseInt(e.target.value) || 150 })}
                    data-testid="input-oneinch-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gecko-rate">GeckoTerminal Limit</Label>
                  <Input
                    id="gecko-rate"
                    type="number"
                    value={config.geckoTerminalRateLimit || 30}
                    onChange={(e) => setConfig({ ...config, geckoTerminalRateLimit: parseInt(e.target.value) || 30 })}
                    data-testid="input-gecko-rate"
                  />
                  <p className="text-xs text-muted-foreground">Рекомендуется: 30 запросов/мин</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quickswap-rate">QuickSwap Rate Limit</Label>
                  <Input
                    id="quickswap-rate"
                    type="number"
                    value={config.quickswapRateLimit || 1000}
                    onChange={(e) => setConfig({ ...config, quickswapRateLimit: parseInt(e.target.value) || 1000 })}
                    data-testid="input-quickswap-rate"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Торговые Параметры</CardTitle>
              <CardDescription>Настройки стратегии и прибыльности</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-profit">Мин. Прибыль (%)</Label>
                  <Input
                    id="min-profit"
                    type="number"
                    step="0.01"
                    value={config.minProfitPercent || ""}
                    onChange={(e) => setConfig({ ...config, minProfitPercent: e.target.value })}
                    data-testid="input-min-profit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-net-profit">Мин. Чистая Прибыль (%)</Label>
                  <Input
                    id="min-net-profit"
                    type="number"
                    step="0.01"
                    value={config.minNetProfitPercent || ""}
                    onChange={(e) => setConfig({ ...config, minNetProfitPercent: e.target.value })}
                    data-testid="input-min-net-profit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-net-profit-usd">Мин. Чистая Прибыль ($)</Label>
                  <Input
                    id="min-net-profit-usd"
                    type="number"
                    step="0.01"
                    value={config.minNetProfitUsd || ""}
                    onChange={(e) => setConfig({ ...config, minNetProfitUsd: e.target.value })}
                    data-testid="input-min-net-profit-usd"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flash-loan-amount">Сумма Flash Loan (USDC)</Label>
                  <Input
                    id="flash-loan-amount"
                    type="number"
                    value={config.flashLoanAmount || ""}
                    onChange={(e) => setConfig({ ...config, flashLoanAmount: parseInt(e.target.value) || 0 })}
                    data-testid="input-flash-loan-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scan-interval">Интервал Сканирования (сек)</Label>
                  <Input
                    id="scan-interval"
                    type="number"
                    value={config.scanInterval || 30}
                    onChange={(e) => setConfig({ ...config, scanInterval: parseInt(e.target.value) || 30 })}
                    data-testid="input-scan-interval"
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">Gas Настройки</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-gas">Макс. Gas Price (Gwei)</Label>
                  <Input
                    id="max-gas"
                    type="number"
                    value={config.maxGasPriceGwei || ""}
                    onChange={(e) => setConfig({ ...config, maxGasPriceGwei: parseInt(e.target.value) || 0 })}
                    data-testid="input-max-gas"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority-fee">Priority Fee (Gwei)</Label>
                  <Input
                    id="priority-fee"
                    type="number"
                    step="0.1"
                    value={config.priorityFeeGwei || ""}
                    onChange={(e) => setConfig({ ...config, priorityFeeGwei: e.target.value })}
                    data-testid="input-priority-fee"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base-fee-multiplier">Base Fee Multiplier</Label>
                  <Input
                    id="base-fee-multiplier"
                    type="number"
                    step="0.001"
                    value={config.baseFeeMultiplier || ""}
                    onChange={(e) => setConfig({ ...config, baseFeeMultiplier: e.target.value })}
                    data-testid="input-base-fee-multiplier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-gas-limit">Макс. Gas Limit</Label>
                  <Input
                    id="max-gas-limit"
                    type="number"
                    value={config.maxGasLimit || 1500000}
                    onChange={(e) => setConfig({ ...config, maxGasLimit: parseInt(e.target.value) || 1500000 })}
                    data-testid="input-max-gas-limit"
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">Дополнительные Параметры</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="liquidity-multiplier">Liquidity Multiplier</Label>
                  <Input
                    id="liquidity-multiplier"
                    type="number"
                    value={config.liquidityMultiplier || 5}
                    onChange={(e) => setConfig({ ...config, liquidityMultiplier: parseInt(e.target.value) || 5 })}
                    data-testid="input-liquidity-multiplier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dex-reserve-multiplier">DEX Reserve Multiplier</Label>
                  <Input
                    id="dex-reserve-multiplier"
                    type="number"
                    value={config.dexReserveMultiplier || 10}
                    onChange={(e) => setConfig({ ...config, dexReserveMultiplier: parseInt(e.target.value) || 10 })}
                    data-testid="input-dex-reserve-multiplier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="static-slippage">Static Slippage (%)</Label>
                  <Input
                    id="static-slippage"
                    type="number"
                    step="0.01"
                    value={config.staticSlippagePercent || ""}
                    onChange={(e) => setConfig({ ...config, staticSlippagePercent: e.target.value })}
                    data-testid="input-static-slippage"
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">Retry & Timeout</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-retry">Макс. Попыток Retry</Label>
                  <Input
                    id="max-retry"
                    type="number"
                    value={config.maxRetryAttempts || 3}
                    onChange={(e) => setConfig({ ...config, maxRetryAttempts: parseInt(e.target.value) || 3 })}
                    data-testid="input-max-retry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry-delay">Задержка Retry (сек)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    value={config.retryDelaySeconds || 5}
                    onChange={(e) => setConfig({ ...config, retryDelaySeconds: parseInt(e.target.value) || 5 })}
                    data-testid="input-retry-delay"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gnosis Safe Multisig</CardTitle>
              <CardDescription>Настройки мультиподписи</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="safe-address">Адрес Safe</Label>
                <Input
                  id="safe-address"
                  placeholder="0x..."
                  value={config.gnosisSafeAddress || ""}
                  onChange={(e) => setConfig({ ...config, gnosisSafeAddress: e.target.value })}
                  className="font-mono text-sm"
                  data-testid="input-safe-address"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Автоматическая Подпись</Label>
                  <p className="text-sm text-muted-foreground">
                    Автоматически подписывать транзакции
                  </p>
                </div>
                <Switch
                  checked={config.safeAutoSignEnabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, safeAutoSignEnabled: checked })}
                  data-testid="switch-safe-auto-sign"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="safe-retry-interval">Интервал Проверки (мин)</Label>
                  <Input
                    id="safe-retry-interval"
                    type="number"
                    value={config.safeRetryIntervalMinutes || 30}
                    onChange={(e) => setConfig({ ...config, safeRetryIntervalMinutes: parseInt(e.target.value) || 30 })}
                    data-testid="input-safe-retry-interval"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safe-max-pending">Макс. Ожидание (часы)</Label>
                  <Input
                    id="safe-max-pending"
                    type="number"
                    value={config.safeMaxPendingHours || 24}
                    onChange={(e) => setConfig({ ...config, safeMaxPendingHours: parseInt(e.target.value) || 24 })}
                    data-testid="input-safe-max-pending"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ledger Hardware Wallet</CardTitle>
              <CardDescription>Настройки аппаратного кошелька</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Включить Ledger</Label>
                  <p className="text-sm text-muted-foreground">
                    Использовать Ledger для подписи
                  </p>
                </div>
                <Switch
                  checked={config.ledgerEnabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, ledgerEnabled: checked })}
                  data-testid="switch-ledger-enabled"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ledger-timeout">Timeout (секунды)</Label>
                  <Input
                    id="ledger-timeout"
                    type="number"
                    value={config.ledgerTimeoutSeconds || 10}
                    onChange={(e) => setConfig({ ...config, ledgerTimeoutSeconds: parseInt(e.target.value) || 10 })}
                    data-testid="input-ledger-timeout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ledger-low-battery">Низкий Заряд (%)</Label>
                  <Input
                    id="ledger-low-battery"
                    type="number"
                    value={config.ledgerLowBatteryThreshold || 20}
                    onChange={(e) => setConfig({ ...config, ledgerLowBatteryThreshold: parseInt(e.target.value) || 20 })}
                    data-testid="input-ledger-low-battery"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ledger-critical-battery">Критический Заряд (%)</Label>
                  <Input
                    id="ledger-critical-battery"
                    type="number"
                    value={config.ledgerCriticalBatteryThreshold || 10}
                    onChange={(e) => setConfig({ ...config, ledgerCriticalBatteryThreshold: parseInt(e.target.value) || 10 })}
                    data-testid="input-ledger-critical-battery"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ledger-derivation">Derivation Path</Label>
                <Input
                  id="ledger-derivation"
                  placeholder="44'/60'/0'/0/0"
                  value={config.ledgerDerivationPath || ""}
                  onChange={(e) => setConfig({ ...config, ledgerDerivationPath: e.target.value })}
                  className="font-mono text-sm"
                  data-testid="input-ledger-derivation"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Telegram QR Fallback</Label>
                  <p className="text-sm text-muted-foreground">
                    Отправлять QR при timeout
                  </p>
                </div>
                <Switch
                  checked={config.ledgerTelegramFallback || false}
                  onCheckedChange={(checked) => setConfig({ ...config, ledgerTelegramFallback: checked })}
                  data-testid="switch-ledger-telegram-fallback"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Проверка Батареи</Label>
                  <p className="text-sm text-muted-foreground">
                    Проверять заряд перед подписью
                  </p>
                </div>
                <Switch
                  checked={config.ledgerBatteryCheckEnabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, ledgerBatteryCheckEnabled: checked })}
                  data-testid="switch-ledger-battery-check"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Отклонять при Критическом Заряде</Label>
                  <p className="text-sm text-muted-foreground">
                    Блокировать подпись при критически низком заряде
                  </p>
                </div>
                <Switch
                  checked={config.ledgerRejectOnCriticalBattery || false}
                  onCheckedChange={(checked) => setConfig({ ...config, ledgerRejectOnCriticalBattery: checked })}
                  data-testid="switch-ledger-reject-critical"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Использовать для Safe Signer 2</Label>
                  <p className="text-sm text-muted-foreground">
                    Ledger как второй подписант Safe
                  </p>
                </div>
                <Switch
                  checked={config.useLedgerForSafeSigner2 || false}
                  onCheckedChange={(checked) => setConfig({ ...config, useLedgerForSafeSigner2: checked })}
                  data-testid="switch-ledger-safe-signer2"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Telegram модуль</CardTitle>
              <CardDescription>
                Включите Telegram для получения уведомлений о торговых операциях
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="telegram-enabled" className="flex flex-col space-y-1">
                  <span>Включить Telegram</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Активировать интеграцию с Telegram ботом
                  </span>
                </Label>
                <Switch
                  id="telegram-enabled"
                  checked={telegramEnabled}
                  onCheckedChange={toggleTelegram}
                />
              </div>
            </CardContent>
          </Card>

          {telegramEnabled && (
            <Card>
              <CardHeader>
                <CardTitle>Настройки Telegram</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="telegram-token">Bot Token</Label>
                  <Input
                    id="telegram-token"
                    type="password"
                    placeholder="••••••••:••••••••••••••••••••••••"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="font-mono"
                    data-testid="input-telegram-token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Создайте бота через{" "}
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      @BotFather <ExternalLink className="inline h-3 w-3" />
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram-chat-id">Chat ID</Label>
                  <Input
                    id="telegram-chat-id"
                    placeholder="123456789 или -1001234567890 для групп"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="font-mono"
                    data-testid="input-telegram-chat-id"
                  />
                  <p className="text-xs text-muted-foreground">
                    Личный чат: получите ID через{" "}
                    <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      @userinfobot <ExternalLink className="inline h-3 w-3" />
                    </a>
                    {" "}• Группы: ID начинается с минуса (-)
                  </p>
                </div>

                <TestTelegramButton savedConfig={{ ...savedConfig, telegramBotToken, telegramChatId }} />

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="telegram-profit-threshold">Порог Уведомлений о Прибыли ($)</Label>
                  <Input
                    id="telegram-profit-threshold"
                    type="number"
                    step="0.01"
                    value={config.telegramProfitThresholdUsd || ""}
                    onChange={(e) => setConfig({ ...config, telegramProfitThresholdUsd: e.target.value })}
                    data-testid="input-telegram-profit-threshold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram-failed-interval">Интервал Сводки Ошибок (мин)</Label>
                  <Input
                    id="telegram-failed-interval"
                    type="number"
                    value={config.telegramFailedTxSummaryIntervalMinutes || 30}
                    onChange={(e) => setConfig({ ...config, telegramFailedTxSummaryIntervalMinutes: parseInt(e.target.value) || 30 })}
                    data-testid="input-telegram-failed-interval"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Webhook Management */}
          <WebhookManager />
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Управление Рисками
              </CardTitle>
              <CardDescription>Критические настройки безопасности и лимиты</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-loan-usd">Макс. Loan ($)</Label>
                  <Input
                    id="max-loan-usd"
                    type="number"
                    value={config.maxLoanUsd || 50000}
                    onChange={(e) => setConfig({ ...config, maxLoanUsd: parseInt(e.target.value) || 50000 })}
                    data-testid="input-max-loan-usd"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-loss-limit">Дневной Лимит Убытков ($)</Label>
                  <Input
                    id="daily-loss-limit"
                    type="number"
                    step="0.01"
                    value={config.dailyLossLimit || ""}
                    onChange={(e) => setConfig({ ...config, dailyLossLimit: e.target.value })}
                    data-testid="input-daily-loss-limit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-single-loss">Макс. Убыток за Сделку ($)</Label>
                  <Input
                    id="max-single-loss"
                    type="number"
                    step="0.01"
                    value={config.maxSingleLossUsd || ""}
                    onChange={(e) => setConfig({ ...config, maxSingleLossUsd: e.target.value })}
                    data-testid="input-max-single-loss"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-pause-drawdown">Аварийная Пауза Просадка (%)</Label>
                  <Input
                    id="emergency-pause-drawdown"
                    type="number"
                    step="0.01"
                    value={config.emergencyPauseDrawdownPercent || ""}
                    onChange={(e) => setConfig({ ...config, emergencyPauseDrawdownPercent: e.target.value })}
                    data-testid="input-emergency-pause-drawdown"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="insurance-wallet">Адрес Страхового Кошелька</Label>
                <Input
                  id="insurance-wallet"
                  placeholder="0x..."
                  value={config.insuranceWalletAddress || ""}
                  onChange={(e) => setConfig({ ...config, insuranceWalletAddress: e.target.value })}
                  className="font-mono text-sm"
                  data-testid="input-insurance-wallet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurance-percent">Процент в Страховой Фонд (%)</Label>
                <Input
                  id="insurance-percent"
                  type="number"
                  step="0.01"
                  value={config.insuranceFundPercent || ""}
                  onChange={(e) => setConfig({ ...config, insuranceFundPercent: e.target.value })}
                  data-testid="input-insurance-percent"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Автоматическая Пауза</Label>
                  <p className="text-sm text-muted-foreground">
                    Остановить бот при просадке
                  </p>
                </div>
                <Switch
                  checked={config.autoPauseEnabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, autoPauseEnabled: checked })}
                  data-testid="switch-auto-pause"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Режим Симуляции</Label>
                  <p className="text-sm text-muted-foreground">
                    Работа без реальных транзакций
                  </p>
                </div>
                <Switch
                  checked={config.useSimulation || false}
                  onCheckedChange={(checked) => setConfig({ ...config, useSimulation: checked, enableRealTrading: !checked })}
                  data-testid="switch-use-simulation"
                />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label className="text-destructive">Реальная Торговля</Label>
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Включить выполнение реальных сделок
                  </p>
                </div>
                <Switch
                  checked={config.enableRealTrading || false}
                  onCheckedChange={(checked) => setConfig({ ...config, enableRealTrading: checked, useSimulation: !checked })}
                  data-testid="switch-real-trading"
                />
              </div>
            </CardContent>
          </Card>

          {/* Token Whitelist Management */}
          <TokenWhitelistManager />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t">
        <Button
          variant="outline"
          onClick={() => setConfig(savedConfig || {})}
          disabled={saveMutation.isPending}
          data-testid="button-reset-settings"
        >
          Сбросить
        </Button>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-all-settings"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Сохранение..." : "Сохранить Все Настройки"}
        </Button>
      </div>
    </div>
  );
}