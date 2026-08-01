import React from "react";
import { 
  useGetDashboardSummary, 
  useGetSpendingByDay, 
  useGetRecentActivity,
  useGetMe
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Dashboard() {
  const { data: user } = useGetMe();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: dailySpending, isLoading: isLoadingDaily } = useGetSpendingByDay();
  const { data: recentActivity, isLoading: isLoadingRecent } = useGetRecentActivity();

  if (isLoadingSummary || isLoadingDaily || isLoadingRecent) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-serif">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Welcome back, {user?.name}</h2>
          <p className="text-muted-foreground mt-1">Here's how your shared budget is looking this month.</p>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Spent Card */}
        <Card className="bg-primary text-primary-foreground border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary-foreground/80 font-medium text-sm">Total Spent This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif">{formatCurrency(summary?.totalSpentThisMonth ?? 0)}</div>
            {summary?.totalBudgetThisMonth ? (
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-sm text-primary-foreground/80">
                  <span>vs Budget</span>
                  <span>{formatCurrency(summary.totalBudgetThisMonth)}</span>
                </div>
                <div className="w-full bg-primary-foreground/20 rounded-full h-2">
                  <div 
                    className="bg-white rounded-full h-2 transition-all" 
                    style={{ width: `${Math.min(100, ((summary.totalSpentThisMonth ?? 0) / summary.totalBudgetThisMonth) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Partner Split */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground font-medium text-sm">Who Spent What</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              {summary?.partnerBreakdown?.map(partner => (
                <div key={partner.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-secondary/20 text-secondary-foreground text-xs">
                        {partner.userName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{partner.userName}</span>
                  </div>
                  <span className="font-serif">{formatCurrency(partner.spent)}</span>
                </div>
              ))}
              {(!summary?.partnerBreakdown || summary.partnerBreakdown.length === 0) && (
                <div className="text-sm text-muted-foreground py-2">No spending recorded yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Spending Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Daily Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {dailySpending && dailySpending.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySpending} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border border-border shadow-lg p-3 rounded-lg">
                              <p className="text-sm text-muted-foreground mb-1">{format(new Date(label), 'MMMM d, yyyy')}</p>
                              <p className="font-medium text-foreground">{formatCurrency(payload[0].value as number)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {dailySpending.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="hsl(var(--primary))" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data to display
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 mt-2">
              {summary?.categoryBreakdown?.slice(0, 5).map(cat => (
                <div key={cat.categoryId}>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.categoryColor }} />
                      {cat.categoryName}
                    </span>
                    <span>{formatCurrency(cat.spent)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className="rounded-full h-1.5" 
                      style={{ 
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.categoryColor
                      }}
                    />
                  </div>
                </div>
              ))}
              {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) && (
                <div className="text-sm text-muted-foreground">No categories yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-xl font-serif mb-4 text-foreground">Recent Activity</h3>
        <Card className="shadow-sm border-border">
          <div className="divide-y divide-border">
            {recentActivity?.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm"
                    style={{ backgroundColor: tx.categoryColor || 'hsl(var(--muted))' }}
                  >
                    {tx.categoryName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium">{tx.description}</div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      <span>{tx.userName}</span>
                      <span>•</span>
                      <span>{format(new Date(tx.date), 'MMM d, yyyy')}</span>
                      {tx.locationName && (
                        <>
                          <span>•</span>
                          <span>{tx.locationName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="font-serif font-medium">
                  {formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
            {(!recentActivity || recentActivity.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                No recent activity.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}