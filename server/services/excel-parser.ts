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

      // Determine if this is an edited dispatch file vs original template
      const isEditedDispatch = filePath.includes('edited_dispatch_');
      console.log(`Parsing file: ${filePath}, isEditedDispatch: ${isEditedDispatch}`);

      // Find the dispatch sheet (Grand Turk or sheets with dispatch data structure)
      const dispatchSheetNames = this.findDispatchSheets(workbook);
      const sheetsToProcess = dispatchSheetNames.length > 0 ? dispatchSheetNames : workbook.SheetNames;

      for (const sheetName of sheetsToProcess) {
        const worksheet = workbook.Sheets[sheetName];
        
        // For edited dispatch files, headers are in row 1 (0-indexed as 0)
        // For original templates, headers are in row 6 (0-indexed as 5)
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headerRow = isEditedDispatch ? 0 : 5; // Row 6 contains headers
        // For edited files, read all rows after header. For templates, read specific dispatch rows
        let dataRows: number[];
        if (isEditedDispatch) {
          // Read all rows from row 2 onwards (after header in row 1)
          dataRows = [];
          for (let r = 1; r <= range.e.r; r++) {
            dataRows.push(r);
          }
        } else {
          // Read specific dispatch rows: 8, 13, 17, 19, 23 (0-indexed: 7, 12, 16, 18, 22)
          dataRows = [7, 12, 16, 18, 22];
        }
        
        console.log(`Processing sheet: ${sheetName}, headerRow: ${headerRow + 1}, dataRows: [${dataRows.map(r => r + 1).join(', ')}] (${isEditedDispatch ? 'edited file' : 'template'})`);
        
        // Get column headers from the header row
        const columns: string[] = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            columns.push(String(cell.v).trim());
          } else {
            // If no value, use column letter as placeholder
            columns.push(`Column${col + 1}`);
          }
        }
        
        console.log(`Sheet: ${sheetName}, Reading headers from row ${headerRow + 1}:`, columns);

        // Parse data only from specific dispatch rows
        const jsonData: Record<string, any>[] = [];
        
        console.log(`Parsing data from specific rows: [${dataRows.map(r => r + 1).join(', ')}]`);
        
        for (const row of dataRows) {
          // Skip if row is beyond the sheet range
          if (row > range.e.r) continue;
          
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
            console.log(`Row ${row + 1} data:`, rowData);
            jsonData.push(rowData);
          }
        }

        console.log(`Sheet: ${sheetName}, Parsed ${jsonData.length} dispatch data rows`);
        console.log(`All parsed data:`, jsonData);

        sheets.push({
          name: sheetName,
          data: jsonData,
          columns: columns,
        });
      }

      return { sheets };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}