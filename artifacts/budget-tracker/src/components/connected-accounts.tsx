import React, { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  useCreatePlaidLinkToken,
  useExchangePlaidToken,
  useListPlaidItems,
  useSyncPlaidTransactions,
  useDeletePlaidItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlaidItemsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, Link2, RefreshCw, Trash2, CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";

// ─── Plaid Link wrapper ───────────────────────────────────────────────────────
function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const createLinkToken = useCreatePlaidLinkToken();
  const exchangeToken = useExchangePlaidToken();
  const queryClient = useQueryClient();

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken, metadata) => {
      try {
        await exchangeToken.mutateAsync({
          data: {
            publicToken,
            institutionId: metadata.institution?.institution_id ?? undefined,
            institutionName: metadata.institution?.name ?? "Unknown Bank",
          },
        });
        toast.success(`${metadata.institution?.name ?? "Bank"} connected!`);
        queryClient.invalidateQueries({ queryKey: getListPlaidItemsQueryKey() });
        onSuccess();
      } catch {
        toast.error("Failed to connect bank account");
      }
    },
    onExit: (err) => {
      if (err) toast.error("Bank connection cancelled");
      setLinkToken(null);
    },
  });

  // Auto-open once we have a token
  React.useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await createLinkToken.mutateAsync({});
      setLinkToken(result.linkToken);
    } catch {
      toast.error("Failed to start bank connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading || exchangeToken.isPending} className="gap-2 shadow-sm">
      <Plus className="w-4 h-4" />
      {loading ? "Starting…" : "Connect a bank"}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ConnectedAccounts() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useListPlaidItems();
  const syncAll = useSyncPlaidTransactions();
  const deleteItem = useDeletePlaidItem();

  const handleSyncAll = async () => {
    try {
      const result = await syncAll.mutateAsync({ data: {} });
      const { added, modified, removed } = result;
      const parts = [];
      if (added) parts.push(`${added} added`);
      if (modified) parts.push(`${modified} updated`);
      if (removed) parts.push(`${removed} removed`);
      toast.success(parts.length ? `Synced: ${parts.join(", ")}` : "Already up to date");
    } catch {
      toast.error("Sync failed — try again");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await deleteItem.mutateAsync({ id });
      toast.success(`${name} disconnected`);
      queryClient.invalidateQueries({ queryKey: getListPlaidItemsQueryKey() });
    } catch {
      toast.error("Failed to disconnect bank");
    }
  };

  const accountTypeIcon = (type: string) => {
    if (type === "credit") return <CreditCard className="w-3.5 h-3.5" />;
    return <Building2 className="w-3.5 h-3.5" />;
  };

  return (
    <Card className="shadow-sm border-border bg-card overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none">
        <Link2 className="w-32 h-32" />
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-xl">Connected Accounts</CardTitle>
            <CardDescription>
              Link your bank accounts to automatically import transactions.
            </CardDescription>
          </div>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncAll.isPending}
              className="gap-2 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncAll.isPending ? "animate-spin" : ""}`} />
              {syncAll.isPending ? "Syncing…" : "Sync all"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="font-medium">No banks connected yet</div>
              <div className="text-sm text-muted-foreground mt-1 max-w-xs">
                Connect Wells Fargo, Amex, Capital One, and 12,000+ other institutions.
                Transactions import automatically.
              </div>
            </div>
            <PlaidLinkButton onSuccess={() => {}} />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-border bg-background/60"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{item.institutionName}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.accounts.map((account) => (
                          <Badge
                            key={account.accountId}
                            variant="secondary"
                            className="gap-1 text-xs font-normal"
                          >
                            {accountTypeIcon(account.type)}
                            {account.name}
                            {account.mask ? ` ••${account.mask}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {item.institutionName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop future transaction imports from {item.institutionName}.
                          Transactions already imported will not be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(item.id, item.institutionName)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>

            <PlaidLinkButton onSuccess={() => {}} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
