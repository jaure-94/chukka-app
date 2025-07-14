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
   * Process multiple dispatch records - append new tour data to existing EOD report
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
      
      // Check if we should use the latest EOD report or the base template
      const latestEODPath = await this.getLatestEODReportPath();
      const baseTemplatePath = latestEODPath || eodTemplatePath;
      
      console.log(`→ SimpleEOD: Using base template: ${latestEODPath ? 'latest EOD report' : 'original template'}`);
      console.log(`→ SimpleEOD: Base template path: ${baseTemplatePath}`);
      
      // Load base template (either original template or latest EOD report)
      if (!fs.existsSync(baseTemplatePath)) {
        throw new Error(`Base template file not found: ${baseTemplatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(baseTemplatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in base template');
      }
      
      // Determine if we're working with an existing EOD report or a fresh template
      const isExistingEOD = latestEODPath !== null;
      
      // Find the insertion point (where to add new tour sections)
      const insertionPoint = isExistingEOD ? 
        await this.findInsertionPoint(worksheet) : 
        23; // Start at row 23 for fresh template
      
      console.log(`→ SimpleEOD: Insertion point determined: row ${insertionPoint}`);
      
      // Store template sections for new tour entries
      const tourTemplateRows = [];
      const totalsTemplateRows = [];
      const templateMergedCells = [];
      
      if (isExistingEOD) {
        // For existing EOD, extract tour template from the base template file
        const baseWorkbook = new ExcelJS.Workbook();
        await baseWorkbook.xlsx.readFile(eodTemplatePath);
        const baseWorksheet = baseWorkbook.getWorksheet(1);
        
        // Store tour template from base template (rows 23-38)
        for (let rowNum = 23; rowNum <= 38; rowNum++) {
          const row = baseWorksheet.getRow(rowNum);
          tourTemplateRows.push(this.copyRowData(row));
        }
        
        // Store totals template from base template (rows 41-44)
        for (let rowNum = 41; rowNum <= 44; rowNum++) {
          const row = baseWorksheet.getRow(rowNum);
          totalsTemplateRows.push(this.copyRowData(row));
        }
        
        console.log('→ SimpleEOD: Template sections extracted from base template for appending');
      } else {
        // For fresh template, use the current worksheet
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
        
        console.log('→ SimpleEOD: Tour template (rows 23-38) and totals template (rows 41-44) stored from fresh template');
      }
      
      // Process each new record starting from the insertion point
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
        const startRow = insertionPoint + (recordIndex * 17); // Each record takes 17 rows (16 for tour template + 1 blank)
        
        console.log(`→ SimpleEOD: Processing record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Always insert new rows for new records (even the first one when appending to existing EOD)
        if (recordIndex > 0 || isExistingEOD) {
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
      
      // Update totals section (either add new one or update existing one)
      const totalsSectionStartRow = isExistingEOD ? 
        await this.updateExistingTotalsSection(worksheet, multipleData.records) :
        insertionPoint + (multipleData.records.length * 17);
      
      if (!isExistingEOD) {
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
      }
      
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
   * Get the path of the latest EOD report file
   */
  private async getLatestEODReportPath(): Promise<string | null> {
    try {
      const outputDir = path.join(process.cwd(), "output");
      
      if (!fs.existsSync(outputDir)) {
        return null;
      }

      const files = fs.readdirSync(outputDir)
        .filter(file => file.startsWith('eod_') && file.endsWith('.xlsx'))
        .map(filename => {
          const filePath = path.join(outputDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            filePath,
            createdAt: stats.birthtime
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return files.length > 0 ? files[0].filePath : null;
    } catch (error) {
      console.error('→ SimpleEOD: Error finding latest EOD report:', error);
      return null;
    }
  }

  /**
   * Find the insertion point in an existing EOD report (before the totals section)
   */
  private async findInsertionPoint(worksheet: ExcelJS.Worksheet): Promise<number> {
    // Look for the totals section by searching for {{total_adult}}, {{total_chd}}, or actual total values
    let totalsRowFound = null;
    
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value) {
          const cellValueStr = String(cell.value);
          // Look for total delimiters or cells that might contain totals
          if (cellValueStr.includes('{{total_adult}}') || 
              cellValueStr.includes('{{total_chd}}') || 
              cellValueStr.includes('{{total_comp}}') ||
              (colNumber >= 3 && colNumber <= 5 && typeof cell.value === 'number' && cell.value > 0)) {
            if (!totalsRowFound || rowNumber < totalsRowFound) {
              totalsRowFound = rowNumber;
            }
          }
        }
      });
    });
    
    // If totals section found, insert before it; otherwise append to the end
    if (totalsRowFound) {
      console.log(`→ SimpleEOD: Found existing totals section at row ${totalsRowFound}`);
      return totalsRowFound;
    }
    
    // If no totals section found, find the last row with content and append after
    let lastContentRow = 22; // Default fallback
    worksheet.eachRow((row, rowNumber) => {
      let hasContent = false;
      row.eachCell((cell) => {
        if (cell.value) {
          hasContent = true;
        }
      });
      if (hasContent && rowNumber > lastContentRow) {
        lastContentRow = rowNumber;
      }
    });
    
    console.log(`→ SimpleEOD: No totals section found, appending after last content at row ${lastContentRow + 1}`);
    return lastContentRow + 1;
  }

  /**
   * Update existing totals section with new cumulative totals
   */
  private async updateExistingTotalsSection(worksheet: ExcelJS.Worksheet, newRecords: any[]): Promise<number> {
    // Calculate totals from new records
    const newTotalAdults = newRecords.reduce((sum, record) => sum + (record.cellL8 || 0), 0);
    const newTotalChildren = newRecords.reduce((sum, record) => sum + (record.cellM8 || 0), 0);
    const newTotalComp = newRecords.reduce((sum, record) => sum + (record.cellN8 || 0), 0);
    
    console.log(`→ SimpleEOD: New records totals - Adults: ${newTotalAdults}, Children: ${newTotalChildren}, Comp: ${newTotalComp}`);
    
    // Find and update existing totals
    let totalsRowFound = null;
    
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value) {
          const cellValueStr = String(cell.value);
          
          // Update total_adult placeholder or add to existing value
          if (cellValueStr.includes('{{total_adult}}') || (colNumber === 3 && typeof cell.value === 'number')) {
            const currentValue = typeof cell.value === 'number' ? cell.value : 0;
            cell.value = currentValue + newTotalAdults;
            console.log(`→ SimpleEOD: Updated total_adult at ${cell.address} = ${cell.value}`);
            totalsRowFound = rowNumber;
          }
          
          // Update total_chd placeholder or add to existing value
          if (cellValueStr.includes('{{total_chd}}') || (colNumber === 4 && typeof cell.value === 'number' && totalsRowFound === rowNumber)) {
            const currentValue = typeof cell.value === 'number' ? cell.value : 0;
            cell.value = currentValue + newTotalChildren;
            console.log(`→ SimpleEOD: Updated total_chd at ${cell.address} = ${cell.value}`);
          }
          
          // Update total_comp placeholder or add to existing value
          if (cellValueStr.includes('{{total_comp}}') || (colNumber === 5 && typeof cell.value === 'number' && totalsRowFound === rowNumber)) {
            const currentValue = typeof cell.value === 'number' ? cell.value : 0;
            cell.value = currentValue + newTotalComp;
            console.log(`→ SimpleEOD: Updated total_comp at ${cell.address} = ${cell.value}`);
          }
        }
      });
    });
    
    return totalsRowFound || 0;
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