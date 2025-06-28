import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import type { SheetPreview } from "@/lib/types";

interface DataPreviewProps {
  sheets: SheetPreview[];
}

export function DataPreview({ sheets }: DataPreviewProps) {
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [showAllRows, setShowAllRows] = useState(false);

  if (!sheets || sheets.length === 0) {
    return null;
  }

  const currentSheet = sheets[selectedSheet];
  const displayData = showAllRows ? currentSheet.sampleData : currentSheet.sampleData.slice(0, 3);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Data Preview</h2>
          <span className="text-sm text-gray-500">
            {currentSheet.rowCount} rows detected
          </span>
        </div>

        {sheets.length > 1 && (
          <div className="mb-4">
            <div className="flex space-x-2">
              {sheets.map((sheet, index) => (
                <Button
                  key={index}
                  variant={selectedSheet === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSheet(index)}
                  className={selectedSheet === index ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {sheet.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {currentSheet.columns.map((column, index) => (
                  <TableHead key={index} className="font-medium text-gray-500 uppercase tracking-wider">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => (
                <TableRow key={index} className="hover:bg-gray-50">
                  {currentSheet.columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className="text-sm text-gray-900">
                      {row[column] || ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {currentSheet.sampleData.length > 3 && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => setShowAllRows(!showAllRows)}
              className="text-blue-600 hover:text-blue-700"
            >
              {showAllRows ? `Show less` : `View all ${currentSheet.rowCount} rows`}
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
