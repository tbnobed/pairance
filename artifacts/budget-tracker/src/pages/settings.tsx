import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMe, useInviteSpouse, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, User, UserPlus } from "lucide-react";
import { toast } from "sonner";

const inviteSchema = z.object({
  spouseEmail: z.string().email("Please enter a valid email address"),
});

export function Settings() {
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const inviteSpouse = useInviteSpouse();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      spouseEmail: "",
    },
  });

  const onSubmit = (values: z.infer<typeof inviteSchema>) => {
    inviteSpouse.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Partner invited successfully!");
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to invite partner. They might already be registered.");
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
                    Invite your partner
                  </h4>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="spouseEmail"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="partner@example.com" className="bg-background shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={inviteSpouse.isPending} className="shadow-sm">
                        {inviteSpouse.isPending ? "Sending..." : "Send Invite"}
                      </Button>
                    </form>
                  </Form>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-[400px]">
                    If your partner already has an account with this email, they will be instantly linked to your household. Otherwise, they can sign up using this email.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}