import ExcelJS from 'exceljs';
import path from 'path';
import { nanoid } from 'nanoid';

export interface PaxReportData {
  date: string;
  cruiseLine: string;
  shipName: string;
  records: PaxRecord[];
}

export interface PaxRecord {
  tourName: string;
  allotment: number;
  sold: number;
  paxOnBoard: number;
  paxOnTour: number;
}

export interface ValidatedPaxRecord extends PaxRecord {
  tourType: 'catamaran' | 'champagne' | 'invisible';
}

export class PaxProcessor {
  private readonly VALID_TOUR_NAMES = [
    'Catamaran Sail & Snorkel',
    'Champagne Adults Only',
    'Invisible Boat Family'
  ];

  /**
   * Process dispatch data to generate PAX report
   */
  async processDispatchToPax(dispatchFilePath: string, paxTemplatePath: string): Promise<string> {
    console.log(`→ PaxProcessor: Starting PAX report generation`);
    console.log(`→ PaxProcessor: Dispatch file: ${dispatchFilePath}`);
    console.log(`→ PaxProcessor: PAX template: ${paxTemplatePath}`);

    // Extract data from dispatch sheet
    const dispatchData = await this.extractDispatchData(dispatchFilePath);
    console.log(`→ PaxProcessor: Extracted ${dispatchData.records.length} records from dispatch`);

    // Validate and filter records
    const validatedRecords = this.validateAndMapRecords(dispatchData.records);
    console.log(`→ PaxProcessor: ${validatedRecords.length} records passed validation`);

    // Load PAX template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(paxTemplatePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('PAX template worksheet not found');
    }

    // Generate PAX report
    await this.generatePaxReport(worksheet, dispatchData, validatedRecords);

    // Save the generated report
    const outputFilename = `pax_${Date.now()}.xlsx`;
    const outputPath = path.join(process.cwd(), 'output', outputFilename);
    await workbook.xlsx.writeFile(outputPath);

