import React, { useState } from "react";
import { 
  useListBudgets, 
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useListCategories,
  getListBudgetsQueryKey,
  Budget
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth } from "date-fns";
import { Plus, Edit2, Trash2, Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

const budgetSchema = z.object({
  categoryId: z.coerce.number().positive("Category is required"),
  monthlyLimit: z.coerce.number().positive("Limit must be positive"),
  month: z.string()
});

type AISuggestion = { categoryId: number; categoryName: string; monthlyLimit: number };

export function Budgets() {
  const queryClient = useQueryClient();
  const { data: budgets, isLoading: loadingBudgets } = useListBudgets();
  const { data: categories, isLoading: loadingCategories } = useListCategories();
  
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // AI suggestion state
  const [aiOpen, setAiOpen] = useState(false);
  const [income, setIncome] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[] | null>(null);
  const [applying, setApplying] = useState(false);

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { categoryId: 0, monthlyLimit: 0, month: currentMonth },
  });

  const openNewModal = () => {
    setEditingBudget(null);
    form.reset({ categoryId: 0, monthlyLimit: 0, month: currentMonth });
    setIsModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({ categoryId: budget.categoryId, monthlyLimit: budget.monthlyLimit, month: budget.month });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to remove this budget?")) {
      deleteBudget.mutate({ id }, {
        onSuccess: () => {
          toast.success("Budget removed");
          queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
        },
        onError: () => toast.error("Failed to remove budget")
      });
    }
  };

  const onSubmit = (values: z.infer<typeof budgetSchema>) => {
    if (editingBudget) {
      updateBudget.mutate({ id: editingBudget.id, data: { monthlyLimit: values.monthlyLimit } }, {
        onSuccess: () => {
          toast.success("Budget updated");
          queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
          setIsModalOpen(false);
        },
        onError: () => toast.error("Failed to update budget")
      });
    } else {
      createBudget.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Budget set");
          queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
          setIsModalOpen(false);
        },
        onError: () => toast.error("Failed to set budget")
      });
    }
  };

  const handleAISuggest = async () => {
    const val = parseFloat(income);
    if (!val || val <= 0) { toast.error("Enter a valid monthly income"); return; }
    setAiLoading(true);
    setSuggestions(null);
    try {
      const res = await fetch("/api/ai/suggest-budgets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyIncome: val }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { suggestions: AISuggestion[] };
      setSuggestions(data.suggestions);
    } catch (e) {
      toast.error("AI suggestion failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!suggestions) return;
    setApplying(true);
    let applied = 0;
    for (const s of suggestions) {
      const existing = budgets?.find(b => b.categoryId === s.categoryId);
      try {
        await new Promise<void>((resolve, reject) => {
          if (existing) {
            updateBudget.mutate(
              { id: existing.id, data: { monthlyLimit: s.monthlyLimit } },
              { onSuccess: () => resolve(), onError: reject }
            );
          } else {
            createBudget.mutate(
              { data: { categoryId: s.categoryId, monthlyLimit: s.monthlyLimit, month: currentMonth } },
              { onSuccess: () => resolve(), onError: reject }
            );
          }
        });
        applied++;
      } catch {
        // continue on partial failure
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
    setApplying(false);
    setAiOpen(false);
    setSuggestions(null);
    setIncome("");
    toast.success(`Applied ${applied} budget suggestions`);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const totalSuggested = suggestions?.reduce((sum, s) => sum + s.monthlyLimit, 0) ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Monthly Budgets</h2>
          <p className="text-muted-foreground mt-1">Set gentle limits to guide your spending.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAiOpen(true); setSuggestions(null); }} className="rounded-full gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Suggest
          </Button>
          <Button onClick={openNewModal} className="rounded-full shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Set Budget
          </Button>
        </div>
      </div>

      {loadingBudgets || loadingCategories ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets?.map((budget) => {
            const spent = budget.spent || 0;
            const percentage = Math.min(100, (spent / budget.monthlyLimit) * 100);
            const isNearLimit = percentage >= 85;
            const isOverLimit = percentage >= 100;
            const catIcon = categories?.find(c => c.id === budget.categoryId)?.icon;
            return (
              <Card key={budget.id} className={`border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative ${isOverLimit ? 'bg-destructive/5' : ''}`}>
                {isOverLimit && (
                  <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg">
                    Over Budget
                  </div>
                )}
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-sm shadow-sm">
                      {catIcon || '?'}
                    </span>
                    {budget.categoryName}
                  </CardTitle>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => openEditModal(budget)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(budget.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end mb-2">
                    <div className="font-serif text-3xl font-medium text-foreground">{formatCurrency(spent)}</div>
                    <div className="text-muted-foreground text-sm font-medium mb-1">of {formatCurrency(budget.monthlyLimit)}</div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 mt-4 overflow-hidden shadow-inner">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${isOverLimit ? 'bg-destructive' : isNearLimit ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${percentage}%`, backgroundColor: !isOverLimit && !isNearLimit ? (budget.categoryColor || undefined) : undefined }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground text-right">
                    {budget.monthlyLimit - spent > 0
                      ? `${formatCurrency(budget.monthlyLimit - spent)} remaining`
                      : `${formatCurrency(spent - budget.monthlyLimit)} over limit`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!budgets || budgets.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
              No budgets set yet. Use <strong>AI Suggest</strong> or set limits manually.
            </div>
          )}
        </div>
      )}

      {/* Manual budget modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingBudget ? "Update Budget" : "Set New Budget"}</DialogTitle>
            <DialogDescription>
              {editingBudget ? "Adjust the monthly limit for this category." : "Choose a category and set a spending limit for the month."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!editingBudget && (
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} value={field.value ? field.value.toString() : ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories?.filter(c => !budgets?.find(b => b.categoryId === c.id))?.map(cat => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            <div className="flex items-center gap-2"><span>{cat.icon}</span><span>{cat.name}</span></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="monthlyLimit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Limit</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" step="1" className="pl-7" placeholder="500" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createBudget.isPending || updateBudget.isPending}>
                  {editingBudget ? "Save Changes" : "Set Budget"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* AI suggestion modal */}
      <Dialog open={aiOpen} onOpenChange={(o) => { setAiOpen(o); if (!o) { setSuggestions(null); setIncome(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Budget Suggestions
            </DialogTitle>
            <DialogDescription>
              Enter your combined monthly take-home income and we'll suggest a full budget across all your categories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="100"
                  min="1"
                  className="pl-7"
                  placeholder="e.g. 8000"
                  value={income}
                  onChange={e => { setIncome(e.target.value); setSuggestions(null); }}
                  onKeyDown={e => e.key === "Enter" && handleAISuggest()}
                />
              </div>
              <Button onClick={handleAISuggest} disabled={aiLoading || !income} className="shrink-0">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
              </Button>
            </div>

            {aiLoading && (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            )}

            {suggestions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Suggested allocations</span>
                  <Badge variant="secondary">
                    Total: {formatCurrency(totalSuggested)} / {formatCurrency(parseFloat(income))}
                  </Badge>
                </div>
                <div className="divide-y divide-border rounded-xl border overflow-hidden">
                  {suggestions.map(s => {
                    const cat = categories?.find(c => c.id === s.categoryId);
                    return (
                      <div key={s.categoryId} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat?.icon ?? '📦'}</span>
                          <span className="font-medium text-sm">{s.categoryName}</span>
                        </div>
                        <span className="font-serif text-primary font-semibold">{formatCurrency(s.monthlyLimit)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSuggestions(null)}>Regenerate</Button>
                  <Button onClick={handleApplySuggestions} disabled={applying} className="gap-2">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Apply All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
