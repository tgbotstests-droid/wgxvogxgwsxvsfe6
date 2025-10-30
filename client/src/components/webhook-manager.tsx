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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Webhook, Plus, Trash2, Check, X, Send } from "lucide-react";
import type { WebhookConfig, WebhookLog } from "@shared/schema";

export function WebhookManager() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    eventType: "TRADE_EXECUTED",
    method: "POST",
  });

  const { data: webhooks, isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ["/api/webhooks"],
  });

  const { data: recentLogs } = useQuery<WebhookLog[]>({
    queryKey: ["/api/webhooks/logs"],
  });

  const addWebhookMutation = useMutation({
    mutationFn: async (webhook: typeof newWebhook) => {
      return await apiRequest("POST", "/api/webhooks", webhook);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Webhook добавлен",
        description: "Webhook успешно зарегистрирован",
      });
      setIsAddDialogOpen(false);
      setNewWebhook({ name: "", url: "", eventType: "TRADE_EXECUTED", method: "POST" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить webhook",
        variant: "destructive",
      });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/webhooks/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Обновлено",
        description: "Статус webhook обновлен",
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/webhooks/${id}/test`, {});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/logs"] });
      toast({
        title: data.success ? "Тест успешен" : "Тест не прошел",
        description: data.message || "Проверьте логи для деталей",
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/webhooks/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Удалено",
        description: "Webhook удален",
      });
    },
  });

  const handleAddWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast({
        title: "Ошибка валидации",
        description: "Заполните обязательные поля",
        variant: "destructive",
      });
      return;
    }
    addWebhookMutation.mutate(newWebhook);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                Webhook Notifications
              </CardTitle>
              <CardDescription>
                HTTP endpoints для уведомлений о событиях
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-webhook">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Добавить Webhook</DialogTitle>
                  <DialogDescription>
                    Настройте HTTP endpoint для получения уведомлений
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Название *</Label>
                    <Input
                      id="webhook-name"
                      placeholder="Discord Notifications"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                      data-testid="input-webhook-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL *</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                      data-testid="input-webhook-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-type">Тип события</Label>
                    <Select
                      value={newWebhook.eventType}
                      onValueChange={(value) => setNewWebhook({ ...newWebhook, eventType: value })}
                    >
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRADE_EXECUTED">Сделка выполнена</SelectItem>
                        <SelectItem value="PROFIT_THRESHOLD">Превышен порог прибыли</SelectItem>
                        <SelectItem value="LOSS_THRESHOLD">Превышен ��имит убытка</SelectItem>
                        <SelectItem value="BOT_ERROR">Ошибка бота</SelectItem>
                        <SelectItem value="RISK_ALERT">Риск-алерт</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="method">HTTP метод</Label>
                    <Select
                      value={newWebhook.method}
                      onValueChange={(value) => setNewWebhook({ ...newWebhook, method: value })}
                    >
                      <SelectTrigger data-testid="select-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                    data-testid="button-cancel-add-webhook"
                  >
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleAddWebhook}
                    disabled={addWebhookMutation.isPending}
                    data-testid="button-confirm-add-webhook"
                  >
                    {addWebhookMutation.isPending ? "Добавление..." : "Добавить"}
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
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет настроенных webhooks</p>
              <p className="text-sm mt-2">Добавьте webhook для получения уведомлений</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Событие</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[150px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id} data-testid={`row-webhook-${webhook.id}`}>
                      <TableCell className="font-medium">
                        {webhook.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{webhook.eventType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWebhookMutation.mutate({ 
                            id: webhook.id, 
                            isActive: !webhook.isActive 
                          })}
                          data-testid={`button-toggle-webhook-${webhook.id}`}
                        >
                          {webhook.isActive ? (
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testWebhookMutation.mutate(webhook.id)}
                            disabled={testWebhookMutation.isPending}
                            data-testid={`button-test-webhook-${webhook.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Удалить webhook "${webhook.name}"?`)) {
                                deleteWebhookMutation.mutate(webhook.id);
                              }
                            }}
                            data-testid={`button-delete-webhook-${webhook.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Webhook Logs */}
      {recentLogs && recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Последние отправки</CardTitle>
            <CardDescription>История вызовов webhooks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLogs.slice(0, 5).map((log) => {
                const webhook = webhooks?.find(w => w.id === log.webhookId);
                return (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-2 rounded-lg border text-sm"
                    data-testid={`log-webhook-${log.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{webhook?.name || "Unknown Webhook"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.success ? "default" : "destructive"}>
                        {log.statusCode}
                      </Badge>
                      {log.responseTime && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {log.responseTime}ms
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
