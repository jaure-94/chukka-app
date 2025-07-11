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
   * Append new records to an existing EOD report
   */
  async appendToExistingReport(
    existingReportPath: string,
    dispatchFileId: number,
    dispatchFilePath: string,
    outputPath: string
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Appending records to existing EOD report');
      
      // Extract new dispatch records
      const multipleData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      if (multipleData.records.length === 0) {
        throw new Error('No tour records found in dispatch file');
      }
      
      console.log(`→ SimpleEOD: Found ${multipleData.records.length} new tour records to append`);
      
      // Load existing EOD report instead of template
      if (!fs.existsSync(existingReportPath)) {
        throw new Error(`Existing EOD report not found: ${existingReportPath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(existingReportPath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in existing EOD report');
      }
      
      // Find the current totals section (it should be at the end)
      const currentTotalsSectionRow = this.findTotalsSectionRow(worksheet);
      console.log(`→ SimpleEOD: Found existing totals section at row ${currentTotalsSectionRow}`);
      
      // Store the tour template from the existing report (use first tour section as template)
      const tourTemplateRows = [];
      const templateMergedCells = [];
      
      // Extract tour template from rows 23-38 (first tour section)
      for (let rowNum = 23; rowNum <= 38; rowNum++) {
        const row = worksheet.getRow(rowNum);
        tourTemplateRows.push(this.copyRowData(row));
      }
      
      // Store existing merged cells pattern
      worksheet.model.merges.forEach(merge => {
        const mergeStart = worksheet.getCell(merge).row;
        const mergeEnd = worksheet.getCell(merge.split(':')[1]).row;
        if (mergeStart >= 23 && mergeEnd <= 38) {
          templateMergedCells.push(merge);
        }
      });
      
      // Calculate where to insert new records (before totals section)
      const insertionPoint = currentTotalsSectionRow;
      
      // Insert new tour records before the totals section
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
        const startRow = insertionPoint + (recordIndex * 17); // Each record takes 17 rows
        
        console.log(`→ SimpleEOD: Appending record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Insert rows for this new record
        worksheet.spliceRows(startRow, 0, 17); // Insert 17 empty rows
        
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
        
        // Add blank row at the end
        const blankRow = worksheet.getRow(startRow + tourTemplateRows.length);
        blankRow.height = 20;
        
        // Copy merged cells for this record
        templateMergedCells.forEach(mergeRange => {
          const [startCell, endCell] = mergeRange.split(':');
          const newMergeRange = mergeRange.replace(/\d+/g, (match) => {
            const rowNum = parseInt(match);
            const offsetFromTemplate = rowNum - 23; // Original template started at row 23
            return (startRow + offsetFromTemplate).toString();
          });
          
          this.safeMergeCells(worksheet, newMergeRange);
        });
        
        // Apply delimiter replacements for this record
        this.applyDelimiterReplacements(worksheet, record, startRow);
        
        // Add right border to this tour section
        this.addRightBorderToTourSection(worksheet, startRow);
        
        // Store this record in database
        await storage.createExtractedDispatchData({
          dispatchFileId: dispatchFileId,
          cellA8Value: record.cellA8,
          cellB8Value: record.cellB8,
          cellH8Value: record.cellH8
        });
      }
      
      // Recalculate totals including new records
      const newTotalsSectionRow = insertionPoint + (multipleData.records.length * 17);
      const allRecordsData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      // Get existing totals and add new records
      const existingTotals = this.getExistingTotals(worksheet, currentTotalsSectionRow);
      const newTotals = {
        adults: existingTotals.adults + allRecordsData.records.reduce((sum, record) => sum + (record.cellL8 || 0), 0),
        children: existingTotals.children + allRecordsData.records.reduce((sum, record) => sum + (record.cellM8 || 0), 0),
        comp: existingTotals.comp + allRecordsData.records.reduce((sum, record) => sum + (record.cellN8 || 0), 0)
      };
      
      console.log(`→ SimpleEOD: Updated totals - Adults: ${newTotals.adults}, Children: ${newTotals.children}, Comp: ${newTotals.comp}`);
      
      // Update totals section with new values
      this.applyTotalDelimiters(worksheet, newTotals.adults, newTotals.children, newTotals.comp, newTotalsSectionRow);
      
      // Fix SUM formula in totals section
      this.fixSumFormula(worksheet, newTotalsSectionRow);
      
      // Save the updated report
      await workbook.xlsx.writeFile(outputPath);
      
      console.log(`→ SimpleEOD: Appended ${multipleData.records.length} records to existing report and saved to ${outputPath}`);
      
      return outputPath;
      
    } catch (error) {
      console.error('→ SimpleEOD: Error appending to existing report:', error);
      throw error;
    }
  }

  /**
   * Process multiple dispatch records - replicate rows 17-25 for each record
   */
  async processMultipleRecords(
    eodTemplatePath: string,
    dispatchFileId: number,
    dispatchFilePath: string,
    outputPath: string
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Processing multiple dispatch records');
      
      // Extract all dispatch records
      const multipleData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      if (multipleData.records.length === 0) {
        throw new Error('No tour records found in dispatch file');
      }
      
      console.log(`→ SimpleEOD: Found ${multipleData.records.length} tour records to process`);
      
      // Load EOD template
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(eodTemplatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in EOD template');
      }
      
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
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
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
        
        // Store this record in database
        await storage.createExtractedDispatchData({
          dispatchFileId: dispatchFileId,
          cellA8Value: record.cellA8,
          cellB8Value: record.cellB8,
          cellH8Value: record.cellH8
        });
      }
      
      // Add totals section at the end (after all tour records)
      const totalsSectionStartRow = 23 + (multipleData.records.length * 17);
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
      const totalAdults = multipleData.records.reduce((sum, record) => sum + (record.cellL8 || 0), 0);
      const totalChildren = multipleData.records.reduce((sum, record) => sum + (record.cellM8 || 0), 0);
      const totalComp = multipleData.records.reduce((sum, record) => sum + (record.cellN8 || 0), 0);
      
      console.log(`→ SimpleEOD: Calculated totals - Adults: ${totalAdults}, Children: ${totalChildren}, Comp: ${totalComp}`);
      
      // Apply totals to {{total_adult}}, {{total_chd}}, {{total_comp}} delimiters in the totals section
      this.applyTotalDelimiters(worksheet, totalAdults, totalChildren, totalComp, totalsSectionStartRow);
      
      // Save the processed file
      await workbook.xlsx.writeFile(outputPath);
      
      console.log(`→ SimpleEOD: Processed ${multipleData.records.length} records and saved to ${outputPath}`);
      
      return outputPath;
      
    } catch (error) {
      console.error('→ SimpleEOD: Error processing multiple records:', error);
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
      // If we can't determine, assume it's not merged
      return false;
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
      // If merge fails, it's likely already merged - ignore the error
      console.log(`→ SimpleEOD: Merge skipped for ${range} (likely already merged)`);
    }
  }

  /**
   * Apply delimiter replacements for a specific record at given row offset
   */
  private applyDelimiterReplacements(worksheet: ExcelJS.Worksheet, record: any, startRow: number): void {
    // COMPREHENSIVE SEARCH: Find {{tour_name}} and {{notes}} delimiters anywhere in the template
    console.log(`→ SimpleEOD: Searching for {{tour_name}} and {{notes}} delimiters in template section starting at row ${startRow}`);
    
    let tourNameFound = false;
    let notesFound = false;
    
    // Search through the tour template section (16 rows: 23-38) for delimiters
    for (let rowOffset = 0; rowOffset < 16; rowOffset++) {
      const currentRow = startRow + rowOffset;
      
      // Check each column in this row
      for (let col = 1; col <= 9; col++) { // Columns A through I
        const cell = worksheet.getCell(currentRow, col);
        
        if (cell.value) {
          const cellValueStr = String(cell.value);
          
          // Check for {{tour_name}} delimiter
          if (cellValueStr.includes('{{tour_name}}')) {
            cell.value = record.cellA8;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            console.log(`→ SimpleEOD: Found and replaced {{tour_name}} at ${cell.address} = "${record.cellA8}"`);
            tourNameFound = true;
          }
          
          // Check for {{notes}} delimiter
          if (cellValueStr.includes('{{notes}}')) {
            cell.value = record.cellH8;
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            console.log(`→ SimpleEOD: Found and replaced {{notes}} at ${cell.address} = "${record.cellH8}"`);
            notesFound = true;
          }
          
          // Check for {{departure_time}} delimiter
          if (cellValueStr.includes('{{departure_time}}')) {
            cell.value = record.cellB8;
            console.log(`→ SimpleEOD: Found and replaced {{departure_time}} at ${cell.address} = "${record.cellB8}"`);
          }
        }
      }
    }
    
    // Log results
    if (!tourNameFound) {
      console.log(`→ SimpleEOD: WARNING - {{tour_name}} delimiter not found in template section starting at row ${startRow}`);
    }
    if (!notesFound) {
      console.log(`→ SimpleEOD: WARNING - {{notes}} delimiter not found in template section starting at row ${startRow}`);
    }
    
    // Apply merged cells for tour name (assuming it's in the first row of the section)
    if (tourNameFound) {
      this.safeMergeCells(worksheet, `B${startRow}:H${startRow}`);
      console.log(`→ SimpleEOD: Applied merged cells B${startRow}:H${startRow} for tour name`);
    }
    
    // NEW: Replace guest count delimiters with actual data from dispatch
    // From the template analysis: {{num_adult}} at C25, {{num_chd}} at D25, {{num_comp}} at E25
    // In the new 23-38 template structure: startRow=23, so guest counts are at startRow + 2 = 25
    
    // Replace {{num_adult}} in guest count cells (offset: startRow + 2)
    const adultCountCell = worksheet.getCell(startRow + 2, 3); // Column C
    if (adultCountCell.value && String(adultCountCell.value).includes('{{num_adult}}')) {
      adultCountCell.value = record.cellL8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 2} col C (num_adult) = ${record.cellL8}`);
    }
    
    // Replace {{num_chd}} in guest count cells (offset: startRow + 2)
    const childCountCell = worksheet.getCell(startRow + 2, 4); // Column D
    if (childCountCell.value && String(childCountCell.value).includes('{{num_chd}}')) {
      childCountCell.value = record.cellM8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 2} col D (num_chd) = ${record.cellM8}`);
    }
    
    // Replace {{num_comp}} in guest count cells (offset: startRow + 2)
    const compCountCell = worksheet.getCell(startRow + 2, 5); // Column E
    if (compCountCell.value && String(compCountCell.value).includes('{{num_comp}}')) {
      compCountCell.value = record.cellN8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 2} col E (num_comp) = ${record.cellN8}`);
    }
  }

  /**
   * Search for {{notes}} delimiter across the entire worksheet
   */
  private searchAndReplaceNotesGlobally(worksheet: ExcelJS.Worksheet, notesValue: string): void {
    console.log(`→ SimpleEOD: Searching for {{notes}} delimiter globally in entire worksheet`);
    
    let notesFound = false;
    
    // Search through all rows and columns in the worksheet
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value) {
          const cellValueStr = String(cell.value);
          
          if (cellValueStr.includes('{{notes}}')) {
            cell.value = notesValue;
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            console.log(`→ SimpleEOD: Found and replaced {{notes}} at ${cell.address} = "${notesValue}"`);
            
            // Check if this is in a merged cell area that needs to be expanded
            const cellAddress = cell.address;
            const rowNum = rowNumber;
            const colNum = colNumber;
            
            // Try to merge cells A through H for notes (common pattern)
            if (colNum >= 1 && colNum <= 8) {
              const mergeRange = `A${rowNum}:H${rowNum}`;
              this.safeMergeCells(worksheet, mergeRange);
              console.log(`→ SimpleEOD: Applied merged cells ${mergeRange} for notes`);
            }
            
            notesFound = true;
          }
        }
      });
    });
    
    if (!notesFound) {
      console.log(`→ SimpleEOD: WARNING - {{notes}} delimiter not found anywhere in the worksheet`);
    }
  }

  /**
   * Find the totals section row in existing EOD report
   */
  private findTotalsSectionRow(worksheet: ExcelJS.Worksheet): number {
    console.log(`→ SimpleEOD: Looking for totals section in existing report`);
    
    // Search for {{total_adult}} delimiter first (in case it's still a template)
    let totalsSectionRow = -1;
    
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value && String(cell.value).includes('{{total_adult}}')) {
          totalsSectionRow = rowNumber;
          console.log(`→ SimpleEOD: Found {{total_adult}} delimiter at row ${rowNumber}`);
          return false; // Stop iteration
        }
      });
      if (totalsSectionRow !== -1) return false; // Stop row iteration
    });
    
    // If delimiter not found, search for existing totals pattern
    if (totalsSectionRow === -1) {
      console.log(`→ SimpleEOD: No delimiter found, searching for numerical totals pattern`);
      
      // Look for the pattern where we have numerical values in C, D, E columns
      // and the next few rows are mostly empty (typical totals section)
      worksheet.eachRow((row, rowNumber) => {
        const cellC = row.getCell(3); // Column C
        const cellD = row.getCell(4); // Column D
        const cellE = row.getCell(5); // Column E
        
        // Check for numerical values in C, D, E columns
        if (cellC.value && cellD.value && cellE.value &&
            typeof cellC.value === 'number' && 
            typeof cellD.value === 'number' && 
            typeof cellE.value === 'number') {
          
          // Check if this looks like a totals row by examining the row structure
          const total = cellC.value + cellD.value + cellE.value;
          
          // Look for patterns that indicate this is a totals section
          // - Has numerical values in C, D, E
          // - Next few rows are mostly empty
          // - Usually appears after multiple tour sections
          
          if (total > 5 && rowNumber > 40) { // Reasonable threshold and position
            console.log(`→ SimpleEOD: Found potential totals at row ${rowNumber} - C:${cellC.value}, D:${cellD.value}, E:${cellE.value}`);
            
            // Check if the next few rows are mostly empty (confirms this is totals)
            let isLikelyTotals = true;
            for (let checkRow = rowNumber + 1; checkRow <= rowNumber + 3; checkRow++) {
              const nextRow = worksheet.getRow(checkRow);
              let hasContent = false;
              nextRow.eachCell((cell) => {
                if (cell.value && String(cell.value).trim() !== '') {
                  hasContent = true;
                }
              });
              if (hasContent) {
                isLikelyTotals = false;
                break;
              }
            }
            
            if (isLikelyTotals) {
              totalsSectionRow = rowNumber;
              console.log(`→ SimpleEOD: Confirmed totals section at row ${rowNumber}`);
              return false;
            }
          }
        }
      });
    }
    
    if (totalsSectionRow === -1) {
      console.log(`→ SimpleEOD: No totals section found, using default fallback at row 77`);
      totalsSectionRow = 77;
    }
    
    return totalsSectionRow;
  }

  /**
   * Get existing totals from the current report
   */
  private getExistingTotals(worksheet: ExcelJS.Worksheet, totalsSectionRow: number): { adults: number, children: number, comp: number } {
    const adultsCell = worksheet.getCell(totalsSectionRow, 3); // Column C
    const childrenCell = worksheet.getCell(totalsSectionRow, 4); // Column D
    const compCell = worksheet.getCell(totalsSectionRow, 5); // Column E
    
    return {
      adults: (typeof adultsCell.value === 'number') ? adultsCell.value : 0,
      children: (typeof childrenCell.value === 'number') ? childrenCell.value : 0,
      comp: (typeof compCell.value === 'number') ? compCell.value : 0
    };
  }

  /**
   * Add thick black border to right edge of tour section
   */
  private addRightBorderToTourSection(worksheet: ExcelJS.Worksheet, startRow: number): void {
    // Add thick black border to right edge of column H for the tour section (16 rows)
    for (let rowOffset = 0; rowOffset < 16; rowOffset++) {
      const currentRow = startRow + rowOffset;
      
      // Add thick black border to column H (right edge of tour section)
      const rightEdgeCell = worksheet.getCell(currentRow, 8); // Column H
      rightEdgeCell.border = {
        ...rightEdgeCell.border,
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };
    }
    
    console.log(`→ SimpleEOD: Added thick black right border to column H for tour section starting at row ${startRow}`);
  }

  /**
   * Fix the SUM formula in cell F44 (now at totals section)
   */
  private fixSumFormula(worksheet: ExcelJS.Worksheet, totalsSectionStartRow: number): void {
    // Find the cell F44 equivalent in the totals section (row offset 3 from totals start)
    const formulaRowOffset = 3; // F44 is at row 44, which is offset 3 from row 41
    const formulaRow = totalsSectionStartRow + formulaRowOffset;
    const formulaCell = worksheet.getCell(formulaRow, 6); // Column F
    
    // Set the SUM formula to reference the current row's C, D, E columns
    formulaCell.value = { formula: `SUM(C${formulaRow}:E${formulaRow})` };
    
    console.log(`→ SimpleEOD: Fixed SUM formula at F${formulaRow} = SUM(C${formulaRow}:E${formulaRow})`);
  }

  /**
   * Apply total count delimiters to the EOD template totals section
   */
  private applyTotalDelimiters(worksheet: ExcelJS.Worksheet, totalAdults: number, totalChildren: number, totalComp: number, totalsSectionStartRow: number): void {
    // Find and replace {{total_adult}}, {{total_chd}}, {{total_comp}} delimiters only in the totals section
    for (let rowOffset = 0; rowOffset < 4; rowOffset++) {
      const currentRow = totalsSectionStartRow + rowOffset;
      const row = worksheet.getRow(currentRow);
      
      row.eachCell((cell, colNumber) => {
        if (cell.value) {
          const cellValueStr = String(cell.value);
          
          if (cellValueStr.includes('{{total_adult}}')) {
            cell.value = totalAdults;
            console.log(`→ SimpleEOD: Set ${cell.address} (total_adult) = ${totalAdults}`);
          }
          if (cellValueStr.includes('{{total_chd}}')) {
            cell.value = totalChildren;
            console.log(`→ SimpleEOD: Set ${cell.address} (total_chd) = ${totalChildren}`);
          }
          if (cellValueStr.includes('{{total_comp}}')) {
            cell.value = totalComp;
            console.log(`→ SimpleEOD: Set ${cell.address} (total_comp) = ${totalComp}`);
          }
        }
      });
    }
  }

  /**
   * Step 2: Store dispatch data in database
   * Step 3: Replace delimiters in EOD template with stored data (single record - legacy)
   */
  async processEODWithStoredData(
    eodTemplatePath: string,
    dispatchFileId: number,
    dispatchFilePath: string,
    outputPath: string
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Step 2 - Extract and store dispatch data');
      
      // Extract cell data from dispatch file
      const cellData = await cellExtractor.extractCells(dispatchFilePath);
      
      // Store extracted data in database
      const storedData = await storage.createExtractedDispatchData({
        dispatchFileId: dispatchFileId,
        cellA8Value: cellData.cellA8,
        cellB8Value: cellData.cellB8,
        cellH8Value: cellData.cellH8
      });
      
      console.log('→ SimpleEOD: Stored dispatch data:', storedData);

      console.log('→ SimpleEOD: Step 3 - Replace delimiters in EOD template');
      
      // Load EOD template
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(eodTemplatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('No worksheet found in EOD template');
      }

      // Step 3: Replace cell B17 with tour name from A8
      console.log('→ SimpleEOD: Replacing B17 with tour name from A8');
      const cellB17 = worksheet.getCell('B17');
      
      if (cellData.cellA8) {
        cellB17.value = cellData.cellA8;
        console.log(`→ SimpleEOD: Set B17 = "${cellData.cellA8}"`);
      } else {
        console.log('→ SimpleEOD: No tour name found in A8, B17 unchanged');
      }

      // Also replace other delimiters if we have data
      if (cellData.cellB8) {
        const cellI22 = worksheet.getCell('I22');
        cellI22.value = cellData.cellB8;
        console.log(`→ SimpleEOD: Set I22 (departure_time) = "${cellData.cellB8}"`);
      }

      if (cellData.cellH8) {
        // Find the cell containing {{notes}} placeholder
        let notesCellFound = false;
        worksheet.eachRow((row, rowNumber) => {
          row.eachCell((cell, colNumber) => {
            if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{notes}}')) {
              cell.value = cellData.cellH8;
              const cellAddress = worksheet.getCell(rowNumber, colNumber).address;
              
              console.log(`→ SimpleEOD: Found {{notes}} in ${cellAddress}, replaced with: "${cellData.cellH8}"`);
              notesCellFound = true;
            }
          });
        });
        
        if (!notesCellFound) {
          console.log('→ SimpleEOD: Warning - {{notes}} placeholder not found in EOD template');
        }
      }

      // Apply formatting cleanup to specified cells (including the notes cell)
      const formatCells = ['B21', 'E3', 'E4', 'E5', 'E6', 'I22', 'I23', 'I24'];
      
      // Apply formatting changes AFTER all content changes
      formatCells.forEach(cellAddress => {
        const cell = worksheet.getCell(cellAddress);
        
        // Get current font properties first
        const currentFont = cell.font || {};
        console.log(`→ SimpleEOD: Current font for ${cellAddress}:`, currentFont);
        
        // Force remove all problematic formatting
        cell.font = undefined;
        cell.style = cell.style || {};
        
        // Set clean font properties
        cell.font = {
          name: 'Verdana',
          size: 9,
          family: 2,
          color: { argb: 'FF003366' }
        };
        
        // Explicitly ensure no strikethrough or bold
        if (cell.style) {
          delete cell.style.font;
        }
        
        console.log(`→ SimpleEOD: Clean font applied to ${cellAddress}:`, cell.font);
      });

      // Save the processed file
      await workbook.xlsx.writeFile(outputPath);
      console.log(`→ SimpleEOD: Step 4 - Saved populated EOD report to ${outputPath}`);
      
      // Log success summary
      console.log(`
→ SimpleEOD: SUCCESS SUMMARY:
  ✓ Extracted A8 (Tour Name): "${cellData.cellA8}"
  ✓ Extracted B8 (Departure): "${cellData.cellB8}"  
  ✓ Extracted L8 (Notes): "${cellData.cellH8}"
  ✓ Replaced B17 with: "${cellData.cellA8}"
  ✓ Replaced I22 with: "${cellData.cellB8}"
  ✓ Replaced {{notes}} placeholder with: "${cellData.cellH8}"
  ✓ Generated file: ${path.basename(outputPath)}
      `);

      return outputPath;
    } catch (error) {
      console.error('→ SimpleEOD: Error processing EOD template:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored dispatch data for a file
   */
  async getStoredDispatchData(dispatchFileId: number) {
    return await storage.getExtractedDispatchData(dispatchFileId);
  }
}

export const simpleEODProcessor = new SimpleEODProcessor();