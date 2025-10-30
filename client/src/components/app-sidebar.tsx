import { Home, Settings, Shield, Usb, Wallet, Book, LogOut, Receipt, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Activity } from "lucide-react";

const menuItems = [
  {
    title: "Панель",
    url: "/",
    icon: Home,
  },
  {
    title: "Транзакции",
    url: "/transactions",
    icon: Receipt,
  },
  {
    title: "Risk Management",
    url: "/risk-management",
    icon: AlertTriangle,
  },
  {
    title: "Ledger Кошелёк",
    url: "/ledger",
    icon: Usb,
  },
  {
    title: "Safe Мультиподпись",
    url: "/safe",
    icon: Shield,
  },
  {
    title: "Кошелёк",
    url: "/wallet",
    icon: Wallet,
  },
  {
    title: "Торговля",
    url: "/trade",
    icon: TrendingUp,
  },
  {
    title: "Настройки",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Документация",
    url: "/documentation",
    icon: Book,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold flex items-center gap-2 py-4">
            <div className="p-2 bg-primary/10 rounded-md">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            Арбитражный Бот
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-${item.url.replace('/', '') || 'dashboard'}`}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/api/logout" data-testid="link-logout">
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
