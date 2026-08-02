import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  useCreateTransaction, 
  useUpdateTransaction, 
  useListCategories,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetSpendingByDayQueryKey,
  Transaction
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/date";

const transactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.coerce.number().positive("Category is required"),
  date: z.string(),
  locationName: z.string().optional().nullable(),
  locationLat: z.number().optional().nullable(),
  locationLng: z.number().optional().nullable(),
});

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  initialData?: Partial<z.infer<typeof transactionSchema>>;
}

export function TransactionModal({ isOpen, onClose, transaction, initialData }: TransactionModalProps) {
  const queryClient = useQueryClient();
  const { data: categories } = useListCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();

  const [splitMode, setSplitMode] = useState(false);
  const [splitCategoryId, setSplitCategoryId] = useState<number>(0);
  const [splitAmount, setSplitAmount] = useState<string>("");
  const [splitSaving, setSplitSaving] = useState(false);

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: transaction?.amount ?? initialData?.amount ?? 0,
      description: transaction?.description ?? initialData?.description ?? "",
      categoryId: transaction?.categoryId ?? initialData?.categoryId ?? 0,
      date: transaction?.date ? format(parseLocalDate(transaction.date), 'yyyy-MM-dd') : initialData?.date ?? format(new Date(), 'yyyy-MM-dd'),
      locationName: transaction?.locationName ?? initialData?.locationName ?? null,
      locationLat: transaction?.locationLat ?? initialData?.locationLat ?? null,
      locationLng: transaction?.locationLng ?? initialData?.locationLng ?? null,
    },
  });

  // Reset form when transaction or initialData changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        amount: transaction?.amount ?? initialData?.amount ?? 0,
        description: transaction?.description ?? initialData?.description ?? "",
        categoryId: transaction?.categoryId ?? initialData?.categoryId ?? 0,
        date: transaction?.date ? format(parseLocalDate(transaction.date), 'yyyy-MM-dd') : initialData?.date ?? format(new Date(), 'yyyy-MM-dd'),
        locationName: transaction?.locationName ?? initialData?.locationName ?? null,
        locationLat: transaction?.locationLat ?? initialData?.locationLat ?? null,
        locationLng: transaction?.locationLng ?? initialData?.locationLng ?? null,
      });
      setSplitMode(false);
      setSplitCategoryId(0);
      setSplitAmount("");
    }
  }, [isOpen, transaction, initialData, form]);

  const onSubmit = async (values: z.infer<typeof transactionSchema>) => {
    if (!transaction && splitMode) {
      const second = Math.round(parseFloat(splitAmount || "0") * 100) / 100;
      const first = Math.round((values.amount - second) * 100) / 100;
      if (!splitCategoryId) {
        toast.error("Pick a category for the split");
        return;
      }
      if (splitCategoryId === values.categoryId) {
        toast.error("Split categories must be different");
        return;
      }
      if (!(second > 0) || !(first > 0)) {
        toast.error("Split amount must be more than $0 and less than the total");
        return;
      }
      setSplitSaving(true);
      try {
        await createTx.mutateAsync({ data: { ...values, amount: first } });
        await createTx.mutateAsync({ data: { ...values, amount: second, categoryId: splitCategoryId } });
        toast.success("Transaction split into 2 categories");
        invalidateQueries();
        onClose();
      } catch {
        toast.error("Failed to save split transaction — check your transactions list");
        invalidateQueries();
      } finally {
        setSplitSaving(false);
      }
      return;
    }
    if (transaction) {
      updateTx.mutate({ id: transaction.id, data: values }, {
        onSuccess: () => {
          toast.success("Transaction updated");
          invalidateQueries();
          onClose();
        },
        onError: () => toast.error("Failed to update transaction")
      });
    } else {
      createTx.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Transaction added");
          invalidateQueries();
          onClose();
        },
        onError: () => toast.error("Failed to add transaction")
      });
    }
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByDayQueryKey() });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{transaction ? "Edit Transaction" : "Log Spending"}</DialogTitle>
          <DialogDescription>
            {transaction ? "Update the details of your transaction." : "Add a new transaction to your shared budget."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Coffee, Groceries..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map(cat => (
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

            {!transaction && !splitMode && (
              <button
                type="button"
                onClick={() => setSplitMode(true)}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Split between two categories
              </button>
            )}

            {!transaction && splitMode && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Split part</span>
                  <button
                    type="button"
                    onClick={() => { setSplitMode(false); setSplitCategoryId(0); setSplitAmount(""); }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Remove split
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    onValueChange={(val) => setSplitCategoryId(parseInt(val, 10))}
                    value={splitCategoryId ? splitCategoryId.toString() : ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="2nd category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-7"
                      placeholder="0.00"
                      value={splitAmount}
                      onChange={(e) => setSplitAmount(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const total = parseFloat(String(form.watch("amount"))) || 0;
                    const second = parseFloat(splitAmount) || 0;
                    const first = Math.round((total - second) * 100) / 100;
                    return `First category gets $${first.toFixed(2)}, second gets $${second.toFixed(2)}.`;
                  })()}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.watch("locationName") && (
              <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>At {form.watch("locationName")}</span>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={createTx.isPending || updateTx.isPending || splitSaving}>
                {transaction ? "Save Changes" : splitMode ? "Save 2 Transactions" : "Save Transaction"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
