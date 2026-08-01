import React, { useState } from "react";
import { 
  useListCategories, 
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
  Category
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  icon: z.string().min(1, "Icon emoji is required"),
});

export function Categories() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useListCategories();
  
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      color: "#f97316",
      icon: "*",
    },
  });

  const openNewModal = () => {
    setEditingCategory(null);
    form.reset({ name: "", color: "#f97316", icon: "*" });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    form.reset({ name: cat.name, color: cat.color, icon: cat.icon });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure? This will not delete transactions, but they will lose this category reference.")) {
      deleteCat.mutate({ id }, {
        onSuccess: () => {
          toast.success("Category deleted");
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        },
        onError: () => toast.error("Failed to delete category")
      });
    }
  };

  const onSubmit = (values: z.infer<typeof categorySchema>) => {
    if (editingCategory) {
      updateCat.mutate({ id: editingCategory.id, data: values }, {
        onSuccess: () => {
          toast.success("Category updated");
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setIsModalOpen(false);
        },
        onError: () => toast.error("Failed to update category")
      });
    } else {
      createCat.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Category created");
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          setIsModalOpen(false);
        },
        onError: () => toast.error("Failed to create category")
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif text-foreground">Categories</h2>
          <p className="text-muted-foreground mt-1">Organize your spending into colorful buckets.</p>
        </div>
        <Button onClick={openNewModal} className="rounded-full shadow-md">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories?.map((cat) => (
            <Card key={cat.id} className="border-none shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex items-center gap-4 relative">
                  <div 
                    className="absolute top-0 left-0 bottom-0 w-2"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-muted/50">
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-lg">{cat.name}</h3>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-8 h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditModal(cat)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-8 h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deleteCat.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!categories || categories.length === 0) && (
            <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
              No categories yet. Create one to start organizing your spending!
            </div>
          )}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the details of your spending category." : "Add a new category to group your transactions."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Groceries" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon (Emoji or Symbol)</FormLabel>
                      <FormControl>
                        <Input placeholder="*" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-12 h-10 p-1 cursor-pointer" {...field} />
                          <Input className="flex-1" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCat.isPending || updateCat.isPending}>
                  {editingCategory ? "Save Changes" : "Create Category"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}