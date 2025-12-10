import ExcelJS from "exceljs";
import fs from "fs";
import { blobStorage } from "./blob-storage.js";

export interface CellData {
  cellA8: string;  // Tour name
  cellB8: string;  // Departure time  
  cellH8: string;  // Notes
  cellL8: number;  // Adult count (Column L)
  cellM8: number;  // Child count (Column M)
  cellN8: number;  // Comp count (Column N)
}

export interface TemplateHeaderData {
  country?: string;        // B1 - Country (optional, matches PAX structure)
  cruiseLine: string;      // B2 - Cruise Line (matches PAX structure)
  shipName: string;        // B3 - Ship Name (matches PAX structure)
  port?: string;           // E3 - Port (optional, matches PAX structure)
  date: string;            // B5 - Date (NEW - was missing!)
  tourOperator: string;    // B3 or separate - Tour Operator (EOD-specific)
  shorexManager: string;   // B6 - Shorex Manager (EOD-specific)
  shorexAsstManager: string; // B7 - Shorex Assistant Manager (EOD-specific)
}

export interface MultipleRecordData {
  records: CellData[];
  templateHeaders?: TemplateHeaderData;
}

export class CellExtractor {
  /**
   * Extract specific cell values from a dispatch Excel file (single record - legacy)
   * Updated to use ExcelJS for proper formula and date handling
   */
  async extractCells(filePath: string): Promise<CellData> {
    console.log(`→ CellExtractor: Reading file ${filePath}`);
    
    const workbook = new ExcelJS.Workbook();
    
    if (blobStorage.isBlobUrl(filePath)) {
      await workbook.xlsx.load(await blobStorage.downloadFile(filePath));
    } else {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      await workbook.xlsx.readFile(filePath);
    }
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Dispatch worksheet not found');
    }

    console.log(`→ CellExtractor: Processing worksheet`);

    // Extract specific cells - Tour 1 data is now in row 10 (0-indexed: row 10 = row 10 in Excel)
    // Based on PAX processor, data starts at row 8, but EOD was using row 9
    // Let's check row 10 first (which is row 10 in Excel, 1-indexed)
    // Actually, let's check both row 9 and row 10 to be safe
    const cellA10 = this.getCellValue(worksheet, 'A10'); // Tour name
    const cellB10 = this.getCellValue(worksheet, 'B10'); // Departure time
    const cellK10 = this.extractNumericValue(worksheet.getCell('K10').value); // Adult count (Column K)
    const cellL10 = this.extractNumericValue(worksheet.getCell('L10').value); // Child count (Column L)
    const cellM10 = this.extractNumericValue(worksheet.getCell('M10').value); // Comp count (Column M)
    const cellN10_notes = this.getCellValue(worksheet, 'N10'); // Notes column (Column N)

    console.log(`→ CellExtractor: A10="${cellA10}", B10="${cellB10}", K10=${cellK10}, L10=${cellL10}, M10=${cellM10}, Notes_N10="${cellN10_notes}"`);

