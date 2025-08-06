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

export interface TemplateHeaderData {
  cruiseLine: string;      // B1 - Cruise Line (NEW)
  shipName: string;        // B2 - Ship Name (moved from B1)
  tourOperator: string;    // B3 - Tour Operator (moved from B2)
  shorexManager: string;   // B6 - Shorex Manager (moved from B5)
  shorexAsstManager: string; // B7 - Shorex Assistant Manager (moved from B6)
}

export interface MultipleRecordData {
  records: CellData[];
  templateHeaders?: TemplateHeaderData;
}

export class CellExtractor {
  /**
   * Extract specific cell values from a dispatch Excel file (single record - legacy)
   * Updated for new template structure: data now starts from row 9
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

    // Extract specific cells - Tour 1 data is now in row 9 (updated for new template structure)
    const cellA9 = this.getCellValue(worksheet, 'A9'); // Tour name
    const cellB9 = this.getCellValue(worksheet, 'B9'); // Departure time
    const cellK9 = this.getNumericCellValue(worksheet, 'K9'); // Adult count (Column K)
    const cellL9 = this.getNumericCellValue(worksheet, 'L9'); // Child count (Column L)
    const cellM9 = this.getNumericCellValue(worksheet, 'M9'); // Comp count (Column M)
    const cellN9_notes = this.getCellValue(worksheet, 'N9'); // Notes column (Column N)

    console.log(`→ CellExtractor: A9="${cellA9}", B9="${cellB9}", K9=${cellK9}, L9=${cellL9}, M9=${cellM9}, Notes_N9="${cellN9_notes}"`);

    return {
      cellA8: cellA9, // Map A9 to A8 field for backward compatibility
      cellB8: cellB9, // Map B9 to B8 field for backward compatibility
      cellH8: cellN9_notes, // Map notes from N9 to H8 field
      cellL8: cellK9, // Map K9 to L8 field for backward compatibility (Adult count)
      cellM8: cellL9, // Map L9 to M8 field for backward compatibility (Child count)
      cellN8: cellM9  // Map M9 to N8 field for backward compatibility (Comp count)
    };
  }

  /**
   * Extract multiple dispatch records from Excel file
   * Reads all rows with "Tour..." data starting from row 9 (updated for new template structure)
   */
  async extractMultipleRecords(filePath: string): Promise<MultipleRecordData> {
    console.log(`→ CellExtractor: *** STARTING extractMultipleRecords for ${filePath} ***`);
    console.log(`→ CellExtractor: File exists: ${fs.existsSync(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`→ CellExtractor: Loading workbook...`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    console.log(`→ CellExtractor: Processing sheet "${sheetName}"`);
    console.log(`→ CellExtractor: Available sheets: ${workbook.SheetNames.join(', ')}`);
    console.log(`→ CellExtractor: Worksheet loaded successfully`);

    console.log(`→ CellExtractor: Processing sheet "${sheetName}" for multiple records`);

    const records: CellData[] = [];
    
    // Start from row 9 and check each row for tour data (updated for new template structure)
    for (let row = 9; row <= 31; row++) { // Updated to start from row 9 and expanded range
      const cellA = this.getCellValue(worksheet, `A${row}`);
      const cellB = this.getCellValue(worksheet, `B${row}`);
      const cellK = this.getCellValue(worksheet, `K${row}`);
      const cellL = this.getCellValue(worksheet, `L${row}`);
      const cellM = this.getCellValue(worksheet, `M${row}`);
      const cellN = this.getCellValue(worksheet, `N${row}`);
      
      console.log(`→ CellExtractor: Checking row ${row} - A="${cellA}", B="${cellB}", K="${cellK}", L="${cellL}", M="${cellM}", N="${cellN}"`);
      
      // Check if this row contains tour data (starts with "Tour" or has significant data)
      if (cellA && (cellA.toLowerCase().startsWith('tour') || cellA.trim().length > 0)) {
        console.log(`→ CellExtractor: Found tour record at row ${row}: "${cellA}"`);
        console.log(`→ CellExtractor: Row ${row} - A="${cellA}", B="${cellB}"`);
        
        // Get numeric values for guest counts
        const adultCount = this.getNumericCellValue(worksheet, `K${row}`); // Adult count (Column K)
        const childCount = this.getNumericCellValue(worksheet, `L${row}`); // Child count (Column L)
        const compCount = this.getNumericCellValue(worksheet, `M${row}`); // Comp count (Column M)
        const notesValue = cellN || ''; // Notes are in column N
        
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
    
    // Extract template header data
    const templateHeaders = this.extractTemplateHeaders(worksheet);
    console.log(`→ CellExtractor: Template headers - Ship: "${templateHeaders.shipName}", Operator: "${templateHeaders.tourOperator}", Manager: "${templateHeaders.shorexManager}", Assistant: "${templateHeaders.shorexAsstManager}"`);
    
    return { records, templateHeaders };
  }

  /**
   * Extract template header data from dispatch file
   * B1 -> Cruise Line (NEW), B2 -> Ship Name, B3 -> Tour Operator, B6 -> Shorex Manager, B7 -> Shorex Assistant Manager
   */
  private extractTemplateHeaders(worksheet: any): TemplateHeaderData {
    console.log('→ CellExtractor: Starting template header extraction...');
    
    // Debug: Check all cells in first few rows
    console.log('→ CellExtractor: Debugging first 10 rows...');
    for (let row = 1; row <= 10; row++) {
      for (let col of ['A', 'B', 'C']) {
        const cellAddress = `${col}${row}`;
        const cellValue = this.getCellValue(worksheet, cellAddress);
        if (cellValue) {
          console.log(`→ CellExtractor: ${cellAddress} = "${cellValue}"`);
        }
      }
    }
    
    const cruiseLine = this.getCellValue(worksheet, 'B1');     // NEW - Cruise Line
    const shipName = this.getCellValue(worksheet, 'B2');       // Moved from B1
    const tourOperator = this.getCellValue(worksheet, 'B3');   // Moved from B2
    const shorexManager = this.getCellValue(worksheet, 'B6');  // Moved from B5
    const shorexAsstManager = this.getCellValue(worksheet, 'B7'); // Moved from B6
    
    console.log(`→ CellExtractor: Extracted template headers - B1(Cruise Line): "${cruiseLine}", B2(Ship): "${shipName}", B3(Operator): "${tourOperator}", B6(Manager): "${shorexManager}", B7(Assistant): "${shorexAsstManager}"`);
    
    return {
      cruiseLine,
      shipName,
      tourOperator,
      shorexManager,
      shorexAsstManager
    };
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