import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, FileSpreadsheet, Calendar, Hash } from "lucide-react";

interface GeneratedReport {
  id: number;
  dispatchFilePath: string;
  eodFilePath: string;
  recordCount: number;
  createdAt: string;
}

export function GeneratedReports() {
  const { data: reports, isLoading, error } = useQuery<GeneratedReport[]>({
    queryKey: ["/api/generated-reports"],
    queryFn: async () => {
      const response = await fetch("/api/generated-reports");
      if (!response.ok) throw new Error("Failed to fetch generated reports");
      return response.json();
    },
  });

  const handleDownload = (reportId: number, type: 'dispatch' | 'eod') => {
    const url = `/api/download-report/${reportId}/${type}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Loading reports...</CardDescription>
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
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Error loading reports</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Failed to load generated reports</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Generated Reports
        </CardTitle>
        <CardDescription>
          Download the latest dispatch and EOD reports generated from your records
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!reports || reports.length === 0 ? (
          <div className="text-center py-8">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No reports generated yet</p>
            <p className="text-sm text-muted-foreground">
              Reports will be automatically generated when you add dispatch records
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Latest Report Highlight */}
            {reports.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">Latest Reports</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Generated {new Date(reports[0].createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Contains {reports[0].recordCount} dispatch records
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(reports[0].id, 'dispatch')}
                      className="bg-white/50 hover:bg-white/80"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Dispatch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(reports[0].id, 'eod')}
                      className="bg-white/50 hover:bg-white/80"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      EOD
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* All Reports Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-center">Records</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {new Date(report.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(report.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="secondary">{report.recordCount}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(report.id, 'dispatch')}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Dispatch
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(report.id, 'eod')}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            EOD
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}