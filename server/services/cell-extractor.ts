import XLSX from "xlsx";
import fs from "fs";

export interface CellData {
  cellA8: string;  // Tour name
  cellB8: string;  // Departure time  
  cellH8: string;  // Notes
  cellL8: number;  // Adult count (Column L)
  cellM8: number;  // Child count (Column M)
  cellN8: number;  // Comp count (Column N)
}

export interface MultipleRecordData {
  records: CellData[];
}

export class CellExtractor {
  /**
   * Extract specific cell values from a dispatch Excel file (single record - legacy)
   */
  async extractCells(filePath: string): Promise<CellData> {
    console.log(`→ CellExtractor: Reading file ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    console.log(`→ CellExtractor: Processing sheet "${sheetName}"`);

    // Extract specific cells - Tour 1 data is in row 8
    const cellA8 = this.getCellValue(worksheet, 'A8'); // Tour name
    const cellB8 = this.getCellValue(worksheet, 'B8'); // Departure time
    const cellL8 = this.getNumericCellValue(worksheet, 'L8'); // Adult count
    const cellM8 = this.getNumericCellValue(worksheet, 'M8'); // Child count
    const cellN8 = this.getNumericCellValue(worksheet, 'N8'); // Comp count
    const cellO8 = this.getCellValue(worksheet, 'O8'); // Notes column (column O is "Incident, accident, cancellation etc.")

    console.log(`→ CellExtractor: A8="${cellA8}", B8="${cellB8}", L8=${cellL8}, M8=${cellM8}, N8=${cellN8}, O8="${cellO8}"`);

    return {
      cellA8,
      cellB8,
      cellH8: cellO8, // Map notes from O8 to H8 field
      cellL8,
      cellM8,
      cellN8
    };
  }

  /**
   * Extract multiple dispatch records from Excel file
   * Reads all rows with "Tour..." data starting from row 8
   */
  async extractMultipleRecords(filePath: string): Promise<MultipleRecordData> {
    console.log(`→ CellExtractor: Reading multiple records from ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    console.log(`→ CellExtractor: Processing sheet "${sheetName}" for multiple records`);

    const records: CellData[] = [];
    
    // Start from row 8 and check each row for tour data
    for (let row = 8; row <= 30; row++) { // Expanded range to capture more tours
      const cellA = this.getCellValue(worksheet, `A${row}`);
      const cellB = this.getCellValue(worksheet, `B${row}`);
      const cellL = this.getCellValue(worksheet, `L${row}`);
      const cellM = this.getCellValue(worksheet, `M${row}`);
      const cellN = this.getCellValue(worksheet, `N${row}`);
      const cellO = this.getCellValue(worksheet, `O${row}`);
      
      console.log(`→ CellExtractor: Checking row ${row} - A="${cellA}", B="${cellB}", L="${cellL}", M="${cellM}", N="${cellN}"`);
      
      // Check if this row contains tour data (starts with "Tour" or has significant data)
      if (cellA && (cellA.toLowerCase().startsWith('tour') || cellA.trim().length > 0)) {
        console.log(`→ CellExtractor: Found tour record at row ${row}: "${cellA}"`);
        console.log(`→ CellExtractor: Row ${row} - A="${cellA}", B="${cellB}"`);
        
        // Get numeric values for guest counts
        const adultCount = this.getNumericCellValue(worksheet, `L${row}`);
        const childCount = this.getNumericCellValue(worksheet, `M${row}`);
        const compCount = this.getNumericCellValue(worksheet, `N${row}`);
        const notesValue = cellO || ''; // Notes are now in column O
        
        console.log(`→ CellExtractor: Row ${row} - Adult=${adultCount}, Child=${childCount}, Comp=${compCount}, Notes="${notesValue}"`);
        
        records.push({
          cellA8: cellA,
          cellB8: cellB,
          cellH8: notesValue,
          cellL8: adultCount,
          cellM8: childCount,
          cellN8: compCount
        });
      } else if (cellA && cellA.trim().length > 0) {
        // Log non-tour rows that have data for debugging
        console.log(`→ CellExtractor: Non-tour row ${row} with data: "${cellA}"`);
      }
    }

    console.log(`→ CellExtractor: Extracted ${records.length} tour records`);
    return { records };
  }

  private getCellValue(worksheet: any, cellAddress: string): string {
    const cell = worksheet[cellAddress];
    if (cell && cell.v !== undefined && cell.v !== null) {
      return String(cell.v).trim();
    }
    return '';
  }

  private getNumericCellValue(worksheet: any, cellAddress: string): number {
    const cell = worksheet[cellAddress];
    if (cell && cell.v !== undefined && cell.v !== null) {
      const value = Number(cell.v);
      return isNaN(value) ? 0 : value;
    }
    return 0;
  }
}

export const cellExtractor = new CellExtractor();