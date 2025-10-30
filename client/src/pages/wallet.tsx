import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet as WalletIcon, Copy, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import type { ConnectedWallet } from "@shared/schema";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Wallet() {
  const { toast } = useToast();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  // Fetch persisted wallets from database
  const { data: persistedWallets, isLoading: walletsLoading } = useQuery<ConnectedWallet[]>({
    queryKey: ["/api/wallets"],
  });

  // Fetch user config to determine default network
  const { data: userConfig } = useQuery({
    queryKey: ["/api/bot/config"],
  });

  // Fetch detailed wallet balances from Web3 API
  const { data: walletBalances, isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ["/api/web3/wallet", account, "balances"],
    queryFn: async () => {
      if (!account) return null;
      const response = await fetch(`/api/web3/wallet/${account}/balances?chainId=${chainId || 137}`);
      if (!response.ok) throw new Error("Failed to fetch wallet balances");
      return response.json();
    },
    enabled: !!account,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch current gas price
  const { data: gasPrice } = useQuery({
    queryKey: ["/api/web3/gas-price", chainId],
    queryFn: async () => {
      const response = await fetch(`/api/web3/gas-price?chainId=${chainId || 137}`);
      if (!response.ok) throw new Error("Failed to fetch gas price");
      return response.json();
    },
    enabled: !!chainId,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Connect wallet mutation
  const connectWalletMutation = useMutation({
    mutationFn: async (data: { address: string; walletType: string; chainId: number }) => {
      return await apiRequest("POST", "/api/wallets/connect", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  // Disconnect wallet mutation
  const disconnectWalletMutation = useMutation({
    mutationFn: async (walletId: number) => {
      return await apiRequest("POST", `/api/wallets/${walletId}/disconnect`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: "✅ Отключено",
        description: "Кошелек удален из списка",
      });
    },
  });

  useEffect(() => {
    checkConnection().catch((err) => {
      console.log("MetaMask auto-connect failed:", err);
    });
    
    if (typeof window.ethereum !== "undefined") {
      try {
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", () => window.location.reload());
      } catch (error) {
        console.log("MetaMask event listeners not available:", error);
      }
    }

    return () => {
      if (typeof window.ethereum !== "undefined") {
        try {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        } catch (error) {
          console.log("MetaMask cleanup failed:", error);
        }
      }
    };
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount(null);
      setBalance(null);
    } else {
      setAccount(accounts[0]);
      fetchBalance(accounts[0]);
    }
  };

  const checkConnection = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
          setChainId(parseInt(chainIdHex, 16));
          await fetchBalance(accounts[0]);
        }
      } catch (error) {
        // Silently handle connection check errors - MetaMask might not be unlocked
        console.log("MetaMask connection check skipped:", error);
      }
    }
  };

  const fetchBalance = async (address: string) => {
    try {
      const balanceHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      const balanceWei = parseInt(balanceHex, 16);
      const balanceEth = (balanceWei / 1e18).toFixed(4);
      setBalance(balanceEth);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast({
        title: "MetaMask не найден",
        description: "Пожалуйста, установите MetaMask",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);

      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const chainIdNum = parseInt(chainIdHex, 16);
      setChainId(chainIdNum);

      await fetchBalance(accounts[0]);

      // Persist wallet connection to database
      await connectWalletMutation.mutateAsync({
        address: accounts[0],
        walletType: "MetaMask",
        chainId: chainIdNum,
      });

      // Auto-switch to configured network
      const preferredChainId = userConfig?.networkMode === "mainnet" ? 137 : 80002;
      
      if (chainIdNum !== preferredChainId) {
        toast({
          title: "Переключение сети",
          description: `Переключаем на ${preferredChainId === 137 ? "Polygon Mainnet" : "Amoy Testnet"}...`,
        });
        
        try {
          await switchNetwork(preferredChainId);
        } catch (error) {
          console.error("Auto-switch network failed:", error);
        }
      } else if (chainIdNum !== 137 && chainIdNum !== 80002) {
        toast({
          title: "Неверная сеть",
          description: "Переключитесь на Polygon Mainnet или Amoy Testnet",
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Подключено",
          description: "Кошелек успешно подключен и сохранен",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка подключения",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async (chainId: number) => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      toast({
        title: "✅ Сеть изменена",
        description: `Переключено на ${chainId === 137 ? "Polygon Mainnet" : "Amoy Testnet"}`,
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await addNetwork(chainId);
      } else {
        toast({
          title: "Ошибка",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const addNetwork = async (chainId: number) => {
    const networkParams = chainId === 137 ? {
      chainId: "0x89",
      chainName: "Polygon Mainnet",
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
      rpcUrls: ["https://polygon-rpc.com"],
      blockExplorerUrls: ["https://polygonscan.com"],
    } : {
      chainId: "0x13882",
      chainName: "Polygon Amoy Testnet",
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
      rpcUrls: ["https://rpc-amoy.polygon.technology"],
      blockExplorerUrls: ["https://amoy.polygonscan.com"],
    };

    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [networkParams],
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast({
        title: "✅ Скопировано",
        description: "Адрес скопирован в буфер обмена",
      });
    }
  };

  const getNetworkName = (id: number | null) => {
    if (!id) return "Не подключено";
    if (id === 137) return "Polygon Mainnet";
    if (id === 80002) return "Polygon Amoy Testnet";
    return `Неизвестная сеть (${id})`;
  };

  const getExplorerUrl = () => {
    if (chainId === 137) return `https://polygonscan.com/address/${account}`;
    if (chainId === 80002) return `https://amoy.polygonscan.com/address/${account}`;
    return "#";
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <WalletIcon className="h-8 w-8 text-primary" />
          Подключение Кошелька
        </h1>
        <p className="text-muted-foreground">MetaMask и Web3 интеграция</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>MetaMask</CardTitle>
            {account && (
              <Badge variant="default" data-testid="badge-connected">● Подключен</Badge>
            )}
          </div>
          <CardDescription>
            Подключите MetaMask для взаимодействия с блокчейном
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Адрес Кошелька</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-3 py-2 rounded flex-1 truncate" data-testid="text-wallet-address">
                    {account}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyAddress}
                    data-testid="button-copy-address"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(getExplorerUrl(), "_blank")}
                    data-testid="button-view-explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {balance && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Баланс</p>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-mono font-bold" data-testid="text-balance">
                      {walletBalances ? walletBalances.nativeBalanceFormatted : balance} MATIC
                    </p>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (account) fetchBalance(account);
                        refetchBalances();
                      }}
                      data-testid="button-refresh-balance"
                      disabled={balancesLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${balancesLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Token Balances Section */}
              {walletBalances && walletBalances.tokens && walletBalances.tokens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Токены ERC-20</p>
                  <div className="space-y-2">
                    {walletBalances.tokens.map((token: any) => (
                      <div
                        key={token.address}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                        data-testid={`token-${token.symbol}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{token.symbol}</p>
                            <Badge variant="outline" className="text-xs">{token.name}</Badge>
                          </div>
                          <code className="text-xs text-muted-foreground font-mono">
                            {token.address.slice(0, 6)}...{token.address.slice(-4)}
                          </code>
                        </div>
                        <p className="font-mono font-bold text-lg" data-testid={`balance-${token.symbol}`}>
                          {parseFloat(token.balanceFormatted).toFixed(4)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gas Price Section */}
              {gasPrice && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Текущий Gas Price</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="badge-gas-price">
                      ⛽ {parseFloat(gasPrice.gasPriceGwei).toFixed(2)} Gwei
                    </Badge>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Текущая Сеть</p>
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={chainId === 137 || chainId === 80002 ? "default" : "destructive"}
                    data-testid="badge-network"
                  >
                    {getNetworkName(chainId)}
                  </Badge>
                  {chainId !== 137 && chainId !== 80002 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchNetwork(137)}
                        data-testid="button-switch-mainnet"
                      >
                        Mainnet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchNetwork(80002)}
                        data-testid="button-switch-testnet"
                      >
                        Testnet
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <WalletIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-6">
                Кошелек не подключен
              </p>
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                data-testid="button-connect-wallet"
              >
                {isConnecting ? "Подключение..." : "Подключить MetaMask"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Persisted Wallets History */}
      <Card>
        <CardHeader>
          <CardTitle>История Подключений</CardTitle>
          <CardDescription>Ранее подключенные кошельки</CardDescription>
        </CardHeader>
        <CardContent>
          {walletsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : persistedWallets && persistedWallets.length > 0 ? (
            <div className="space-y-3">
              {persistedWallets.map((wallet) => (
                <div 
                  key={wallet.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`wallet-item-${wallet.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={wallet.isConnected ? "default" : "secondary"} data-testid={`badge-wallet-status-${wallet.id}`}>
                        {wallet.walletType}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-chain-${wallet.id}`}>
                        {wallet.chainId === 137 ? "Mainnet" : wallet.chainId === 80002 ? "Testnet" : `Chain ${wallet.chainId}`}
                      </Badge>
                    </div>
                    <code className="text-xs font-mono text-muted-foreground truncate block" data-testid={`text-wallet-addr-${wallet.id}`}>
                      {wallet.address}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      Подключен: {new Date(wallet.lastConnectedAt || "").toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {wallet.isConnected && account?.toLowerCase() === wallet.address.toLowerCase() && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={chainId === 137 ? "default" : "outline"}
                          onClick={() => switchNetwork(137)}
                          disabled={chainId === 137}
                          data-testid={`button-switch-mainnet-${wallet.id}`}
                        >
                          Mainnet
                        </Button>
                        <Button
                          size="sm"
                          variant={chainId === 80002 ? "default" : "outline"}
                          onClick={() => switchNetwork(80002)}
                          disabled={chainId === 80002}
                          data-testid={`button-switch-testnet-${wallet.id}`}
                        >
                          Testnet
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (wallet.id) {
                          disconnectWalletMutation.mutate(wallet.id);
                        }
                      }}
                      disabled={disconnectWalletMutation.isPending}
                      data-testid={`button-remove-wallet-${wallet.id}`}
                      title="Удалить из истории"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-wallets">
              Нет сохраненных подключений
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">💡 Информация</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• MetaMask используется для взаимодействия с DeFi протоколами</p>
          <p>• Убедитесь, что вы подключены к правильной сети (Polygon)</p>
          <p>• Для реальной торговли используйте Mainnet (Chain ID: 137)</p>
          <p>• Для тестирования используйте Amoy Testnet (Chain ID: 80002)</p>
          <p>• Всегда проверяйте баланс MATIC для оплаты gas комиссий</p>
          <p>• История подключений сохраняется автоматически</p>
        </CardContent>
      </Card>
    </div>
  );
}
