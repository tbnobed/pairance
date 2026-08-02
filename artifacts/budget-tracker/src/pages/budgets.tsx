import React, { useState, useEffect } from "react";
import {
  useListBudgets,
  useListTransactions,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useListCategories,
  getListBudgetsQueryKey,
  Budget,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  format,
  startOfMonth,
  addMonths,
  subMonths,
  getDaysInMonth,
  getDate,
  parseISO,
} from "date-fns";
import {
  Plus, Edit2, Trash2, Sparkles, Loader2, Check,
  ChevronLeft, ChevronRight, Pencil, TrendingUp, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AISuggestion = { categoryId: number; categoryName: string; monthlyLimit: number };

interface MonthlyPlan {
  income: string;
  rent: string;
  carPayment: string;
  insurance: string;
  utilities: string;
  savings: string;
}

const PLAN_KEY = "couples-budget-monthly-plan";

const defaultPlan: MonthlyPlan = {
  income: "", rent: "", carPayment: "", insurance: "", utilities: "", savings: "",
};

function usePlan() {
  const [plan, setPlanState] = useState<MonthlyPlan>(() => {
    try {
      const stored = localStorage.getItem(PLAN_KEY);
      return stored ? { ...defaultPlan, ...JSON.parse(stored) } : defaultPlan;
    } catch { return defaultPlan; }
  });

  const savePlan = (next: MonthlyPlan) => {
    setPlanState(next);
    localStorage.setItem(PLAN_KEY, JSON.stringify(next));
  };

  return { plan, savePlan };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);

const budgetSchema = z.object({
  categoryId: z.coerce.number().positive("Category is required"),
  monthlyLimit: z.coerce.number().positive("Limit must be positive"),
  month: z.string(),
});

// ─── Component ────────────────────────────────────────────────────────────────

export function Budgets() {
  const queryClient = useQueryClient();
  const { plan, savePlan } = usePlan();

  // Month navigation
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const activeMonthStr = format(activeMonth, "yyyy-MM-dd"); // matches DB format
  const activeMonthKey = format(activeMonth, "yyyy-MM");    // for display

  // Data
  const { data: allBudgets, isLoading: loadingBudgets } = useListBudgets();
  const { data: allTransactions } = useListTransactions();
  const { data: categories, isLoading: loadingCategories } = useListCategories();

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  // Filter budgets to active month
  const budgets = allBudgets?.filter(b => b.month.startsWith(activeMonthKey)) ?? [];

  // Filter transactions to active month
  const monthTransactions = (allTransactions ?? []).filter(
    t => t.date.startsWith(activeMonthKey)
  );

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Plan editor state
  const [planOpen, setPlanOpen] = useState(false);
  const [draftPlan, setDraftPlan] = useState<MonthlyPlan>(plan);
  useEffect(() => { setDraftPlan(plan); }, [planOpen]);

  // AI suggestion state
  const [aiOpen, setAiOpen] = useState(false);
  const [income, setIncome] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [rent, setRent] = useState("");
  const [carPayment, setCarPayment] = useState("");
  const [insurance, setInsurance] = useState("");
  const [utilities, setUtilities] = useState("");
  const [savings, setSavings] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[] | null>(null);
  const [applying, setApplying] = useState(false);

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { categoryId: 0, monthlyLimit: 0, month: activeMonthStr },
  });

  // ── Computed plan numbers ──────────────────────────────────────────────────

  const p = (v: string) => parseFloat(v) || 0;
  const planIncome   = p(plan.income);
  const planRent     = p(plan.rent);
  const planCar      = p(plan.carPayment);
  const planIns      = p(plan.insurance);
  const planUtil     = p(plan.utilities);
  const planSavings  = p(plan.savings);
  const planFixed    = planRent + planCar + planIns + planUtil;
  const planReserved = planFixed + planSavings;
  const planForSpend = Math.max(0, planIncome - planReserved);

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const unallocated   = planIncome > 0 ? planForSpend - totalBudgeted : 0;

  // Days projection
  const today = new Date();
  const isCurrentMonth = format(activeMonth, "yyyy-MM") === format(today, "yyyy-MM");
  const dayOfMonth  = isCurrentMonth ? getDate(today) : getDaysInMonth(activeMonth);
  const daysInMonth = getDaysInMonth(activeMonth);
  const daysLeft    = isCurrentMonth ? daysInMonth - dayOfMonth : 0;
  const dailyPace   = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const projected   = dailyPace * daysInMonth;

  // Unbudgeted categories
  const budgetedCatIds = new Set(budgets.map(b => b.categoryId));
  const unbudgetedCats = (categories ?? []).filter(c => !budgetedCatIds.has(c.id));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openNewModal = () => {
    setEditingBudget(null);
    form.reset({ categoryId: 0, monthlyLimit: 0, month: activeMonthStr });
    setIsModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({ categoryId: budget.categoryId, monthlyLimit: budget.monthlyLimit, month: budget.month });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove this budget?")) {
      deleteBudget.mutate({ id }, {
        onSuccess: () => {
          toast.success("Budget removed");
          queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
        },
        onError: () => toast.error("Failed to remove budget"),
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
        onError: () => toast.error("Failed to update budget"),
      });
    } else {
      createBudget.mutate({ data: { ...values, month: activeMonthStr } }, {
        onSuccess: () => {
          toast.success("Budget set");
          queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
          setIsModalOpen(false);
        },
        onError: () => toast.error("Failed to set budget"),
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
        body: JSON.stringify({
          monthlyIncome: val,
          ...(zipCode.trim() ? { zipCode: zipCode.trim() } : {}),
          ...(rent      ? { rent:        parseFloat(rent)      } : {}),
          ...(carPayment ? { carPayment: parseFloat(carPayment) } : {}),
          ...(insurance  ? { insurance:  parseFloat(insurance)  } : {}),
          ...(utilities  ? { utilities:  parseFloat(utilities)  } : {}),
          ...(savings    ? { savings:    parseFloat(savings)    } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { suggestions: AISuggestion[] };
      setSuggestions(data.suggestions);
    } catch {
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
      const existing = budgets.find(b => b.categoryId === s.categoryId);
      try {
        await new Promise<void>((resolve, reject) => {
          if (existing) {
            updateBudget.mutate(
              { id: existing.id, data: { monthlyLimit: s.monthlyLimit } },
              { onSuccess: () => resolve(), onError: reject }
            );
          } else {
            createBudget.mutate(
              { data: { categoryId: s.categoryId, monthlyLimit: s.monthlyLimit, month: activeMonthStr } },
              { onSuccess: () => resolve(), onError: reject }
            );
          }
        });
        applied++;
      } catch { /* continue */ }
    }
    await queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
    setApplying(false);
    setAiOpen(false);
    setSuggestions(null);
    setIncome(""); setZipCode(""); setRent(""); setCarPayment(""); setInsurance(""); setUtilities(""); setSavings("");
    toast.success(`Applied ${applied} budget suggestions`);
  };

  const totalSuggested = suggestions?.reduce((sum, s) => sum + s.monthlyLimit, 0) ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Monthly Budgets</h2>
          <p className="text-muted-foreground mt-1">Plan your month, track every dollar.</p>
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

      {/* ── Monthly Plan strip ── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="font-semibold text-base text-foreground">Monthly Plan</h3>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground h-8" onClick={() => setPlanOpen(true)}>
            <Pencil className="w-3.5 h-3.5" />
            {planIncome > 0 ? "Edit" : "Set up"}
          </Button>
        </div>

        {planIncome === 0 ? (
          <div className="px-6 pb-5 text-sm text-muted-foreground">
            Add your monthly income to see how it breaks down.{" "}
            <button className="text-primary underline underline-offset-2" onClick={() => setPlanOpen(true)}>Set up now</button>
          </div>
        ) : (
          <>
            {/* Income flow */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-t border-border">
              {[
                { label: "Monthly Income", value: planIncome, sub: "take-home", color: "text-foreground" },
                { label: "Fixed Expenses", value: planFixed,
                  sub: [planRent && `Rent ${fmt(planRent)}`, planCar && `Car ${fmt(planCar)}`, planIns && `Ins ${fmt(planIns)}`, planUtil && `Utils ${fmt(planUtil)}`].filter(Boolean).join(" · ") || "none set",
                  color: "text-muted-foreground" },
                { label: "Savings Goal", value: planSavings, sub: planSavings > 0 ? `${((planSavings / planIncome) * 100).toFixed(0)}% of income` : "not set", color: "text-emerald-600" },
                { label: "For Spending", value: planForSpend, sub: "after fixed + savings", color: planForSpend < totalBudgeted ? "text-destructive" : "text-primary" },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="px-5 py-4">
                  <div className={`text-2xl font-serif font-medium ${color}`}>{fmt(value)}</div>
                  <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>
                </div>
              ))}
            </div>

            {/* Allocation bar */}
            <div className="px-6 pb-5 pt-3 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Budgeted: {fmt(totalBudgeted)}</span>
                <span className={unallocated < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {unallocated < 0 ? `Over-allocated by ${fmt(Math.abs(unallocated))}` : `Unallocated: ${fmt(unallocated)}`}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${totalBudgeted > planForSpend ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${planForSpend > 0 ? Math.min(100, (totalBudgeted / planForSpend) * 100) : 0}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Month navigation + spend summary ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" onClick={() => setActiveMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[140px] text-center">
            {format(activeMonth, "MMMM yyyy")}
          </span>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full"
            onClick={() => setActiveMonth(m => addMonths(m, 1))}
            disabled={format(activeMonth, "yyyy-MM") === format(new Date(), "yyyy-MM")}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {format(activeMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM") && (
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setActiveMonth(startOfMonth(new Date()))}>
              Today
            </Button>
          )}
        </div>

        {/* Spend summary chips */}
        {budgets.length > 0 && (
          <div className="flex gap-3 text-sm flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-semibold">{fmt(totalSpent)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
              <span className="text-muted-foreground">of</span>
              <span className="font-semibold">{fmt(totalBudgeted)}</span>
            </div>
            {isCurrentMonth && daysLeft > 0 && dailyPace > 0 && (
              <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Projected {fmt(projected)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Budget cards ── */}
      {loadingBudgets || loadingCategories ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((budget) => {
            const spent = budget.spent ?? 0;
            const pct = Math.min(100, (spent / budget.monthlyLimit) * 100);
            const isNear = pct >= 85;
            const isOver = pct >= 100;
            const remaining = budget.monthlyLimit - spent;
            const catIcon = categories?.find(c => c.id === budget.categoryId)?.icon;

            // Transactions for this category this month
            const catTxns = monthTransactions
              .filter(t => t.categoryId === budget.categoryId)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 4);

            return (
              <Card key={budget.id} className={`border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative ${isOver ? "bg-destructive/5" : ""}`}>
                {isOver && (
                  <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg">
                    Over Budget
                  </div>
                )}

                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-sm shadow-sm">
                      {catIcon || "?"}
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

                <CardContent className="space-y-3">
                  {/* Spent + limit */}
                  <div className="flex justify-between items-end">
                    <div className="font-serif text-3xl font-medium text-foreground">{fmt(spent)}</div>
                    <div className="text-muted-foreground text-sm font-medium mb-1">of {fmt(budget.monthlyLimit)}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${isOver ? "bg-destructive" : isNear ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%`, backgroundColor: !isOver && !isNear ? (budget.categoryColor || undefined) : undefined }}
                    />
                  </div>

                  {/* Remaining / over */}
                  <div className={`text-xs font-medium ${isOver ? "text-destructive" : isNear ? "text-amber-600" : "text-muted-foreground"}`}>
                    {remaining >= 0
                      ? `${fmt(remaining)} remaining${isCurrentMonth && daysLeft > 0 ? ` · ${fmt(remaining / daysLeft)}/day` : ""}`
                      : `${fmt(Math.abs(remaining))} over limit`}
                  </div>

                  {/* Recent transactions for this category */}
                  {catTxns.length > 0 && (
                    <div className="border-t border-border pt-3 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Recent</div>
                      {catTxns.map(t => (
                        <div key={t.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground text-xs shrink-0">
                              {format(parseISO(t.date), "MMM d")}
                            </span>
                            <span className="truncate text-foreground">{t.description}</span>
                          </div>
                          <span className="font-medium shrink-0 ml-3">{fmt(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {budgets.length === 0 && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
              No budgets for {format(activeMonth, "MMMM yyyy")}. Use <strong>AI Suggest</strong> or set limits manually.
            </div>
          )}
        </div>
      )}

      {/* ── Unbudgeted categories ── */}
      {unbudgetedCats.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>{unbudgetedCats.length} categor{unbudgetedCats.length === 1 ? "y has" : "ies have"} no budget this month</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unbudgetedCats.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  form.reset({ categoryId: cat.id, monthlyLimit: 0, month: activeMonthStr });
                  setEditingBudget(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-border bg-card text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <Plus className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Manual budget modal ── */}
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
                        {categories?.filter(c => !budgets.find(b => b.categoryId === c.id))?.map(cat => (
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

      {/* ── Monthly Plan editor ── */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Monthly Plan</DialogTitle>
            <DialogDescription>
              Enter your combined monthly take-home and fixed costs. This stays saved for planning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Income */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Monthly Take-Home Income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" step="100" className="pl-7" placeholder="e.g. 8000"
                  value={draftPlan.income}
                  onChange={e => setDraftPlan(d => ({ ...d, income: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fixed Monthly Expenses</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "rent",       label: "Rent / Mortgage", placeholder: "e.g. 1800" },
                  { key: "carPayment", label: "Car Payment(s)",  placeholder: "e.g. 500"  },
                  { key: "insurance",  label: "Insurance",       placeholder: "e.g. 300"  },
                  { key: "utilities",  label: "Utilities",       placeholder: "e.g. 200"  },
                ] as { key: keyof MonthlyPlan; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input type="number" step="50" min="0" className="pl-7 h-9 text-sm" placeholder={placeholder}
                        value={draftPlan[key]}
                        onChange={e => setDraftPlan(d => ({ ...d, [key]: e.target.value }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Savings */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Savings Goal <span className="text-muted-foreground font-normal">(optional)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" step="50" className="pl-7" placeholder="e.g. 1000"
                  value={draftPlan.savings}
                  onChange={e => setDraftPlan(d => ({ ...d, savings: e.target.value }))} />
              </div>
            </div>

            {/* Live preview */}
            {p(draftPlan.income) > 0 && (() => {
              const inc  = p(draftPlan.income);
              const fixed = p(draftPlan.rent) + p(draftPlan.carPayment) + p(draftPlan.insurance) + p(draftPlan.utilities);
              const sav  = p(draftPlan.savings);
              const left = Math.max(0, inc - fixed - sav);
              return (
                <div className="rounded-xl bg-muted/50 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div><div className="font-semibold text-sm">{fmt(fixed)}</div><div className="text-muted-foreground">Fixed</div></div>
                  <div><div className="font-semibold text-sm text-emerald-600">{fmt(sav)}</div><div className="text-muted-foreground">Savings</div></div>
                  <div><div className={`font-semibold text-sm ${left < 0 ? "text-destructive" : "text-primary"}`}>{fmt(left)}</div><div className="text-muted-foreground">To spend</div></div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPlanOpen(false)}>Cancel</Button>
              <Button onClick={() => { savePlan(draftPlan); setPlanOpen(false); toast.success("Plan saved"); }}>
                Save Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI suggestion modal ── */}
      <Dialog open={aiOpen} onOpenChange={(o) => { setAiOpen(o); if (!o) { setSuggestions(null); setIncome(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" step="100" min="1" className="pl-7" placeholder="Monthly take-home income"
                  value={income} onChange={e => { setIncome(e.target.value); setSuggestions(null); }}
                  onKeyDown={e => e.key === "Enter" && handleAISuggest()} />
              </div>
              <Input type="text" inputMode="numeric" maxLength={5} className="w-28 shrink-0" placeholder="ZIP code"
                value={zipCode} onChange={e => { setZipCode(e.target.value.replace(/\D/g, "")); setSuggestions(null); }}
                onKeyDown={e => e.key === "Enter" && handleAISuggest()} />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fixed Monthly Expenses (optional)</p>
              <p className="text-xs text-muted-foreground -mt-1">Deducted first — AI allocates only what's left.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: "Rent / Mortgage",  value: rent,       setter: setRent,       placeholder: "e.g. 1800" },
                  { label: "Car Payment(s)",    value: carPayment, setter: setCarPayment, placeholder: "e.g. 500"  },
                  { label: "Insurance",         value: insurance,  setter: setInsurance,  placeholder: "e.g. 300"  },
                  { label: "Utilities",         value: utilities,  setter: setUtilities,  placeholder: "e.g. 200"  },
                  { label: "Desired Savings",   value: savings,    setter: setSavings,    placeholder: "e.g. 1000" },
                ] as { label: string; value: string; setter: (v: string) => void; placeholder: string }[]).map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input type="number" step="50" min="0" className="pl-7 h-9 text-sm" placeholder={placeholder}
                        value={value} onChange={e => { setter(e.target.value); setSuggestions(null); }} />
                    </div>
                  </div>
                ))}
              </div>
              {income && (rent || carPayment || insurance || utilities || savings) && (() => {
                const fixed = [rent, carPayment, insurance, utilities, savings].reduce((s, v) => s + (parseFloat(v) || 0), 0);
                const left = parseFloat(income) - fixed;
                return (
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground">Reserved: {fmt(fixed)}</span>
                    <span className={left < 0 ? "text-destructive font-medium" : "text-primary font-medium"}>
                      For spending: {fmt(Math.max(0, left))}
                    </span>
                  </div>
                );
              })()}
            </div>

            <Button onClick={handleAISuggest} disabled={aiLoading || !income} className="w-full gap-2">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? "Generating…" : "Generate Budget"}
            </Button>

            {aiLoading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            )}

            {suggestions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Suggested allocations</span>
                  <Badge variant="secondary">Total: {fmt(totalSuggested)}</Badge>
                </div>
                <div className="divide-y divide-border rounded-xl border overflow-hidden">
                  {suggestions.map(s => {
                    const cat = categories?.find(c => c.id === s.categoryId);
                    return (
                      <div key={s.categoryId} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat?.icon ?? "📦"}</span>
                          <span className="font-medium text-sm">{s.categoryName}</span>
                        </div>
                        <span className="font-serif text-primary font-semibold">{fmt(s.monthlyLimit)}</span>
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
