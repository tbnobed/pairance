import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, useLocationCheckIn } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Receipt, 
  Tags, 
  PieChart, 
  Settings, 
  LogOut,
  MapPin,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TransactionModal } from "@/components/transaction-modal";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const checkIn = useLocationCheckIn();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = React.useState(false);
  const [txInitialData, setTxInitialData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/");
    }
  }, [isLoading, isError, setLocation]);

  if (isLoading || isError) {
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // Clear all cached data (incl. the cached "logged-in user") so the
        // login page doesn't see stale auth state and redirect-loop.
        queryClient.clear();
        setLocation("/");
      }
    });
  };

  const handleCheckIn = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkIn.mutate(
            { data: { lat: position.coords.latitude, lng: position.coords.longitude } },
            {
              onSuccess: (data) => {
                if (data.shouldPrompt) {
                  setTxInitialData({
                    locationName: data.locationName,
                    locationLat: position.coords.latitude,
                    locationLng: position.coords.longitude,
                    categoryId: data.suggestedCategory,
                  });
                  setIsTransactionModalOpen(true);
                } else {
                  // Optionally just open the modal normally or show a toast
                  setTxInitialData({
                    locationLat: position.coords.latitude,
                    locationLng: position.coords.longitude,
                  });
                  setIsTransactionModalOpen(true);
                }
              },
              onError: () => {
                // If it fails, just open modal
                setTxInitialData(null);
                setIsTransactionModalOpen(true);
              }
            }
          );
        },
        () => {
          // Geolocation error
          setTxInitialData(null);
          setIsTransactionModalOpen(true);
        }
      );
    } else {
      setTxInitialData(null);
      setIsTransactionModalOpen(true);
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: Receipt },
    { name: "Categories", href: "/categories", icon: Tags },
    { name: "Budgets", href: "/budgets", icon: PieChart },
  ];

  return (
    <div className="min-h-screen flex bg-background w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar flex-col fixed inset-y-0 left-0 z-10">
        <div className="px-6 py-5">
          <img src="/logo-reversed.svg" alt="Pairance" className="h-7 w-auto" />
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer block ${
                  isActive
                    ? "bg-sidebar-primary/20 text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}>
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer block mb-2 ${
              location === "/settings"
                ? "bg-sidebar-primary/20 text-sidebar-primary font-semibold"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}>
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center justify-between px-4 py-2 mt-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="w-9 h-9 border border-sidebar-border shrink-0">
                <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary font-semibold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-sidebar-foreground leading-none mb-1 truncate">{user?.name}</span>
                <span className="text-xs text-sidebar-foreground/50 leading-none truncate">{user?.spouseName ? `& ${user.spouseName}` : "Solo"}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/40 hover:text-destructive shrink-0">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col pb-24 md:pb-0">
        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-10 safe-area-bottom">
        <nav className="flex justify-around items-center p-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}>
                <item.icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
          <Link href="/settings" className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              location === "/settings" 
                ? "text-primary" 
                : "text-muted-foreground"
            }`}>
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">Settings</span>
          </Link>
        </nav>
      </div>

      {/* FABs */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 flex flex-col gap-3 z-20">
        <Button 
          size="icon" 
          variant="secondary"
          className="w-12 h-12 rounded-full shadow-md hover:shadow-lg transition-all text-secondary-foreground"
          onClick={handleCheckIn}
          disabled={checkIn.isPending}
          title="Check In Location"
        >
          <MapPin className="w-5 h-5" />
        </Button>
        <Button 
          size="icon" 
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          onClick={() => {
            setTxInitialData(null);
            setIsTransactionModalOpen(true);
          }}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {isTransactionModalOpen && (
        <TransactionModal 
          isOpen={isTransactionModalOpen} 
          onClose={() => setIsTransactionModalOpen(false)} 
          initialData={txInitialData}
        />
      )}
    </div>
  );
}