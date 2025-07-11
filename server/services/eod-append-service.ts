import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { cellExtractor } from "./cell-extractor";
import { storage } from "../storage";

export class EODAppendService {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Append new formatted records to an existing EOD report
   * This function loads the existing EOD report, finds the insertion point,
   * and adds new tour records with proper formatting
   */
  async appendToExistingEODReport(
    existingEODPath: string,
    newDispatchFilePath: string,
    outputPath: string
  ): Promise<{ success: boolean; recordsAdded: number; message: string }> {
    try {
      console.log(`→ EODAppend: Loading existing EOD report from: ${existingEODPath}`);
      console.log(`→ EODAppend: Reading new dispatch records from: ${newDispatchFilePath}`);

      // Load existing EOD report
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(existingEODPath);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        throw new Error('Could not find worksheet in existing EOD report');
      }

      // Extract new dispatch records
      const newRecords = await cellExtractor.extractMultipleRecords(newDispatchFilePath);
      
      if (newRecords.records.length === 0) {
        return {
          success: false,
          recordsAdded: 0,
          message: 'No new records found in dispatch file'
        };
      }

      console.log(`→ EODAppend: Found ${newRecords.records.length} new records to append`);

      // Find the insertion point (look for "Additional notes" or totals section)
      let insertionRow = this.findInsertionPoint(worksheet);
      
      if (insertionRow === -1) {
        // If no totals section found, append at the end
        insertionRow = worksheet.rowCount + 1;
      }

      console.log(`→ EODAppend: Inserting new records starting at row ${insertionRow}`);

      // Get existing totals before adding new records
      const existingTotals = this.extractExistingTotals(worksheet);
      
      // Insert new tour records
      await this.insertTourRecords(worksheet, newRecords.records, insertionRow);

      // Update totals with new records
      const newTotals = this.calculateNewTotals(existingTotals, newRecords.records);
      await this.updateTotalsSection(worksheet, newTotals, insertionRow + (newRecords.records.length * 17));

      // Save the updated report
      await workbook.xlsx.writeFile(outputPath);

      console.log(`→ EODAppend: Successfully appended ${newRecords.records.length} records to ${outputPath}`);

      return {
        success: true,
        recordsAdded: newRecords.records.length,
        message: `Successfully appended ${newRecords.records.length} records to EOD report`
      };

    } catch (error) {
      console.error('→ EODAppend: Error appending to EOD report:', error);
      return {
        success: false,
        recordsAdded: 0,
        message: `Failed to append records: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find the insertion point for new records in the existing EOD report
   */
  private findInsertionPoint(worksheet: ExcelJS.Worksheet): number {
    console.log('→ EODAppend: Looking for totals section in existing report');
    
    // Search for "Additional notes" or similar headings to find totals section
    let insertionRow = -1;
    
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (cell.value) {
          const cellValue = String(cell.value).toLowerCase();
          if (cellValue.includes('additional notes') || 
              cellValue.includes('total') || 
              cellValue.includes('summary')) {
            insertionRow = rowNumber;
            console.log(`→ EODAppend: Found "${cellValue}" heading at row ${rowNumber}`);
            return false; // Stop iteration
          }
        }
      });
      
      if (insertionRow !== -1) {
        return false; // Stop row iteration
      }
    });

    return insertionRow;
  }

  /**
   * Extract existing totals from the EOD report
   */
  private extractExistingTotals(worksheet: ExcelJS.Worksheet): { adults: number; children: number; comp: number } {
    let existingTotals = { adults: 0, children: 0, comp: 0 };
    
    // Search for existing totals in the report
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value && typeof cell.value === 'number') {
          // Look for cells that might contain totals
          const cellRef = worksheet.getCell(rowNumber, colNumber);
          const cellFormula = cellRef.formula;
          
          if (cellFormula && cellFormula.includes('SUM')) {
            // This is likely a total cell
            const value = Number(cell.value) || 0;
            
            // Based on column position, assign to appropriate total
            if (colNumber === 3) { // Column C - Adults
              existingTotals.adults = value;
            } else if (colNumber === 4) { // Column D - Children
              existingTotals.children = value;
            } else if (colNumber === 5) { // Column E - Comp
              existingTotals.comp = value;
            }
          }
        }
      });
    });

    console.log('→ EODAppend: Existing totals -', existingTotals);
    return existingTotals;
  }

  /**
   * Insert tour records with proper formatting
   */
  private async insertTourRecords(
    worksheet: ExcelJS.Worksheet, 
    records: any[], 
    insertionRow: number
  ): Promise<void> {
    console.log(`→ EODAppend: Inserting ${records.length} tour records starting at row ${insertionRow}`);
    
    // Store template section for replication (assuming rows 23-38 are the template)
    const templateRows = this.extractTemplateSection(worksheet, 23, 38);
    
    records.forEach((record, index) => {
      const recordStartRow = insertionRow + (index * 17); // 17 rows per tour section
      
      console.log(`→ EODAppend: Adding record ${index + 1}: "${record.cellA8}" starting at row ${recordStartRow}`);
      
      // Insert template rows for this record
      this.insertTemplateSection(worksheet, templateRows, recordStartRow);
      
      // Apply data replacements
      this.applyDataReplacements(worksheet, record, recordStartRow);
      
      // Add formatting borders
      this.addTourSectionBorders(worksheet, recordStartRow);
    });
  }

  /**
   * Extract template section for replication
   */
  private extractTemplateSection(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number): any[] {
    const templateRows = [];
    
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: any = { cells: [] };
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowData.cells[colNumber] = {
          value: cell.value,
          style: { ...cell.style },
          formula: cell.formula
        };
      });
      
      templateRows.push(rowData);
    }
    
    return templateRows;
  }

  /**
   * Insert template section at specified row
   */
  private insertTemplateSection(worksheet: ExcelJS.Worksheet, templateRows: any[], startRow: number): void {
    templateRows.forEach((templateRow, index) => {
      const targetRow = worksheet.getRow(startRow + index);
      
      templateRow.cells.forEach((cellData: any, colNumber: number) => {
        if (cellData && colNumber > 0) {
          const cell = targetRow.getCell(colNumber);
          cell.value = cellData.value;
          
          // Apply styling
          if (cellData.style) {
            cell.style = { ...cellData.style };
          }
          
          // Apply formula if present
          if (cellData.formula) {
            cell.formula = cellData.formula;
          }
        }
      });
    });
  }

  /**
   * Apply data replacements for delimiters
   */
  private applyDataReplacements(worksheet: ExcelJS.Worksheet, record: any, startRow: number): void {
    // Replace {{tour_name}} delimiter
    for (let rowOffset = 0; rowOffset < 16; rowOffset++) {
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(startRow + rowOffset, col);
        
        if (cell.value && String(cell.value).includes('{{tour_name}}')) {
          cell.value = record.cellA8;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
        if (cell.value && String(cell.value).includes('{{notes}}')) {
          cell.value = record.cellH8;
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        }
        
        if (cell.value && String(cell.value).includes('{{departure_time}}')) {
          cell.value = record.cellB8;
        }
      }
    }
    
    // Replace guest count delimiters
    const adultCountCell = worksheet.getCell(startRow + 2, 3);
    if (adultCountCell.value && String(adultCountCell.value).includes('{{num_adult}}')) {
      adultCountCell.value = record.cellL8 || 0;
    }
    
    const childCountCell = worksheet.getCell(startRow + 2, 4);
    if (childCountCell.value && String(childCountCell.value).includes('{{num_chd}}')) {
      childCountCell.value = record.cellM8 || 0;
    }
    
    const compCountCell = worksheet.getCell(startRow + 2, 5);
    if (compCountCell.value && String(compCountCell.value).includes('{{num_comp}}')) {
      compCountCell.value = record.cellN8 || 0;
    }
  }

  /**
   * Add borders to tour section
   */
  private addTourSectionBorders(worksheet: ExcelJS.Worksheet, startRow: number): void {
    // Add thick black right border to column H for tour section
    for (let rowOffset = 0; rowOffset < 16; rowOffset++) {
      const cell = worksheet.getCell(startRow + rowOffset, 8); // Column H
      cell.border = {
        ...cell.border,
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };
    }
  }

  /**
   * Calculate new totals including existing and new records
   */
  private calculateNewTotals(existingTotals: any, newRecords: any[]): any {
    const newTotals = { ...existingTotals };
    
    newRecords.forEach(record => {
      newTotals.adults += record.cellL8 || 0;
      newTotals.children += record.cellM8 || 0;
      newTotals.comp += record.cellN8 || 0;
    });
    
    console.log('→ EODAppend: New totals -', newTotals);
    return newTotals;
  }

  /**
   * Update totals section with new values
   */
  private async updateTotalsSection(worksheet: ExcelJS.Worksheet, totals: any, totalsRow: number): Promise<void> {
    // Update total cells (assuming standard positions)
    const totalAdultsCell = worksheet.getCell(totalsRow, 3); // Column C
    const totalChildrenCell = worksheet.getCell(totalsRow, 4); // Column D
    const totalCompCell = worksheet.getCell(totalsRow, 5); // Column E
    
    totalAdultsCell.value = totals.adults;
    totalChildrenCell.value = totals.children;
    totalCompCell.value = totals.comp;
    
    // Update SUM formula if present
    const sumFormulaCell = worksheet.getCell(totalsRow, 6); // Column F
    if (sumFormulaCell.formula) {
      sumFormulaCell.formula = `SUM(C${totalsRow}:E${totalsRow})`;
    }
    
    console.log(`→ EODAppend: Updated totals at row ${totalsRow}`);
  }

  /**
   * Get the latest EOD report file path
   */
  async getLatestEODReportPath(): Promise<string | null> {
    try {
      const files = fs.readdirSync(this.outputDir)
        .filter(file => file.startsWith('eod_') && file.endsWith('.xlsx'))
        .map(file => ({
          name: file,
          path: path.join(this.outputDir, file),
          stats: fs.statSync(path.join(this.outputDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      console.error('→ EODAppend: Error getting latest EOD report:', error);
      return null;
    }
  }
}

export const eodAppendService = new EODAppendService();