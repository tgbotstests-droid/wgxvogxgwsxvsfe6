import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, Trash2, Check, X } from "lucide-react";
import type { TokenWhitelist } from "@shared/schema";

export function TokenWhitelistManager() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState({
    symbol: "",
    address: "",
    minLiquidityUsd: "10000",
    description: "",
  });

  const { data: whitelist, isLoading } = useQuery<TokenWhitelist[]>({
    queryKey: ["/api/risk/whitelist"],
  });

  const addTokenMutation = useMutation({
    mutationFn: async (token: typeof newToken) => {
      return await apiRequest("POST", "/api/risk/whitelist", token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/whitelist"] });
      toast({
        title: "Токен добавлен",
        description: "Токен успешно добавлен в whitelist",
      });
      setIsAddDialogOpen(false);
      setNewToken({ symbol: "", address: "", minLiquidityUsd: "10000", description: "" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить токен",
        variant: "destructive",
      });
    },
  });

  const toggleTokenMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/risk/whitelist/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/whitelist"] });
      toast({
        title: "Обновлено",
        description: "Статус токена обновлен",
      });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/risk/whitelist/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/whitelist"] });
      toast({
        title: "Удалено",
        description: "Токен удален из whitelist",
      });
    },
  });

  const handleAddToken = () => {
    if (!newToken.symbol || !newToken.address) {
      toast({
        title: "Ошибка валидации",
        description: "Заполните обязательные поля",
        variant: "destructive",
      });
      return;
    }
    addTokenMutation.mutate(newToken);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Token Whitelist
            </CardTitle>
            <CardDescription>
              Список разрешенных токенов для арбитража
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-token">
                <Plus className="h-4 w-4 mr-2" />
                Добавить Токен
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить токен в Whitelist</DialogTitle>
                <DialogDescription>
                  Укажите параметры токена для добавления в список разрешенных
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="token-symbol">Символ токена *</Label>
                  <Input
                    id="token-symbol"
                    placeholder="USDC"
                    value={newToken.symbol}
                    onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value })}
                    data-testid="input-token-symbol"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-address">Адрес контракта *</Label>
                  <Input
                    id="token-address"
                    placeholder="0x..."
                    value={newToken.address}
                    onChange={(e) => setNewToken({ ...newToken, address: e.target.value })}
                    className="font-mono text-sm"
                    data-testid="input-token-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-liquidity">Мин. Ликвидность ($)</Label>
                  <Input
                    id="min-liquidity"
                    type="number"
                    placeholder="10000"
                    value={newToken.minLiquidityUsd}
                    onChange={(e) => setNewToken({ ...newToken, minLiquidityUsd: e.target.value })}
                    data-testid="input-min-liquidity"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token-description">Описание</Label>
                  <Input
                    id="token-description"
                    placeholder="USD Coin"
                    value={newToken.description}
                    onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                    data-testid="input-token-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel-add-token"
                >
                  Отмена
                </Button>
                <Button 
                  onClick={handleAddToken}
                  disabled={addTokenMutation.isPending}
                  data-testid="button-confirm-add-token"
                >
                  {addTokenMutation.isPending ? "Добавление..." : "Добавить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка...
          </div>
        ) : !whitelist || whitelist.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет токенов в whitelist</p>
            <p className="text-sm mt-2">Добавьте первый токен для начала работы</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Токен</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead className="text-right">Мин. Ликвидность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelist.map((token) => (
                  <TableRow key={token.id} data-testid={`row-token-${token.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-mono font-bold">{token.symbol}</div>
                        {token.description && (
                          <div className="text-xs text-muted-foreground">{token.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {token.address.substring(0, 10)}...{token.address.substring(token.address.length - 8)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${token.minLiquidityUsd ? parseFloat(token.minLiquidityUsd).toLocaleString() : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTokenMutation.mutate({ 
                          id: token.id, 
                          isActive: !token.isActive 
                        })}
                        data-testid={`button-toggle-token-${token.id}`}
                      >
                        {token.isActive ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Активен
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <X className="h-3 w-3" />
                            Отключен
                          </Badge>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Удалить ${token.symbol} из whitelist?`)) {
                            deleteTokenMutation.mutate(token.id);
                          }
                        }}
                        data-testid={`button-delete-token-${token.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
