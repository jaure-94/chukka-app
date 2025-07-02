import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TourDatePicker, TimePicker } from "@/components/enhanced-date-picker";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { useSidebar } from "@/contexts/sidebar-context";

// Form validation schema
const dispatchFormSchema = z.object({
  tourName: z.string().min(1, "Tour name is required"),
  adults: z.number().min(0, "Number of adults must be 0 or greater"),
  children: z.number().min(0, "Number of children must be 0 or greater"),
  departure: z.string().optional(),
  returnTime: z.string().optional(),
  comp: z.number().min(0, "Comp guests must be 0 or greater").optional(),
  totalGuests: z.number().min(0, "Total guests must be 0 or greater").optional(),
  notes: z.string().optional(),
});

type DispatchFormData = z.infer<typeof dispatchFormSchema>;

interface ProcessingJob {
  id: number;
  status: string;
  templateType: string;
  outputPath?: string;
  dropboxUrl?: string;
  createdAt: string;
}

export default function CreateDispatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateData, setTemplateData] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const { isCollapsed } = useSidebar();

  // Load template data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('templateData');
    if (storedData) {
      setTemplateData(JSON.parse(storedData));
    } else {
      // If no template data, redirect back to upload page
      setLocation('/');
    }
  }, [setLocation]);

  // Form setup
  const form = useForm<DispatchFormData>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: {
      tourName: "",
      adults: 0,
      children: 0,
      departure: "",
      returnTime: "",
      comp: 0,
      totalGuests: 0,
      notes: "",
    },
  });

  // Watch form values for auto-calculation
  const adults = form.watch("adults") || 0;
  const children = form.watch("children") || 0;
  const comp = form.watch("comp") || 0;

  // Auto-calculate total guests whenever component values change
  useEffect(() => {
    const calculatedTotal = adults + children + comp;
    form.setValue("totalGuests", calculatedTotal);
  }, [adults, children, comp, form]);

  // Create dispatch record mutation
  const createDispatchMutation = useMutation({
    mutationFn: async (data: DispatchFormData) => {
      const response = await apiRequest("POST", "/api/dispatch-records", {
        tourName: data.tourName,
        adults: data.adults,
        children: data.children,
        departure: data.departure || "",
        returnTime: data.returnTime || "",
        comp: data.comp || 0,
        totalGuests: data.totalGuests || (data.adults + data.children + (data.comp || 0)),
        notes: data.notes || "",
        isActive: true,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dispatch record created successfully",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch-records"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create dispatch record",
        variant: "destructive",
      });
      console.error("Error creating dispatch record:", error);
    },
  });



  const onSubmit = (data: DispatchFormData) => {
    createDispatchMutation.mutate(data);
  };



  const handleBackToUpload = () => {
    sessionStorage.removeItem('templateData');
    setLocation('/');
  };

  if (!templateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600">Loading template data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-10">
        <SidebarNavigation />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6 flex items-center justify-between">
              <div className="flex items-center">
                {/* Mobile Navigation */}
                <MobileNavigation />
                <div className="ml-4 md:ml-0">
                  <h1 className="text-3xl font-bold text-gray-900">Create Dispatch Record</h1>
                  <p className="mt-2 text-gray-600">
                    Add dispatch information and generate your report
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleBackToUpload}>
                Back to Upload
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Dispatch Record Form */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create new dispatch record</h2>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Tour Name */}
              <div className="space-y-2">
                <Label htmlFor="tourName" className="text-sm font-medium text-gray-700">
                  Tour Name
                </Label>
                <Input
                  id="tourName"
                  type="text"
                  {...form.register("tourName")}
                  placeholder="Enter tour name (e.g., Catamaran, HSH, etc.)"
                  className="w-full"
                />
                {form.formState.errors.tourName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.tourName.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Number of Adults */}
                <div className="space-y-2">
                  <Label htmlFor="adults" className="text-sm font-medium text-gray-700">
                    Number of Adults
                  </Label>
                  <Input
                    id="adults"
                    type="number"
                    min="0"
                    {...form.register("adults", { valueAsNumber: true })}
                    className="w-full"
                  />
                  {form.formState.errors.adults && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.adults.message}
                    </p>
                  )}
                </div>

                {/* Number of Children */}
                <div className="space-y-2">
                  <Label htmlFor="children" className="text-sm font-medium text-gray-700">
                    Number of Children
                  </Label>
                  <Input
                    id="children"
                    type="number"
                    min="0"
                    {...form.register("children", { valueAsNumber: true })}
                    className="w-full"
                  />
                  {form.formState.errors.children && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.children.message}
                    </p>
                  )}
                </div>

                {/* Comp Guests */}
                <div className="space-y-2">
                  <Label htmlFor="comp" className="text-sm font-medium text-gray-700">
                    Comp Guests
                  </Label>
                  <Input
                    id="comp"
                    type="number"
                    min="0"
                    {...form.register("comp", { valueAsNumber: true })}
                    className="w-full"
                  />
                  {form.formState.errors.comp && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.comp.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Tour Date Selection */}
              <div className="mb-6">
                <TourDatePicker
                  label="Tour Date"
                  selectedDate={tourDate}
                  onDateChange={setTourDate}
                />
              </div>

              {/* Time Selection for Departure and Return */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Departure Time */}
                <div>
                  <TimePicker
                    label="Departure Time"
                    value={form.watch("departure") || ""}
                    onChange={(value: string) => form.setValue("departure", value)}
                    selectedDate={tourDate}
                    error={form.formState.errors.departure?.message}
                  />
                </div>

                {/* Return Time */}
                <div>
                  <TimePicker
                    label="Return Time"
                    value={form.watch("returnTime") || ""}
                    onChange={(value: string) => form.setValue("returnTime", value)}
                    selectedDate={tourDate}
                    error={form.formState.errors.returnTime?.message}
                  />
                </div>
              </div>

              {/* Total Guests */}
              <div className="space-y-2">
                <Label htmlFor="totalGuests" className="text-sm font-medium text-gray-700">
                  Total Guests
                  <span className="text-xs text-blue-600 ml-2 bg-blue-50 px-2 py-1 rounded">Auto-calculated</span>
                </Label>
                <Input
                  id="totalGuests"
                  type="number"
                  min="0"
                  {...form.register("totalGuests", { valueAsNumber: true })}
                  disabled
                  className="w-full max-w-xs rounded-lg border-gray-300 bg-gray-50 text-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">
                  Automatically calculated: {adults} adults + {children} children + {comp} comp guests = {adults + children + comp} total
                </p>
                {form.formState.errors.totalGuests && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.totalGuests.message}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  {...form.register("notes")}
                  placeholder="Enter any additional notes..."
                  className="w-full min-h-[100px]"
                />
                {form.formState.errors.notes && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.notes.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={createDispatchMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createDispatchMutation.isPending ? "Creating..." : "Create Record"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>


        </main>
      </div>
    </div>
  );
}