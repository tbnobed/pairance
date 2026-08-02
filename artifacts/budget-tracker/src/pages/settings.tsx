import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMe, useCreatePartner, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ConnectedAccounts } from "@/components/connected-accounts";

const partnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function Settings() {
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const createPartner = useCreatePartner();

  const form = useForm<z.infer<typeof partnerSchema>>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof partnerSchema>) => {
    createPartner.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Partner account created! They can now log in with the email and password you set.");
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => {
        toast.error("Couldn't create the account — that email may already be in use.");
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h2 className="text-3xl font-serif text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account and household.</p>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-border shadow-sm">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-serif">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-medium">{user?.name}</div>
                <div className="text-muted-foreground">{user?.email}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none">
            <Heart className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Shared Household</CardTitle>
            <CardDescription>
              Connect with your partner to track your finances together.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            {user?.spouseName ? (
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4">
                    <Avatar className="w-12 h-12 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="w-12 h-12 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-secondary/30 text-secondary-foreground">
                        {user.spouseName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Connected with {user.spouseName}</div>
                    <div className="text-sm text-muted-foreground">Sharing a single household budget</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center border border-border shadow-sm shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">You're currently flying solo</div>
                    <div className="text-sm text-muted-foreground">Invite your partner to sync your transactions and budgets automatically.</div>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Create your partner's account
                  </h4>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Partner's name" className="bg-background shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="partner@example.com" className="bg-background shadow-sm" {...field} />
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
                              <Input type="password" placeholder="At least 8 characters" className="bg-background shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={createPartner.isPending} className="shadow-sm w-full">
                        {createPartner.isPending ? "Creating..." : "Create Partner Account"}
                      </Button>
                    </form>
                  </Form>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-[400px]">
                    This creates their login and links them to your household instantly. Share the email and password with them — they can log in right away. There is no public sign-up page.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConnectedAccounts />
    </div>
  );
}