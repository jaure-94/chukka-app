import * as XLSX from "xlsx";

export interface ParsedSheet {
  name: string;
  data: Record<string, any>[];
  columns: string[];
}

export interface ParsedExcelData {
  sheets: ParsedSheet[];
}

export class ExcelParser {
  async parseFile(filePath: string): Promise<ParsedExcelData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: ParsedSheet[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Get column headers
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const columns: string[] = [];
        
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            columns.push(String(cell.v));
          }
        }

        sheets.push({
          name: sheetName,
          data: jsonData as Record<string, any>[],
          columns: columns.length > 0 ? columns : Object.keys(jsonData[0] || {}),
        });
      }

      return { sheets };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
