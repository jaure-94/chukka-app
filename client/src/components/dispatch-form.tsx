import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

const dispatchRecordSchema = z.object({
  tourName: z.string().min(1, "Tour name is required"),
  numAdult: z.number().min(0, "Adult count must be 0 or greater"),
  numChild: z.number().min(0, "Child count must be 0 or greater"),
  notes: z.string().optional(),
  // Template header fields
  shipName: z.string().optional(),
  tourOperator: z.string().optional(),
  shorexManager: z.string().optional(),
  shorexAsstManager: z.string().optional(),
});

type DispatchRecordForm = z.infer<typeof dispatchRecordSchema>;

interface DispatchFormProps {
  onRecordAdded?: () => void;
}

export function DispatchForm({ onRecordAdded }: DispatchFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DispatchRecordForm>({
    resolver: zodResolver(dispatchRecordSchema),
    defaultValues: {
      tourName: "",
      numAdult: 0,
      numChild: 0,
      notes: "",
      shipName: "",
      tourOperator: "",
      shorexManager: "",
      shorexAsstManager: "",
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: async (data: DispatchRecordForm) => {
      const response = await fetch("/api/dispatch-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to add dispatch record");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dispatch record added and reports generated successfully",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports"] });
      onRecordAdded?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add dispatch record",
        variant: "destructive",
      });
      console.error("Add record error:", error);
    },
  });

  const onSubmit = (data: DispatchRecordForm) => {
    addRecordMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Dispatch Record
        </CardTitle>
        <CardDescription>
          Add a new dispatch record. Reports will be automatically generated and updated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tourName">Tour Name</Label>
              <Input
                id="tourName"
                placeholder="Enter tour name"
                {...form.register("tourName")}
              />
              {form.formState.errors.tourName && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.tourName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numAdult">Number of Adults</Label>
              <Input
                id="numAdult"
                type="number"
                min="0"
                placeholder="0"
                {...form.register("numAdult", { valueAsNumber: true })}
              />
              {form.formState.errors.numAdult && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.numAdult.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numChild">Number of Children</Label>
              <Input
                id="numChild"
                type="number"
                min="0"
                placeholder="0"
                {...form.register("numChild", { valueAsNumber: true })}
              />
              {form.formState.errors.numChild && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.numChild.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Enter any notes or comments about this record"
              rows={3}
              {...form.register("notes")}
            />
          </div>

          <Button
            type="submit"
            disabled={addRecordMutation.isPending}
            className="w-full"
          >
            {addRecordMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Record...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Record & Generate Reports
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}