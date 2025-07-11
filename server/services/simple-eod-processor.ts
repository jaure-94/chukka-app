import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { cellExtractor } from "./cell-extractor";
import { storage } from "../storage";

export class SimpleEODProcessor {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Process multiple dispatch records - simple approach
   */
  async processMultipleRecords(
    dispatchFilePath: string,
    eodTemplatePath: string,
    dispatchFileId: number
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Starting processMultipleRecords');
      
      // Extract data from dispatch file
      const multipleData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      if (!multipleData || !multipleData.records || multipleData.records.length === 0) {
        throw new Error('No tour records found in dispatch file');
      }
      
      console.log(`→ SimpleEOD: Found ${multipleData.records.length} tour records to process`);

      // Create new EOD report from original template
      console.log('→ SimpleEOD: Creating new EOD report from original template');
      
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(eodTemplatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in EOD template');
      }
      
      // Process tours normally
      await this.processToursInNewTemplate(worksheet, multipleData.records);
      
      // Save the workbook
      const outputPath = path.join(this.outputDir, `eod_${Date.now()}.xlsx`);
      await workbook.xlsx.writeFile(outputPath);
      
      console.log(`→ SimpleEOD: Generated EOD report: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('→ SimpleEOD: Error processing multiple records:', error);
      throw error;
    }
  }

  /**
   * Process tours in a new template (normal processing)
   */
  private async processToursInNewTemplate(worksheet: ExcelJS.Worksheet, tours: any[]): Promise<void> {
    try {
      // Store template sections separately: individual tour template (23-38) and totals section (41-44)
      const tourTemplateRows = [];
      const totalsTemplateRows = [];
      const templateMergedCells = [];
      
      // Store merged cells for tour template section (23-38)
      worksheet.model.merges.forEach(merge => {
        const mergeStart = worksheet.getCell(merge).row;
        const mergeEnd = worksheet.getCell(merge.split(':')[1]).row;
        if (mergeStart >= 23 && mergeEnd <= 38) {
          templateMergedCells.push(merge);
        }
      });
      
      // Store individual tour template (rows 23-38)
      for (let rowNum = 23; rowNum <= 38; rowNum++) {
        const row = worksheet.getRow(rowNum);
        tourTemplateRows.push(this.copyRowData(row));
      }
      
      // Store totals section template (rows 41-44)  
      for (let rowNum = 41; rowNum <= 44; rowNum++) {
        const row = worksheet.getRow(rowNum);
        totalsTemplateRows.push(this.copyRowData(row));
      }
      
      console.log('→ SimpleEOD: Tour template (rows 23-38) and totals template (rows 41-44) stored separately');
      
      // Process each record using tour template only
      for (let recordIndex = 0; recordIndex < tours.length; recordIndex++) {
        const record = tours[recordIndex];
        const startRow = 23 + (recordIndex * 17); // Each record takes 17 rows (16 for tour template + 1 blank)
        
        console.log(`→ SimpleEOD: Processing record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Insert tour template rows for this record
        if (recordIndex > 0) {
          // Insert new rows for this record
          worksheet.spliceRows(startRow, 0, 17); // Insert 17 empty rows (16 for tour template + 1 blank)
          
          // Copy tour template data to new rows
          for (let i = 0; i < tourTemplateRows.length; i++) {
            const templateRow = tourTemplateRows[i];
            const newRow = worksheet.getRow(startRow + i);
            
            // Copy each cell from template
            templateRow.forEach((cellData: any, colIndex: number) => {
              if (cellData && colIndex > 0) {
                const cell = newRow.getCell(colIndex);
                cell.value = cellData.value;
                cell.style = cellData.style;
              }
            });
          }
          
          // Add blank row at the end (row 16 + 1 = 17th row is blank)
          const blankRow = worksheet.getRow(startRow + tourTemplateRows.length);
          blankRow.height = 20; // Set a default height for the blank row
          
          // Copy merged cells for this record (safely)
          templateMergedCells.forEach(mergeRange => {
            const [startCell, endCell] = mergeRange.split(':');
            const startRowTemplate = parseInt(startCell.match(/\d+/)[0]);
            const endRowTemplate = parseInt(endCell.match(/\d+/)[0]);
            
            // Calculate offset for new record
            const rowOffset = recordIndex * 17;
            
            const newMergeRange = mergeRange.replace(/\d+/g, (match) => {
              const rowNum = parseInt(match);
              return (rowNum + rowOffset).toString();
            });
            
            this.safeMergeCells(worksheet, newMergeRange);
          });
        }
        
        // Apply delimiter replacements for this record (tour template only)
        this.applyDelimiterReplacements(worksheet, record, startRow);
        
        // Also search for {{notes}} in the entire worksheet (not just the replicated section)
        this.searchAndReplaceNotesGlobally(worksheet, record.cellH8);
        
        // Add thick black border to right edge of this tour section
        this.addRightBorderToTourSection(worksheet, startRow);
      }
      
      // Add totals section at the end (after all tour records)
      const totalsSectionStartRow = 23 + (tours.length * 17);
      console.log(`→ SimpleEOD: Adding totals section starting at row ${totalsSectionStartRow}`);
      
      // Insert rows for totals section
      worksheet.spliceRows(totalsSectionStartRow, 0, 4); // Insert 4 empty rows for totals section
      
      // Copy totals template data
      for (let i = 0; i < totalsTemplateRows.length; i++) {
        const templateRow = totalsTemplateRows[i];
        const newRow = worksheet.getRow(totalsSectionStartRow + i);
        
        // Copy each cell from template
        templateRow.forEach((cellData: any, colIndex: number) => {
          if (cellData && colIndex > 0) {
            const cell = newRow.getCell(colIndex);
            cell.value = cellData.value;
            cell.style = cellData.style;
          }
        });
      }
      
      // Fix the SUM formula in cell F44 (now at the totals section)
      this.fixSumFormula(worksheet, totalsSectionStartRow);
      
      // Calculate totals for all records
      const totalAdults = tours.reduce((sum, record) => sum + (record.cellL8 || 0), 0);
      const totalChildren = tours.reduce((sum, record) => sum + (record.cellM8 || 0), 0);
      const totalComp = tours.reduce((sum, record) => sum + (record.cellN8 || 0), 0);
      
      console.log(`→ SimpleEOD: Calculated totals - Adults: ${totalAdults}, Children: ${totalChildren}, Comp: ${totalComp}`);
      
      // Apply totals to {{total_adult}}, {{total_chd}}, {{total_comp}} delimiters in the totals section
      this.applyTotalDelimiters(worksheet, totalAdults, totalChildren, totalComp, totalsSectionStartRow);
      
      console.log(`→ SimpleEOD: Processed ${tours.length} records in template`);
    } catch (error) {
      console.error('→ SimpleEOD: Error processing tours:', error);
      throw error;
    }
  }

  /**
   * Copy row data including formatting for template replication
   */
  private copyRowData(row: ExcelJS.Row): any[] {
    const cells: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber] = {
        value: cell.value,
        style: { ...cell.style }
      };
    });
    return cells;
  }

  /**
   * Check if a range is already merged
   */
  private isMerged(worksheet: ExcelJS.Worksheet, range: string): boolean {
    try {
      // Check if this exact range is already merged
      if (worksheet.model.merges.some(merge => merge === range)) {
        return true;
      }
      
      // Also check if any cell in the range is part of a merged cell
      const [start, end] = range.split(':');
      if (start && end) {
        const startCell = worksheet.getCell(start);
        const endCell = worksheet.getCell(end);
        
        // If either cell is already merged, consider the range merged
        if (startCell.isMerged || endCell.isMerged) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('→ SimpleEOD: Error checking merged cells:', error);
      return false; // If we can't check, assume it's not merged
    }
  }

  /**
   * Safely merge cells only if not already merged
   */
  private safeMergeCells(worksheet: ExcelJS.Worksheet, range: string): void {
    try {
      if (!this.isMerged(worksheet, range)) {
        worksheet.mergeCells(range);
      }
    } catch (error) {
      console.error('→ SimpleEOD: Error merging cells:', error);
    }
  }

  /**
   * Apply delimiter replacements for a specific record at given row offset
   */
  private applyDelimiterReplacements(worksheet: ExcelJS.Worksheet, record: any, startRow: number): void {
    try {
      // Replace {{tour_name}} in merged cells B23-H23 (adjusted for record position)
      const tourNameRow = startRow; // Row 23 is the first row of the tour template
      const tourNameCell = worksheet.getCell(`B${tourNameRow}`);
      if (tourNameCell.value && typeof tourNameCell.value === 'string' && tourNameCell.value.includes('{{tour_name}}')) {
        tourNameCell.value = tourNameCell.value.replace('{{tour_name}}', record.cellA8 || '');
      }
      
      // Replace {{departure_time}} in the tour section
      for (let row = startRow; row <= startRow + 15; row++) {
        for (let col = 1; col <= 10; col++) {
          const cell = worksheet.getCell(row, col);
          if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{departure_time}}')) {
            cell.value = cell.value.replace('{{departure_time}}', record.cellB8 || '');
          }
        }
      }
    } catch (error) {
      console.error('→ SimpleEOD: Error applying delimiter replacements:', error);
    }
  }

  /**
   * Search for {{notes}} delimiter across the entire worksheet
   */
  private searchAndReplaceNotesGlobally(worksheet: ExcelJS.Worksheet, notesValue: string): void {
    try {
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{notes}}')) {
            cell.value = cell.value.replace('{{notes}}', notesValue || '');
          }
        });
      });
    } catch (error) {
      console.error('→ SimpleEOD: Error replacing notes globally:', error);
    }
  }

  /**
   * Add thick black border to right edge of tour section
   */
  private addRightBorderToTourSection(worksheet: ExcelJS.Worksheet, startRow: number): void {
    try {
      for (let row = startRow; row <= startRow + 15; row++) {
        const cell = worksheet.getCell(row, 8); // Column H
        if (cell.style && cell.style.border) {
          cell.style.border.right = { style: 'thick', color: { argb: 'FF000000' } };
        } else {
          cell.style = {
            ...cell.style,
            border: {
              ...cell.style?.border,
              right: { style: 'thick', color: { argb: 'FF000000' } }
            }
          };
        }
      }
      console.log(`→ SimpleEOD: Added thick right border to column H for tour section starting at row ${startRow}`);
    } catch (error) {
      console.error('→ SimpleEOD: Error adding right border:', error);
    }
  }

  /**
   * Fix the SUM formula in cell F44 (now at totals section)
   */
  private fixSumFormula(worksheet: ExcelJS.Worksheet, totalsSectionStartRow: number): void {
    try {
      const formulaRow = totalsSectionStartRow + 3; // F44 is the 4th row in totals section
      const formulaCell = worksheet.getCell(`F${formulaRow}`);
      formulaCell.value = { formula: `SUM(C${formulaRow}:E${formulaRow})` };
      console.log(`→ SimpleEOD: Fixed SUM formula at F${formulaRow} = SUM(C${formulaRow}:E${formulaRow})`);
    } catch (error) {
      console.error('→ SimpleEOD: Error fixing SUM formula:', error);
    }
  }

  /**
   * Apply total count delimiters to the EOD template totals section
   */
  private applyTotalDelimiters(worksheet: ExcelJS.Worksheet, totalAdults: number, totalChildren: number, totalComp: number, totalsSectionStartRow: number): void {
    try {
      // Apply {{total_adult}} at C44 (3rd row in totals section)
      const totalAdultCell = worksheet.getCell(`C${totalsSectionStartRow + 3}`);
      totalAdultCell.value = totalAdults;
      console.log(`→ SimpleEOD: Set C${totalsSectionStartRow + 3} (total_adult) = ${totalAdults}`);
      
      // Apply {{total_chd}} at D44 (3rd row in totals section)
      const totalChildCell = worksheet.getCell(`D${totalsSectionStartRow + 3}`);
      totalChildCell.value = totalChildren;
      console.log(`→ SimpleEOD: Set D${totalsSectionStartRow + 3} (total_chd) = ${totalChildren}`);
      
      // Apply {{total_comp}} at E44 (3rd row in totals section)
      const totalCompCell = worksheet.getCell(`E${totalsSectionStartRow + 3}`);
      totalCompCell.value = totalComp;
      console.log(`→ SimpleEOD: Set E${totalsSectionStartRow + 3} (total_comp) = ${totalComp}`);
      
      console.log(`→ SimpleEOD: Added totals section: ${totalAdults} adults, ${totalChildren} children, ${totalComp} comp`);
    } catch (error) {
      console.error('→ SimpleEOD: Error applying total delimiters:', error);
    }
  }
}

export const simpleEODProcessor = new SimpleEODProcessor();