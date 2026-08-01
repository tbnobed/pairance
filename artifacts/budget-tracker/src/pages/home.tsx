import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Coins, LineChart } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export function Home() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });

  React.useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Heart className="w-6 h-6 fill-current" />
          <span className="font-serif text-xl font-medium tracking-tight">CouplesBudget</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="inline-flex items-center justify-center rounded-full px-6 h-10 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            Log in
          </Link>
          <Link href="/register" className="inline-flex items-center justify-center rounded-full px-6 h-10 text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center pb-20">
        <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Coins className="w-4 h-4" />
            <span>Shared finances, made simple</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-foreground leading-[1.1] tracking-tight">
            A cozy home for your <br />
            <span className="text-primary italic pr-2">shared money</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Track spending together without the stress. See where your money goes, set gentle budgets, and build your financial future side-by-side.
          </p>
          
          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center rounded-full px-8 h-14 text-lg font-medium bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all w-full sm:w-auto">
              Create your shared household
            </Link>
          </div>

          <div className="mt-16 pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-border/50">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary-foreground flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl">Designed for Two</h3>
              <p className="text-muted-foreground">Invite your partner and see who spent what, instantly synced across both your devices.</p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <LineChart className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl">Gentle Insights</h3>
              <p className="text-muted-foreground">Clear, warm visualizations of your spending habits without feeling like an accounting spreadsheet.</p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl">Cozy Budgets</h3>
              <p className="text-muted-foreground">Set mindful limits on categories you care about, and track progress together organically.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}