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
  private findDispatchSheets(workbook: any): string[] {
    const dispatchSheetNames: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      // Check if this sheet contains dispatch data structure
      if (this.isDispatchSheet(workbook.Sheets[sheetName], sheetName)) {
        dispatchSheetNames.push(sheetName);
      }
    }
    
    console.log(`Found dispatch sheets: ${dispatchSheetNames.join(', ')}`);
    return dispatchSheetNames;
  }

  private isDispatchSheet(worksheet: any, sheetName: string): boolean {
    // Prioritize "Grand Turk" sheet
    if (sheetName.toLowerCase().includes('grand turk')) {
      return true;
    }
    
    // Check if row 8 contains dispatch headers
    const startRow = 7; // Row 8 (0-indexed as 7)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    if (range.e.r < startRow) {
      return false; // Sheet too small
    }
    
    const headers: string[] = [];
    for (let col = range.s.c; col <= Math.min(range.s.c + 7, range.e.c); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: startRow, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        headers.push(String(cell.v).trim().toLowerCase());
      }
    }
    
    // Check if it contains key dispatch headers
    const dispatchHeaders = ['tour name', 'departure', 'return', 'adults', 'children'];
    const foundHeaders = dispatchHeaders.filter(header => 
      headers.some(h => h.includes(header))
    );
    
    const isDispatch = foundHeaders.length >= 3; // At least 3 key headers
    console.log(`Sheet "${sheetName}" - Headers: [${headers.join(', ')}] - Is dispatch: ${isDispatch}`);
    
    return isDispatch;
  }

  async parseFile(filePath: string): Promise<ParsedExcelData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheets: ParsedSheet[] = [];

      // Find the dispatch sheet (Grand Turk or sheets with dispatch data structure)
      const dispatchSheetNames = this.findDispatchSheets(workbook);
      const sheetsToProcess = dispatchSheetNames.length > 0 ? dispatchSheetNames : workbook.SheetNames;

      for (const sheetName of sheetsToProcess) {
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
        
        console.log(`Sheet: ${sheetName}, Reading headers from row ${startRow + 1}:`, columns);

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

        console.log(`Sheet: ${sheetName}, Parsed ${jsonData.length} data rows starting from row ${startRow + 2}`);
        console.log(`First few rows:`, jsonData.slice(0, 3));

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

  private findDispatchSheets(workbook: any): string[] {
    const dispatchSheetNames: string[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      // Check if this sheet contains dispatch data structure
      if (this.isDispatchSheet(workbook.Sheets[sheetName], sheetName)) {
        dispatchSheetNames.push(sheetName);
      }
    }
    
    console.log(`Found dispatch sheets: ${dispatchSheetNames.join(', ')}`);
    return dispatchSheetNames;
  }

  private isDispatchSheet(worksheet: any, sheetName: string): boolean {
    // Prioritize "Grand Turk" sheet
    if (sheetName.toLowerCase().includes('grand turk')) {
      return true;
    }
    
    // Check if row 8 contains dispatch headers
    const startRow = 7; // Row 8 (0-indexed as 7)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    if (range.e.r < startRow) {
      return false; // Sheet too small
    }
    
    const headers: string[] = [];
    for (let col = range.s.c; col <= Math.min(range.s.c + 7, range.e.c); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: startRow, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        headers.push(String(cell.v).trim().toLowerCase());
      }
    }
    
    // Check if it contains key dispatch headers
    const dispatchHeaders = ['tour name', 'departure', 'return', 'adults', 'children'];
    const foundHeaders = dispatchHeaders.filter(header => 
      headers.some(h => h.includes(header))
    );
    
    const isDispatch = foundHeaders.length >= 3; // At least 3 key headers
    console.log(`Sheet "${sheetName}" - Headers: [${headers.join(', ')}] - Is dispatch: ${isDispatch}`);
    
    return isDispatch;
  }
}