    return {
      cellA8: cellA10, // Map A10 to A8 field for backward compatibility
      cellB8: cellB10, // Map B10 to B8 field for backward compatibility
      cellH8: cellN10_notes, // Map notes from N10 to H8 field
      cellL8: cellK10, // Map K10 to L8 field for backward compatibility (Adult count)
      cellM8: cellL10, // Map L10 to M8 field for backward compatibility (Child count)
      cellN8: cellM10  // Map M10 to N8 field for backward compatibility (Comp count)
    };
  }

  /**
   * Extract multiple dispatch records from Excel file
   * Updated to use ExcelJS for proper formula and date handling
   * Reads tour data starting from row 8 (matches PAX processor structure)
   */
  async extractMultipleRecords(filePath: string): Promise<MultipleRecordData> {
    console.log(`→ CellExtractor: *** STARTING extractMultipleRecords for ${filePath} ***`);
    
    const workbook = new ExcelJS.Workbook();
    
    if (blobStorage.isBlobUrl(filePath)) {
      console.log(`→ CellExtractor: Loading workbook from blob...`);
      await workbook.xlsx.load(await blobStorage.downloadFile(filePath));
    } else {
      console.log(`→ CellExtractor: File exists: ${fs.existsSync(filePath)}`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      console.log(`→ CellExtractor: Loading workbook...`);
      await workbook.xlsx.readFile(filePath);
    }
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Dispatch worksheet not found');
    }
    
    console.log(`→ CellExtractor: Processing worksheet for multiple records`);

    const records: CellData[] = [];
    
    // Start from row 8 (matches PAX processor) and check each row for tour data
    // PAX processor scans from row 8 to 200, we'll do the same
    for (let row = 10; row <= 44; row++) {
      const tourNameCell = worksheet.getCell(row, 1); // Column A
      const departureCell = worksheet.getCell(row, 2); // Column B
      const adultCell = worksheet.getCell(row, 11); // Column K
      const childCell = worksheet.getCell(row, 12); // Column L
      const compCell = worksheet.getCell(row, 13); // Column M
      const notesCell = worksheet.getCell(row, 14); // Column N
      
      // Check if this row contains tour data
      if (tourNameCell.value && typeof tourNameCell.value === 'string') {
        const tourName = tourNameCell.value.trim();
        
        // Skip header rows and empty rows
        if (tourName && tourName !== 'TOUR' && tourName.toLowerCase() !== 'tour name') {
          const departureTime = this.getCellValue(worksheet, `B${row}`);
          const adultCount = this.extractNumericValue(adultCell.value);
          const childCount = this.extractNumericValue(childCell.value);
          const compCount = this.extractNumericValue(compCell.value);
          const notesValue = this.getCellValue(worksheet, `N${row}`);
          
          console.log(`→ CellExtractor: Found tour record at row ${row}: "${tourName}"`);
          console.log(`→ CellExtractor: Row ${row} - Departure="${departureTime}", Adult=${adultCount}, Child=${childCount}, Comp=${compCount}, Notes="${notesValue}"`);
          
          records.push({
            cellA8: tourName,
            cellB8: departureTime,
            cellH8: notesValue,
            cellL8: adultCount,
            cellM8: childCount,
            cellN8: compCount
          });
        }
      }
    }

    console.log(`→ CellExtractor: Extracted ${records.length} tour records`);
    
    // Extract template header data
    const templateHeaders = await this.extractTemplateHeaders(worksheet);
    console.log(`→ CellExtractor: Template headers - Date: "${templateHeaders.date}", Ship: "${templateHeaders.shipName}", Cruise: "${templateHeaders.cruiseLine}", Operator: "${templateHeaders.tourOperator}"`);
    
    return { records, templateHeaders };
  }

  /**
   * Extract template header data from dispatch file
   * Matches PAX processor structure: B1=Country, B2=Cruise Line, B3=Ship Name, B5=Date
   * Also extracts EOD-specific fields: Tour Operator, Shorex Manager, Assistant Manager
   */
  private async extractTemplateHeaders(worksheet: ExcelJS.Worksheet): Promise<TemplateHeaderData> {
    console.log('→ CellExtractor: Starting template header extraction...');
    
    // Debug: Check all cells in first few rows (matching PAX processor approach)
    console.log('→ CellExtractor: Debugging header cells...');
    const countryCell = worksheet.getCell('B1');
    const cruiseLineCell = worksheet.getCell('B2');
    const shipNameCell = worksheet.getCell('B3');
    const portCell = worksheet.getCell('E3');
    const dateCell = worksheet.getCell('B5');
    const tourOperatorCell = worksheet.getCell('B4'); // Check B4 for tour operator (or might be in B3)
    const shorexManagerCell = worksheet.getCell('B6');
    const shorexAsstManagerCell = worksheet.getCell('B7');
    
    // Extract values using proper date and formula handling
    const country = this.getCellValue(worksheet, 'B1') || '';      // B1: Country (matches PAX)
    const cruiseLine = this.getCellValue(worksheet, 'B2') || '';   // B2: Cruise Line (matches PAX)
    const shipName = this.getCellValue(worksheet, 'B3') || '';     // B3: Ship Name (matches PAX)
    const port = this.getCellValue(worksheet, 'E3') || '';         // E3: Port (matches PAX)
    const date = this.getCellValue(worksheet, 'B5') || '';         // B5: Date (NEW - was missing!)
    
    // EOD-specific fields - check multiple possible locations
    // Tour operator might be in B4 or might be the same as B3 depending on template version
    let tourOperator = this.getCellValue(worksheet, 'B4') || '';   // B4 might be tour operator
    if (!tourOperator) {
      // Fallback: some templates might have tour operator in a different location
      // Check B3 but only if ship name is not there (to avoid conflicts)
      const b3Value = this.getCellValue(worksheet, 'B3');
      if (b3Value && b3Value !== shipName) {
        tourOperator = b3Value;
      }
    }
    const shorexManager = this.getCellValue(worksheet, 'B6') || '';  // B6: Shorex Manager
    const shorexAsstManager = this.getCellValue(worksheet, 'B7') || ''; // B7: Shorex Assistant Manager
    
    console.log(`→ CellExtractor: Header DEBUG - B1 (Country): value="${countryCell.value}", type=${typeof countryCell.value}`);
    console.log(`→ CellExtractor: Header DEBUG - B2 (Cruise): value="${cruiseLineCell.value}", type=${typeof cruiseLineCell.value}`);
    console.log(`→ CellExtractor: Header DEBUG - B3 (Ship): value="${shipNameCell.value}", type=${typeof shipNameCell.value}`);
    console.log(`→ CellExtractor: Header DEBUG - E3 (Port): value="${portCell.value}", type=${typeof portCell.value}`);
    console.log(`→ CellExtractor: Header DEBUG - B5 (Date): value="${dateCell.value}", type=${typeof dateCell.value}`);
    console.log(`→ CellExtractor: Extracted headers - Country: "${country}", Cruise: "${cruiseLine}", Ship: "${shipName}", Port: "${port}", Date: "${date}", Operator: "${tourOperator}"`);
    
    return {
      country: country || undefined,
      cruiseLine,
      shipName,
      port: port || undefined,
      date, // NEW - this was missing!
      tourOperator,
      shorexManager,
      shorexAsstManager
    };
  }

  /**
   * Get cell value safely with date formatting (matches PAX processor)
   */
  private getCellValue(worksheet: ExcelJS.Worksheet, address: string): string {
    const cell = worksheet.getCell(address);
    if (!cell.value) return '';
    
    // Special handling for dates (matches PAX processor)
    if (cell.value instanceof Date) {
      // Format as DD/MM/YYYY
      const day = cell.value.getDate().toString().padStart(2, '0');
      const month = (cell.value.getMonth() + 1).toString().padStart(2, '0');
      const year = cell.value.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    // Handle Excel serial date numbers (if date comes as number)
    if (typeof cell.value === 'number' && cell.value > 1 && cell.value < 100000) {
      // Excel date serial numbers start from 1900-01-01
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (cell.value - 1) * 24 * 60 * 60 * 1000);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return String(cell.value);
  }

  /**
   * Extract numeric value from cell, handling both numbers and formula objects (matches PAX processor)
   */
  private extractNumericValue(cellValue: any): number {
    if (typeof cellValue === 'number') {
      return cellValue;
    }
    
    if (cellValue && typeof cellValue === 'object') {
      // Handle formula objects with result property (common in Excel formulas)
      if ('result' in cellValue && typeof cellValue.result === 'number') {
        return cellValue.result;
      }
      
      // Handle other object types that might contain numeric values
      if ('value' in cellValue && typeof cellValue.value === 'number') {
        return cellValue.value;
      }
      
      // Handle ExcelJS rich value objects
      if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
        const text = cellValue.richText.map((part: any) => part.text || '').join('');
        const parsed = Number(text);
        return isNaN(parsed) ? 0 : parsed;
      }
      
      // Handle objects with formula and result properties
      if ('formula' in cellValue && 'result' in cellValue) {
        if (typeof cellValue.result === 'number') {
          return cellValue.result;
        }
      }
      
      // Try to get any numeric property from the object
      for (const prop of ['calculatedValue', 'value', 'number', 'val']) {
        if (prop in cellValue && typeof cellValue[prop] === 'number') {
          return cellValue[prop];
        }
      }
    }
    
    // Try to parse as number if it's a string
    if (typeof cellValue === 'string') {
      const parsed = Number(cellValue);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }
}

export const cellExtractor = new CellExtractor();