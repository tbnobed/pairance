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
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

const budgetSchema = z.object({
  categoryId: z.coerce.number().positive("Category is required"),
  monthlyLimit: z.coerce.number().positive("Limit must be positive"),
  month: z.string()
});

export function Budgets() {
  const queryClient = useQueryClient();
  const { data: budgets, isLoading: loadingBudgets } = useListBudgets();
  const { data: categories, isLoading: loadingCategories } = useListCategories();
  
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: 0,
      monthlyLimit: 0,
      month: currentMonth
    },
  });

  const openNewModal = () => {
    setEditingBudget(null);
    form.reset({ categoryId: 0, monthlyLimit: 0, month: currentMonth });
    setIsModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({ 
      categoryId: budget.categoryId, 
      monthlyLimit: budget.monthlyLimit, 
      month: budget.month 
    });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Monthly Budgets</h2>
          <p className="text-muted-foreground mt-1">Set gentle limits to guide your spending.</p>
        </div>
        <Button onClick={openNewModal} className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-2" />
          Set Budget
        </Button>
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
                    <div className="font-serif text-3xl font-medium text-foreground">
                      {formatCurrency(spent)}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium mb-1">
                      of {formatCurrency(budget.monthlyLimit)}
                    </div>
                  </div>
                  
                  <div className="w-full bg-muted rounded-full h-3 mt-4 overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        isOverLimit ? 'bg-destructive' : 
                        isNearLimit ? 'bg-amber-500' : 
                        'bg-primary'
                      }`}
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: !isOverLimit && !isNearLimit ? (budget.categoryColor || undefined) : undefined
                      }}
                    />
                  </div>
                  
                  <div className="mt-3 text-xs text-muted-foreground text-right">
                    {budget.monthlyLimit - spent > 0 
                      ? `${formatCurrency(budget.monthlyLimit - spent)} remaining`
                      : `${formatCurrency(spent - budget.monthlyLimit)} over limit`
                    }
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!budgets || budgets.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
              No budgets set yet. Set limits for your categories to start tracking.
            </div>
          )}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingBudget ? "Update Budget" : "Set New Budget"}</DialogTitle>
            <DialogDescription>
              {editingBudget ? "Adjust the monthly limit for this category." : "Choose a category and set a gentle spending limit for the month."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!editingBudget && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(parseInt(val, 10))} 
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.filter(c => !budgets?.find(b => b.categoryId === c.id))?.map(cat => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{cat.icon}</span>
                                <span>{cat.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="monthlyLimit"
                render={({ field }) => (
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
                )}
              />

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
    </div>
  );
}