import React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  
  React.useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const login = useLogin();

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    login.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Welcome back!");
        setLocation("/dashboard");
      },
      onError: () => {
        toast.error("Invalid email or password");
      }
    });
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
        <Heart className="w-8 h-8 fill-current" />
        <span className="font-serif text-2xl font-medium tracking-tight">CouplesBudget</span>
      </Link>
      
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center space-y-2 pb-6">
          <CardTitle className="font-serif text-3xl">Welcome back</CardTitle>
          <CardDescription className="text-base">
            Enter your details to access your shared finances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" className="h-12 rounded-xl bg-muted/50 border-transparent focus-visible:bg-transparent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="h-12 rounded-xl bg-muted/50 border-transparent focus-visible:bg-transparent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 rounded-xl text-md" disabled={login.isPending}>
                {login.isPending ? "Logging in..." : "Log in"}
              </Button>
            </form>
          </Form>
          
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account yet?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline cursor-pointer">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}