    console.log(`→ PaxProcessor: PAX report saved to ${outputPath}`);
    return outputFilename;
  }

  /**
   * Extract dispatch data from Excel file
   */
  private async extractDispatchData(filePath: string): Promise<PaxReportData> {
    const workbook = new ExcelJS.Workbook();
    
    // Enable formula calculations when reading the file
    await workbook.xlsx.readFile(filePath);
    
    // Force recalculation of formulas
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('Dispatch worksheet not found');
    }

    // Extract header data (always from specific cells) with enhanced debugging
    const dateCell = worksheet.getCell('B4');
    const cruiseLineCell = worksheet.getCell('B1');
    const shipNameCell = worksheet.getCell('B2');
    
    const date = this.getCellValue(worksheet, 'B4') || '';
    const cruiseLine = this.getCellValue(worksheet, 'B1') || '';
    const shipName = this.getCellValue(worksheet, 'B2') || '';

    console.log(`→ PaxProcessor: Header DEBUG - B1 (Cruise): value="${cruiseLineCell.value}", type=${typeof cruiseLineCell.value}`);
    console.log(`→ PaxProcessor: Header DEBUG - B2 (Ship): value="${shipNameCell.value}", type=${typeof shipNameCell.value}`);
    console.log(`→ PaxProcessor: Header DEBUG - B4 (Date): value="${dateCell.value}", type=${typeof dateCell.value}`);
    console.log(`→ PaxProcessor: Header data - Date: ${date}, Cruise Line: ${cruiseLine}, Ship: ${shipName}`);

    // Extract tour records from dispatch sheet
    const records: PaxRecord[] = [];
    
    // Scan for tour data starting from row 8 (data starts here)
    for (let row = 8; row <= 200; row++) {
      const tourNameCell = worksheet.getCell(row, 1); // Column A
      const allotmentCell = worksheet.getCell(row, 8); // Column H
      const soldCell = worksheet.getCell(row, 10); // Column J
      const paxOnBoardCell = worksheet.getCell(row, 17); // Column Q
      const paxOnTourCell = worksheet.getCell(row, 18); // Column R

      // Debug every row that has a tour name for the first few rows
      if (row <= 15 && tourNameCell.value) {
        console.log(`→ PaxProcessor: DEBUG Row ${row} - Tour: "${tourNameCell.value}"`);
        console.log(`→ PaxProcessor: DEBUG - Cell Q${row} (paxOnBoard): value="${paxOnBoardCell.value}", type=${typeof paxOnBoardCell.value}`);
        console.log(`→ PaxProcessor: DEBUG - Cell R${row} (paxOnTour): value="${paxOnTourCell.value}", type=${typeof paxOnTourCell.value}`);
        
        // Enhanced debugging for formula objects
        if (paxOnBoardCell.value && typeof paxOnBoardCell.value === 'object') {
          console.log(`→ PaxProcessor: DEBUG - Q${row} object keys:`, Object.keys(paxOnBoardCell.value));
          console.log(`→ PaxProcessor: DEBUG - Q${row} full object:`, JSON.stringify(paxOnBoardCell.value));
        }
        if (paxOnTourCell.value && typeof paxOnTourCell.value === 'object') {
          console.log(`→ PaxProcessor: DEBUG - R${row} object keys:`, Object.keys(paxOnTourCell.value));
          console.log(`→ PaxProcessor: DEBUG - R${row} full object:`, JSON.stringify(paxOnTourCell.value));
        }
      }

      if (tourNameCell.value && typeof tourNameCell.value === 'string') {
        const tourName = tourNameCell.value.trim();
        
        if (tourName && tourName !== 'TOUR') { // Skip header row
          const allotment = this.extractNumericValue(allotmentCell.value);
          const sold = this.extractNumericValue(soldCell.value);
          const paxOnBoard = this.extractNumericValue(paxOnBoardCell.value);
          const paxOnTour = this.extractNumericValue(paxOnTourCell.value);

          records.push({
            tourName,
            allotment,
            sold,
            paxOnBoard,
            paxOnTour
          });

          console.log(`→ PaxProcessor: Found tour "${tourName}" - Allotment: ${allotment}, Sold: ${sold}, OnBoard: ${paxOnBoard}, OnTour: ${paxOnTour}`);
        }
      }
    }

    return {
      date,
      cruiseLine,
      shipName,
      records
    };
  }

  /**
   * Validate tour names and map to tour types
   */
  private validateAndMapRecords(records: PaxRecord[]): ValidatedPaxRecord[] {
    const validatedRecords: ValidatedPaxRecord[] = [];

    for (const record of records) {
      let tourType: 'catamaran' | 'champagne' | 'invisible' | null = null;

      if (record.tourName === 'Catamaran Sail & Snorkel') {
        tourType = 'catamaran';
      } else if (record.tourName === 'Champagne Adults Only') {
        tourType = 'champagne';
      } else if (record.tourName === 'Invisible Boat Family') {
        tourType = 'invisible';
      }

      if (tourType) {
        validatedRecords.push({
          ...record,
          tourType
        });
        console.log(`→ PaxProcessor: ✓ Validated tour "${record.tourName}" as ${tourType}`);
      } else {
        console.log(`→ PaxProcessor: ✗ Invalid tour name "${record.tourName}" - skipping`);
      }
    }

    return validatedRecords;
  }

  /**
   * Generate PAX report by populating template
   */
  private async generatePaxReport(
    worksheet: ExcelJS.Worksheet, 
    dispatchData: PaxReportData, 
    validatedRecords: ValidatedPaxRecord[]
  ): Promise<void> {
    console.log(`→ PaxProcessor: Generating PAX report with ${validatedRecords.length} validated records`);

    // Track totals for each tour type
    const tourTotals = {
      catamaran: { sold: 0, allotment: 0 },
      champagne: { sold: 0, allotment: 0 },
      invisible: { sold: 0, allotment: 0 }
    };

    let totalPaxOnBoard = 0;
    let totalPaxOnTour = 0;

    // Process each validated record
    for (const record of validatedRecords) {
      // Add to tour-specific totals
      tourTotals[record.tourType].sold += record.sold;
      tourTotals[record.tourType].allotment += record.allotment;
      
      // Add to overall totals
      totalPaxOnBoard += record.paxOnBoard;
      totalPaxOnTour += record.paxOnTour;
    }

    // Work directly with the template row (row 4) where delimiters exist
    const templateRow = 4;

    // Replace delimiters with actual data directly in template row
    this.replaceDelimiter(worksheet, templateRow, 1, '{{date}}', dispatchData.date);
    this.replaceDelimiter(worksheet, templateRow, 2, '{{cruise_line}}', dispatchData.cruiseLine);
    this.replaceDelimiter(worksheet, templateRow, 3, '{{ship_name}}', dispatchData.shipName);

    // Tour-specific data
    this.replaceDelimiter(worksheet, templateRow, 4, '{{cat_sold}}', tourTotals.catamaran.sold);
    this.replaceDelimiter(worksheet, templateRow, 5, '{{cat_allot}}', tourTotals.catamaran.allotment);
    this.replaceDelimiter(worksheet, templateRow, 6, '{{champ_sold}}', tourTotals.champagne.sold);
    this.replaceDelimiter(worksheet, templateRow, 7, '{{champ_allot}}', tourTotals.champagne.allotment);
    this.replaceDelimiter(worksheet, templateRow, 8, '{{inv_sold}}', tourTotals.invisible.sold);
    this.replaceDelimiter(worksheet, templateRow, 9, '{{inv_allot}}', tourTotals.invisible.allotment);

    // Analysis data (columns BT=72, BU=73)
    this.replaceDelimiter(worksheet, templateRow, 72, '{{pax_on_board}}', totalPaxOnBoard);
    this.replaceDelimiter(worksheet, templateRow, 73, '{{pax_on_tour}}', totalPaxOnTour);

    console.log(`→ PaxProcessor: PAX report generation completed`);
    console.log(`→ PaxProcessor: Tour totals - Catamaran: ${tourTotals.catamaran.sold}/${tourTotals.catamaran.allotment}, Champagne: ${tourTotals.champagne.sold}/${tourTotals.champagne.allotment}, Invisible: ${tourTotals.invisible.sold}/${tourTotals.invisible.allotment}`);
    console.log(`→ PaxProcessor: Overall totals - OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
  }

  /**
   * Copy row formatting from source to target
   */
  private async copyRowFormat(worksheet: ExcelJS.Worksheet, sourceRow: number, targetRow: number): Promise<void> {
    const sourceRowObj = worksheet.getRow(sourceRow);
    const targetRowObj = worksheet.getRow(targetRow);

    // Copy row height
    targetRowObj.height = sourceRowObj.height;

    // Copy each cell's format and value
    sourceRowObj.eachCell((cell, colNumber) => {
      const targetCell = targetRowObj.getCell(colNumber);
      targetCell.style = { ...cell.style };
      if (cell.value) {
        targetCell.value = cell.value;
      }
    });
  }

  /**
   * Replace delimiter in specific cell
   */
  private replaceDelimiter(worksheet: ExcelJS.Worksheet, row: number, col: number, delimiter: string, value: string | number): void {
    const cell = worksheet.getCell(row, col);
    
    if (cell.value && String(cell.value).includes(delimiter)) {
      cell.value = value;
      console.log(`→ PaxProcessor: Replaced ${delimiter} at ${cell.address} = ${value}`);
    }
  }

  /**
   * Get cell value safely with date formatting
   */
  private getCellValue(worksheet: ExcelJS.Worksheet, address: string): string {
    const cell = worksheet.getCell(address);
    if (!cell.value) return '';
    
    // Special handling for dates
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
   * Extract numeric value from cell, handling both numbers and formula objects
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

  /**
   * Add successive PAX entry to existing PAX report
   */
  async addSuccessiveEntryToPax(dispatchFilePath: string, existingPaxPath: string): Promise<string> {
    console.log(`→ PaxProcessor: Adding successive PAX entry`);
    console.log(`→ PaxProcessor: Dispatch file: ${dispatchFilePath}`);
    console.log(`→ PaxProcessor: Existing PAX: ${existingPaxPath}`);

    // Extract data from dispatch sheet
    const dispatchData = await this.extractDispatchData(dispatchFilePath);
    console.log(`→ PaxProcessor: Extracted ${dispatchData.records.length} records from dispatch`);

    // Validate and filter records
    const validatedRecords = this.validateAndMapRecords(dispatchData.records);
    console.log(`→ PaxProcessor: ${validatedRecords.length} records passed validation`);

    // Load existing PAX report
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(existingPaxPath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('Existing PAX report worksheet not found');
    }

    // Find the next available row after existing data
    const nextRow = this.findNextAvailableRow(worksheet);
    console.log(`→ PaxProcessor: Adding new data starting at row ${nextRow}`);

    // Add new records to the existing PAX report
    await this.addRecordsToExistingPax(worksheet, dispatchData, validatedRecords, nextRow);

    // Save the updated report with new timestamp
    const outputFilename = `pax_${Date.now()}.xlsx`;
    const outputPath = path.join(process.cwd(), 'output', outputFilename);
    await workbook.xlsx.writeFile(outputPath);

    console.log(`→ PaxProcessor: Updated PAX report saved to ${outputPath}`);
    return outputFilename;
  }

  /**
   * Find the next available row in the PAX report
   */
  private findNextAvailableRow(worksheet: ExcelJS.Worksheet): number {
    // Start checking from row 5 (after template row 4)
    let currentRow = 5;
    
    // Look for the first empty row by checking column A (date column)
    while (currentRow <= 1000) { // Safety limit
      const cellA = worksheet.getCell(currentRow, 1); // Column A
      if (!cellA.value || cellA.value === '') {
        return currentRow;
      }
      currentRow++;
    }
    
    // If we reach here, assume we can add at row 5 as fallback
    return 5;
  }

  /**
   * Add new records to existing PAX report
   */
  private async addRecordsToExistingPax(
    worksheet: ExcelJS.Worksheet,
    dispatchData: PaxReportData,
    validatedRecords: ValidatedPaxRecord[],
    startRow: number
  ): Promise<void> {
    console.log(`→ PaxProcessor: Adding ${validatedRecords.length} new records starting at row ${startRow}`);

    // Copy the template row (row 4) formatting to preserve styling
    const templateRow = worksheet.getRow(4);

    // Add one row for all validated records (same as original PAX logic)
    const targetRow = startRow;
    const newRow = worksheet.getRow(targetRow);

    // Copy template row formatting to new row
    templateRow.eachCell((cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);
      
      // Copy formatting
      newCell.font = cell.font;
      newCell.alignment = cell.alignment;
      newCell.border = cell.border;
      newCell.fill = cell.fill;
      newCell.numFmt = cell.numFmt;
    });

    // Set the actual data for all records in this single row
    await this.populateRowWithData(newRow, dispatchData, validatedRecords);

    // Note: ExcelJS automatically commits changes, no explicit commit needed
  }

  /**
   * Populate a row with PAX data (used for successive entries)
   */
  private async populateRowWithData(
    row: ExcelJS.Row,
    dispatchData: PaxReportData,
    validatedRecords: ValidatedPaxRecord[]
  ): Promise<void> {
    // Set direct mapping values (same for all records)
    row.getCell(1).value = dispatchData.date; // A: date
    row.getCell(2).value = dispatchData.cruiseLine; // B: cruise_line
    row.getCell(3).value = dispatchData.shipName; // C: ship_name

    // Calculate totals for this set of records
    const totalPaxOnBoard = validatedRecords.reduce((sum, record) => sum + record.paxOnBoard, 0);
    const totalPaxOnTour = validatedRecords.reduce((sum, record) => sum + record.paxOnTour, 0);

    // Set conditional column mappings based on tour types
    validatedRecords.forEach(record => {
      switch (record.tourType) {
        case 'catamaran':
          row.getCell(4).value = record.sold; // D: cat_sold
          row.getCell(5).value = record.allotment; // E: cat_allot
          break;
        case 'champagne':
          row.getCell(6).value = record.sold; // F: champ_sold
          row.getCell(7).value = record.allotment; // G: champ_allot
          break;
        case 'invisible':
          row.getCell(8).value = record.sold; // H: inv_sold
          row.getCell(9).value = record.allotment; // I: inv_allot
          break;
      }
    });

    // Set universal record mappings
    row.getCell(72).value = totalPaxOnBoard; // BT: pax_on_board
    row.getCell(73).value = totalPaxOnTour; // BU: pax_on_tour

    console.log(`→ PaxProcessor: Added row with totals - OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
  }
}