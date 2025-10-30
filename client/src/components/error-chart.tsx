import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ActivityLog {
  id: number;
  userId: string;
  type: string;
  level: string;
  message: string;
  metadata?: any;
  createdAt: string;
}

export function ErrorChart() {
  const [errorData, setErrorData] = useState<any[]>([]);

  const { data: logs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const response = await fetch("/api/activity-logs?limit=100");
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (logs) {
      const hourlyErrors = new Map<string, { errors: number; warnings: number; total: number }>();
      
      logs.forEach(log => {
        const date = new Date(log.createdAt);
        const hourKey = `${date.getHours()}:00`;
        
        const current = hourlyErrors.get(hourKey) || { errors: 0, warnings: 0, total: 0 };
        current.total++;
        
        if (log.level === 'error') {
          current.errors++;
        } else if (log.level === 'warning') {
          current.warnings++;
        }
        
        hourlyErrors.set(hourKey, current);
      });

      const chartData = Array.from(hourlyErrors.entries())
        .map(([hour, data]) => ({
          hour,
          errors: data.errors,
          warnings: data.warnings,
          total: data.total,
        }))
        .slice(-12);

      setErrorData(chartData);
    }
  }, [logs]);

  const totalErrors = logs?.filter(l => l.level === 'error').length || 0;
  const totalWarnings = logs?.filter(l => l.level === 'warning').length || 0;

  if (isLoading) {
    return (
      <Card data-testid="card-error-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            График Ошибок
          </CardTitle>
          <CardDescription>Мониторинг ошибок и предупреждений</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-error-chart">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              График Ошибок
            </CardTitle>
            <CardDescription>Мониторинг ошибок и предупреждений за последние часы</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="destructive" data-testid="badge-total-errors">
              <AlertCircle className="h-3 w-3 mr-1" />
              {totalErrors} ошибок
            </Badge>
            <Badge variant="secondary" data-testid="badge-total-warnings">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {totalWarnings} предупреждений
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {errorData.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">Нет данных об ошибках</p>
            <p className="text-sm text-muted-foreground mt-1">
              График появится после накопления логов
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={errorData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="errors" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Ошибки"
                dot={{ fill: 'hsl(var(--destructive))' }}
              />
              <Line 
                type="monotone" 
                dataKey="warnings" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                name="Предупреждения"
                dot={{ fill: 'hsl(var(--chart-4))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
