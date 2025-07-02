import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ClipboardList, Users, User, FileText } from "lucide-react";

interface DispatchRecord {
  id: number;
  tourName: string;
  numAdult: number;
  numChild: number;
  notes?: string;
  createdAt: string;
}

export function DispatchRecordsList() {
  const { data: records, isLoading, error } = useQuery<DispatchRecord[]>({
    queryKey: ["/api/dispatch-records"],
    queryFn: async () => {
      const response = await fetch("/api/dispatch-records");
      if (!response.ok) throw new Error("Failed to fetch dispatch records");
      return response.json();
    },
  });

  const totalAdults = records?.reduce((sum, record) => sum + record.numAdult, 0) || 0;
  const totalChildren = records?.reduce((sum, record) => sum + record.numChild, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Dispatch Records</CardTitle>
          <CardDescription>Loading records...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Dispatch Records</CardTitle>
          <CardDescription>Error loading records</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Failed to load dispatch records</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Current Dispatch Records
        </CardTitle>
        <CardDescription>
          All dispatch records that will be included in generated reports
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Records</p>
              <p className="text-lg font-bold text-blue-600">{records?.length || 0}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Total Adults</p>
              <p className="text-lg font-bold text-green-600">{totalAdults}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <User className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Children</p>
              <p className="text-lg font-bold text-purple-600">{totalChildren}</p>
            </div>
          </div>
        </div>

        {/* Records Table */}
        {!records || records.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No dispatch records yet</p>
            <p className="text-sm text-muted-foreground">Add your first record using the form above</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour Name</TableHead>
                  <TableHead className="text-center">Adults</TableHead>
                  <TableHead className="text-center">Children</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.tourName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{record.numAdult}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{record.numChild}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {record.notes ? (
                        <p className="text-sm text-muted-foreground truncate" title={record.notes}>
                          {record.notes}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No notes</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(record.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}