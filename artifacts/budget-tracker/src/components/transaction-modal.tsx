import React, { useEffect } from "react";
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
    }
  }, [isOpen, transaction, initialData, form]);

  const onSubmit = (values: z.infer<typeof transactionSchema>) => {
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
              <Button type="submit" disabled={createTx.isPending || updateTx.isPending}>
                {transaction ? "Save Changes" : "Save Transaction"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
