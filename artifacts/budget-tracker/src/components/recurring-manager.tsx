import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCategories, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RecurringRule {
  id: number;
  description: string;
  amount: number;
  categoryId: number;
  categoryName: string | null;
  dayOfMonth: number;
  active: boolean;
  lastPostedMonth: string | null;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

export function RecurringManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: categories } = useListCategories();
  const { data: rules, isLoading } = useQuery<RecurringRule[]>({
    queryKey: ["recurring"],
    queryFn: () => api("/api/recurring"),
    enabled: open,
  });

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring"] });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  };

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    const day = parseInt(dayOfMonth, 10);
    if (!description.trim()) { toast.error("Enter a description"); return; }
    if (!(amt > 0)) { toast.error("Enter a valid amount"); return; }
    if (!categoryId) { toast.error("Pick a category"); return; }
    if (!(day >= 1 && day <= 31)) { toast.error("Day must be 1–31"); return; }
    setSaving(true);
    try {
      await api("/api/recurring", {
        method: "POST",
        body: JSON.stringify({ description: description.trim(), amount: amt, categoryId, dayOfMonth: day }),
      });
      toast.success("Recurring transaction added");
      setDescription(""); setAmount(""); setCategoryId(0); setDayOfMonth("1");
      refresh();
    } catch {
      toast.error("Failed to add recurring transaction");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: RecurringRule, active: boolean) => {
    try {
      await api(`/api/recurring/${rule.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      refresh();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (rule: RecurringRule) => {
    if (!confirm(`Delete recurring "${rule.description}"? Already-posted transactions stay.`)) return;
    try {
      await api(`/api/recurring/${rule.id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Recurring Transactions</DialogTitle>
          <DialogDescription>
            These post themselves automatically each month on the day you choose — rent, subscriptions, insurance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>}
          {rules?.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium truncate ${rule.active ? "" : "text-muted-foreground line-through"}`}>
                  {rule.description}
                </div>
                <div className="text-xs text-muted-foreground">
                  {rule.categoryName ?? "Uncategorized"} · day {rule.dayOfMonth} of each month
                </div>
              </div>
              <div className="text-sm font-semibold shrink-0">${rule.amount.toFixed(2)}</div>
              <Switch checked={rule.active} onCheckedChange={(c) => handleToggle(rule, c)} />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(rule)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {rules && rules.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">No recurring transactions yet.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add new</p>
          <Input placeholder="Description (e.g. Rent, Netflix)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input type="number" step="0.01" className="pl-7" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Select value={categoryId ? categoryId.toString() : ""} onValueChange={(v) => setCategoryId(parseInt(v, 10))}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.icon} {cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={1} max={31} placeholder="Day" title="Day of month" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Recurring
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
