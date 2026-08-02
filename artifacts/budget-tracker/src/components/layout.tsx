import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, useLocationCheckIn, useUpdateTheme, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Receipt, 
  Tags, 
  PieChart, 
  Settings, 
  LogOut,
  MapPin,
  Plus,
  Sun,
  Moon,
  Camera,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TransactionModal } from "@/components/transaction-modal";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const checkIn = useLocationCheckIn();
  const updateTheme = useUpdateTheme();

  // Keep the page + local cache in sync with the theme saved on the account.
  const theme = (user as any)?.theme ?? "light";
  React.useEffect(() => {
    if (!user) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [user, theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    // Apply instantly, then persist to the account.
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    updateTheme.mutate(
      { data: { theme: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      }
    );
  };
  const [isTransactionModalOpen, setIsTransactionModalOpen] = React.useState(false);
  const [txInitialData, setTxInitialData] = React.useState<any>(null);
  const [scanning, setScanning] = React.useState(false);
  type ScannedTx = { description: string; amount: number; date: string | null; categoryId: number; categoryName: string | null };
  const [scannedTxs, setScannedTxs] = React.useState<(ScannedTx & { checked: boolean })[] | null>(null);
  const [importing, setImporting] = React.useState(false);

  const handleImportScanned = async () => {
    if (!scannedTxs) return;
    const selected = scannedTxs.filter((t) => t.checked);
    if (selected.length === 0) { setScannedTxs(null); return; }
    setImporting(true);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let added = 0;
    for (const t of selected) {
      try {
        const res = await fetch("/api/transactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: t.description,
            amount: t.amount,
            categoryId: t.categoryId,
            date: t.date ?? todayStr,
          }),
        });
        if (res.ok) added++;
      } catch { /* continue with the rest */ }
    }
    setImporting(false);
    setScannedTxs(null);
    queryClient.invalidateQueries();
    if (added === selected.length) toast.success(`Added ${added} transactions`);
    else toast.error(`Added ${added} of ${selected.length} transactions — some failed`);
  };
  const receiptInputRef = React.useRef<HTMLInputElement>(null);

  // Downscale the photo client-side so uploads stay small and fast.
  const fileToJpegDataUrl = (file: File, maxDim = 1600): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read image")); };
      img.src = url;
    });

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      const res = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Scan failed");
      const txs = body.transactions as ScannedTx[];
      if (txs.length === 1) {
        // Single receipt — prefill the normal form for review.
        const t = txs[0];
        setTxInitialData({
          amount: t.amount,
          description: t.description,
          categoryId: t.categoryId,
          ...(t.date ? { date: t.date } : {}),
        });
        setIsTransactionModalOpen(true);
        toast.success(`Read receipt: ${t.description} — filed under ${t.categoryName ?? "a category"}. Review and save.`);
      } else {
        // Bank screenshot with multiple transactions — review list.
        setScannedTxs(txs.map((t) => ({ ...t, checked: true })));
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't scan the receipt. Try a clearer photo.");
    } finally {
      setScanning(false);
    }
  };

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
            <div className="flex items-center shrink-0">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-sidebar-foreground/40 hover:text-sidebar-foreground" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/40 hover:text-destructive">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
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
          variant="secondary"
          className="w-12 h-12 rounded-full shadow-md hover:shadow-lg transition-all text-secondary-foreground"
          onClick={() => receiptInputRef.current?.click()}
          disabled={scanning}
          title="Scan Receipt"
        >
          {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
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

      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleReceiptFile}
      />

      {/* Multi-transaction import review (bank screenshot scan) */}
      <Dialog open={scannedTxs !== null} onOpenChange={(o) => { if (!o) setScannedTxs(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Found {scannedTxs?.length ?? 0} transactions</DialogTitle>
            <DialogDescription>Uncheck any you don't want, then add them all at once. Payments and credits were skipped automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {scannedTxs?.map((t, i) => (
              <label key={i} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Checkbox
                  checked={t.checked}
                  onCheckedChange={(c) =>
                    setScannedTxs((prev) => prev?.map((p, j) => (j === i ? { ...p, checked: c === true } : p)) ?? null)
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.categoryName ?? "Uncategorized"}{t.date ? ` · ${t.date}` : " · today"}
                  </div>
                </div>
                <div className="text-sm font-semibold shrink-0">${t.amount.toFixed(2)}</div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScannedTxs(null)} disabled={importing}>Cancel</Button>
            <Button onClick={handleImportScanned} disabled={importing || !scannedTxs?.some((t) => t.checked)}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add {scannedTxs?.filter((t) => t.checked).length ?? 0} transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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