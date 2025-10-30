import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as Papa from "papaparse";
// xlsx import is commented out to avoid Vite bundling error
// Will use server-side export instead
// import * as XLSX from "xlsx";
import type { ArbitrageTransaction } from "@shared/schema";

interface ExportTransactionsProps {
  transactions: ArbitrageTransaction[];
}

export function ExportTransactions({ transactions }: ExportTransactionsProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const prepareExportData = () => {
    return transactions.map(tx => ({
      'TX Hash': tx.txHash,
      'Token In': tx.tokenIn,
      'Token Out': tx.tokenOut,
      'Amount In': tx.amountIn,
      'Amount Out': tx.amountOut,
      'Profit USD': tx.profitUsd ? parseFloat(tx.profitUsd).toFixed(2) : "0.00",
      'Gas Cost USD': tx.gasCostUsd ? parseFloat(tx.gasCostUsd).toFixed(2) : "0.00",
      'Net Profit USD': tx.netProfitUsd ? parseFloat(tx.netProfitUsd).toFixed(2) : "0.00",
      'Status': tx.status,
      'DEX Path': tx.dexPath || "N/A",
      'Created At': new Date(tx.createdAt).toLocaleString('ru-RU'),
    }));
  };

  const exportToCSV = () => {
    try {
      setIsExporting(true);
      const exportData = prepareExportData();
      
      const csv = (Papa as any).unparse(exportData, {
        quotes: true,
        delimiter: ",",
        header: true,
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `arbitrage_transactions_${Date.now()}.csv`);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Экспорт завершен",
        description: `${transactions.length} транзакций экспортировано в CSV`,
      });
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать в CSV",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Excel export disabled - requires server-side implementation
  // const exportToExcel = () => {
  //   // Excel export moved to server-side API to avoid client bundle issues
  // };

  if (!transactions || transactions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={isExporting}
          data-testid="button-export-transactions"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Экспорт..." : "Экспорт"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Формат экспорта</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToCSV} data-testid="menuitem-export-csv">
          <FileText className="mr-2 h-4 w-4" />
          Экспорт в CSV
        </DropdownMenuItem>
        {/* Excel export temporarily disabled - use CSV instead */}
        {/* <DropdownMenuItem onClick={exportToExcel} data-testid="menuitem-export-excel">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Экспорт в Excel
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {transactions.length} транзакций
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
