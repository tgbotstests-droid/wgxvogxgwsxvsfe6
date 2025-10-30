import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  TrendingUp,
  Wallet,
  Settings,
  ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: number;
  userId: string;
  type: string;
  level: string;
  message: string;
  metadata?: any;
  createdAt: string;
}

interface ActivityFeedProps {
  limit?: number;
  showTitle?: boolean;
  compact?: boolean;
}

export function ActivityFeed({ limit = 50, showTitle = true, compact = false }: ActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Fetch initial logs
  const { data: initialLogs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs?limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
  });

  // Update logs when initial data loads
  useEffect(() => {
    if (initialLogs) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('ActivityFeed WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle activity log updates
        if (data.type === 'activity_log' && data.data) {
          setLogs((prev) => [data.data, ...prev].slice(0, limit));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('ActivityFeed WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [limit]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'swap':
        return <ArrowRightLeft className="h-4 w-4" />;
      case 'wallet_connect':
        return <Wallet className="h-4 w-4" />;
      case 'trade':
        return <TrendingUp className="h-4 w-4" />;
      case 'config_update':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getLevelVariant = (level: string) => {
    switch (level) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}с назад`;
    if (minutes < 60) return `${minutes}м назад`;
    if (hours < 24) return `${hours}ч назад`;
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const content = (
    <>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Нет активности</p>
        </div>
      ) : (
        <ScrollArea className={cn(compact ? "h-[300px]" : "h-[500px]")}>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
                data-testid={`log-${log.id}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getLevelIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      {getTypeIcon(log.type)}
                      <Badge variant={getLevelVariant(log.level)} className="text-xs">
                        {log.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm break-words">{log.message}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground font-mono">
                      {log.metadata.txHash && (
                        <div className="truncate">
                          TX: {log.metadata.txHash.slice(0, 10)}...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  );

  if (!showTitle) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Активность
        </CardTitle>
        <CardDescription>Real-time система логирования</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
