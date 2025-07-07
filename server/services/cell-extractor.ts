import XLSX from "xlsx";
import fs from "fs";

export interface CellData {
  cellA8: string;  // Tour name
  cellB8: string;  // Departure time  
  cellH8: string;  // Notes
}

export class CellExtractor {
  /**
   * Extract specific cell values from a dispatch Excel file
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

  private getCellValue(worksheet: any, cellAddress: string): string {
    const cell = worksheet[cellAddress];
    if (cell && cell.v !== undefined && cell.v !== null) {
      return String(cell.v).trim();
    }
    return '';
  }
}

export const cellExtractor = new CellExtractor();