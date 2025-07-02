import XLSX from "xlsx";

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
        
        // For dispatch sheets, ignore first 7 rows and start from row 8
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const startRow = 7; // Row 8 (0-indexed as 7)
        
        // Get column headers from row 8
        const columns: string[] = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: startRow, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            columns.push(String(cell.v).trim());
          }
        }

        // Expected dispatch column headers
        const expectedColumns = [
          'Tour Name',
          'Departure', 
          'Return',
          'Adults',
          'Children',
          'Comp',
          'Total Guests',
          'Notes'
        ];

        // Parse data starting from row 9 (data rows after headers)
        const jsonData: Record<string, any>[] = [];
        
        for (let row = startRow + 1; row <= range.e.r; row++) {
          const rowData: Record<string, any> = {};
          let hasData = false;
          
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            const columnName = columns[col - range.s.c] || `Column${col + 1}`;
            
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
              rowData[columnName] = cell.v;
              hasData = true;
            } else {
              rowData[columnName] = '';
            }
          }
          
          // Only include rows that have some data
          if (hasData) {
            jsonData.push(rowData);
          }
        }

        sheets.push({
          name: sheetName,
          data: jsonData,
          columns: columns.length > 0 ? columns : expectedColumns,
        });
      }

      return { sheets };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
