import XLSX from "xlsx";
import fs from "fs";

export interface CellData {
  cellA8: string;  // Tour name
  cellB8: string;  // Departure time  
  cellH8: string;  // Notes
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
    const cellL8 = this.getCellValue(worksheet, 'L8'); // Notes column (column L is "Incident, accident, cancellation etc.")

    console.log(`→ CellExtractor: A8="${cellA8}", B8="${cellB8}", L8="${cellL8}"`);

    return {
      cellA8,
      cellB8,
      cellH8: cellL8 // Map notes from L8 to H8 field
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
    
    // Start from row 8 and check each row for "Tour..." data
    for (let row = 8; row <= 20; row++) { // Reasonable limit to avoid infinite loop
      const cellA = this.getCellValue(worksheet, `A${row}`);
      const cellB = this.getCellValue(worksheet, `B${row}`);
      const cellL = this.getCellValue(worksheet, `L${row}`);
      
      // Check if this row contains tour data (starts with "Tour")
      if (cellA && cellA.toLowerCase().startsWith('tour')) {
        console.log(`→ CellExtractor: Found tour record at row ${row}: "${cellA}"`);
        
        records.push({
          cellA8: cellA,
          cellB8: cellB,
          cellH8: cellL
        });
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
}

export const cellExtractor = new CellExtractor();