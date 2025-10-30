import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Ledger from "@/pages/ledger";
import Safe from "@/pages/safe";
import Wallet from "@/pages/wallet";
import Trade from "@/pages/trade";
import Transactions from "@/pages/transactions";
import Documentation from "@/pages/documentation";
import RiskManagement from "@/pages/risk-management";
import NotFound from "@/pages/not-found";

export default function App() {
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="app-theme">
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-2 border-b gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/settings" component={Settings} />
                    <Route path="/risk-management" component={RiskManagement} />
                    <Route path="/ledger" component={Ledger} />
                    <Route path="/safe" component={Safe} />
                    <Route path="/wallet" component={Wallet} />
                    <Route path="/trade" component={Trade} />
                    <Route path="/transactions" component={Transactions} />
                    <Route path="/documentation" component={Documentation} />
                    <Route component={NotFound} />
                  </Switch>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
