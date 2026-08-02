import React, { useState, useEffect } from "react";
import { 
  useListTransactions, 
  useListCategories, 
  useDeleteTransaction,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByDayQueryKey,
  getGetRecentActivityQueryKey,
  Transaction
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/date";
import { 
  MapPin, 
  Trash2, 
  Edit3, 
  Search,
  Filter,
  Repeat,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionModal } from "@/components/transaction-modal";
import { RecurringManager } from "@/components/recurring-manager";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Transactions() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Debounce search so we don't hit the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("txPageSize") || "", 10);
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 25;
  });

  const handlePageSizeChange = (val: string) => {
    const size = parseInt(val, 10);
    setPageSize(size);
    setPage(0);
    localStorage.setItem("txPageSize", val);
  };

  const queryClient = useQueryClient();
  const { data: categories } = useListCategories();
  
  const categoryIdFilter = selectedCategory === "all" ? null : parseInt(selectedCategory, 10);
  // Fetch one extra row to know whether a next page exists
  const { data: pageRows, isLoading } = useListTransactions({
    ...(categoryIdFilter ? { categoryId: categoryIdFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    limit: pageSize + 1,
    offset: page * pageSize,
  }, { query: { placeholderData: (prev: Transaction[] | undefined) => prev } as never });
  const hasNextPage = (pageRows?.length ?? 0) > pageSize;
  const transactions = pageRows?.slice(0, pageSize);
  const deleteTx = useDeleteTransaction();

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(0);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteTx.mutate({ id }, {
        onSuccess: () => {
          toast.success("Transaction deleted");
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByDayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        },
        onError: () => {
          toast.error("Failed to delete transaction");
        }
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Search is now server-side (full history), so no client-side filtering
  const filteredTransactions = transactions;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Transactions</h2>
          <p className="text-muted-foreground mt-1">Review and manage your shared spending history.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="bg-card border-none shadow-sm" onClick={() => setRecurringOpen(true)}>
            <Repeat className="w-4 h-4 mr-2" />
            Recurring
          </Button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-card border-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[160px] bg-card border-none shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(cat => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-sm border-border bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredTransactions?.map((tx) => (
                <div key={tx.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-medium shadow-sm shrink-0"
                      style={{ backgroundColor: tx.categoryColor || 'hsl(var(--muted))' }}
                    >
                      {tx.categoryName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-lg">{tx.description}</div>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="font-medium text-foreground/70">{tx.userName}</span>
                        <span>•</span>
                        <span>{format(parseLocalDate(tx.date), 'MMMM d, yyyy')}</span>
                        {tx.locationName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary">
                              <MapPin className="w-3 h-3" />
                              {tx.locationName}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {categories?.find(c => c.id === tx.categoryId)?.icon} 
                          {tx.categoryName}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-0 pt-4 sm:pt-0 border-border/50">
                    <div className="font-serif font-medium text-xl">
                      {formatCurrency(tx.amount)}
                    </div>
                    <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground bg-muted/50"
                        onClick={() => setEditingTx(tx)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive bg-destructive/10"
                        onClick={() => handleDelete(tx.id)}
                        disabled={deleteTx.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!filteredTransactions || filteredTransactions.length === 0) && (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">No transactions found</h3>
                  <p>{page > 0 ? "This page is empty." : "Try adjusting your search or filter criteria."}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Per page:</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px] h-8 bg-card border-none shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(page > 0 || hasNextPage) && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      <RecurringManager open={recurringOpen} onClose={() => setRecurringOpen(false)} />

      {editingTx && (
        <TransactionModal 
          isOpen={!!editingTx} 
          onClose={() => setEditingTx(null)} 
          transaction={editingTx}
        />
      )}
    </div>
  );
}
