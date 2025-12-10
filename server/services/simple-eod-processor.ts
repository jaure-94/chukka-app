import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { cellExtractor, TemplateHeaderData } from "./cell-extractor.js";
import { storage } from "../storage.js";
import { blobStorage } from "./blob-storage.js";

export class SimpleEODProcessor {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Get ship-specific output directory
   */
  private getShipOutputDir(shipId: string = 'ship-a'): string {
    const shipOutputDir = path.join(this.outputDir, shipId);
    if (!fs.existsSync(shipOutputDir)) {
      fs.mkdirSync(shipOutputDir, { recursive: true });
    }
    return shipOutputDir;
  }

  /**
   * Add new tour data to existing EOD report using successive dispatch entries (ship-aware)
   */
  async addSuccessiveDispatchEntry(
    existingEodPath: string,
    dispatchFilePath: string,
    outputPath: string,
    shipId: string = 'ship-a'
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Adding successive dispatch entry to existing EOD report');
      
      // Extract new dispatch records
      const multipleData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
      
      if (multipleData.records.length === 0) {
        throw new Error('No tour records found in dispatch file');
      }
      
      console.log(`→ SimpleEOD: Found ${multipleData.records.length} new tour records to add`);
      
      // Load existing EOD report
      const workbook = new ExcelJS.Workbook();
      if (blobStorage.isBlobUrl(existingEodPath)) {
        await workbook.xlsx.load(await blobStorage.downloadFile(existingEodPath));
      } else {
        if (!fs.existsSync(existingEodPath)) {
          throw new Error(`Existing EOD report not found: ${existingEodPath}`);
        }
        await workbook.xlsx.readFile(existingEodPath);
      }
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in existing EOD report');
      }
      
      // Process template header delimiters if available
      if (multipleData.templateHeaders) {
        console.log(`→ SimpleEOD: Processing template headers for successive dispatch - Ship: "${multipleData.templateHeaders.shipName}"`);
        this.processTemplateHeaderDelimiters(worksheet, multipleData.templateHeaders);
      } else {
        console.log('→ SimpleEOD: WARNING - No template headers found for successive dispatch entry');
      }
      
      // Step 1: Find where the last tour section ends
      const lastTourSectionEnd = this.findLastTourSectionEnd(worksheet);
      console.log(`→ SimpleEOD: Last tour section ends at row ${lastTourSectionEnd}`);
      
      // Step 2: Find the current totals section location
      const currentTotalsStart = this.findTotalsSection(worksheet);
      console.log(`→ SimpleEOD: Current totals section starts at row ${currentTotalsStart}`);
      
      // Step 3: Store the tour template (use the first tour section as template)
      const tourTemplate = this.extractTourTemplate(worksheet, 23, 38);
      
      // Step 4: Insert new rows for additional tour sections
      const newRecordsCount = multipleData.records.length;
      const rowsPerTour = 16; // Each tour section is 16 rows (23-38)
      const totalNewRows = newRecordsCount * rowsPerTour;
      
      console.log(`→ SimpleEOD: Inserting ${totalNewRows} new rows starting at row ${lastTourSectionEnd + 1}`);
      
      // Insert rows and move totals section down
      for (let i = 0; i < totalNewRows; i++) {
        worksheet.insertRow(lastTourSectionEnd + 1 + i, []);
      }
      
      // Step 5: Add new tour sections using the template
      let currentInsertRow = lastTourSectionEnd + 1;
      
      for (const record of multipleData.records) {
        console.log(`→ SimpleEOD: Adding tour section for "${record.cellA8}" at row ${currentInsertRow}`);
        
        // Copy tour template to new location
        this.copyTourTemplate(worksheet, tourTemplate, currentInsertRow);
        
        // Apply data to the new section
        this.applyDelimiterReplacements(worksheet, record, currentInsertRow);
        
        // Set guest counts
        this.setGuestCounts(worksheet, record, currentInsertRow);
        
        // Add section border
        this.addSectionBorder(worksheet, currentInsertRow, currentInsertRow + 15);
        
        currentInsertRow += rowsPerTour;
      }
      
      // Step 6: Update totals section with new calculations
      const newTotalsStart = currentTotalsStart + totalNewRows;
      this.updateTotalsSection(worksheet, newTotalsStart, multipleData.records);
      
      // Save the updated file - use blob storage on Vercel or if existing path is blob URL
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
      const useBlob = blobStorage.isBlobUrl(existingEodPath) || isVercel || process.env.USE_BLOB === 'true';
      
      if (useBlob) {
        // On Vercel or if existing path is blob URL, use blob storage
        const blobKey = `output/${shipId}/eod_${Date.now()}.xlsx`;
        const blobUrl = await blobStorage.saveWorkbookToBlob(workbook, blobKey, false);
        console.log(`→ SimpleEOD: Successfully added ${newRecordsCount} tour sections to existing EOD report in blob: ${blobUrl}`);
        return blobUrl;
      } else {
        // Local development - use filesystem
        await workbook.xlsx.writeFile(outputPath);
        console.log(`→ SimpleEOD: Successfully added ${newRecordsCount} tour sections to existing EOD report: ${outputPath}`);
        return outputPath;
      }
      
    } catch (error) {
      console.error('→ SimpleEOD: Error adding successive dispatch entry:', error);
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
    outputPath: string,
    shipId: string = 'ship-a'
  ): Promise<string> {
    try {
      console.log('→ SimpleEOD: Processing multiple dispatch records');
      console.log(`→ SimpleEOD: About to call cellExtractor.extractMultipleRecords with path: ${dispatchFilePath}`);
      // Only check filesystem existence if it's not a blob URL
      if (!blobStorage.isBlobUrl(dispatchFilePath)) {
        console.log(`→ SimpleEOD: File exists at path: ${fs.existsSync(dispatchFilePath)}`);
      } else {
        console.log(`→ SimpleEOD: Dispatch file is a blob URL`);
      }
      
      // Extract all dispatch records
      let multipleData;
      try {
        multipleData = await cellExtractor.extractMultipleRecords(dispatchFilePath);
        console.log(`→ SimpleEOD: Successfully extracted ${multipleData.records.length} records`);
        console.log(`→ SimpleEOD: Template headers present: ${multipleData.templateHeaders ? 'YES' : 'NO'}`);
        if (multipleData.templateHeaders) {
          console.log(`→ SimpleEOD: Template headers - Ship: "${multipleData.templateHeaders.shipName}"`);
        }
      } catch (extractError) {
        console.error('→ SimpleEOD: ERROR in cellExtractor.extractMultipleRecords:', extractError);
        throw extractError;
      }
      
      if (multipleData.records.length === 0) {
        throw new Error('No tour records found in dispatch file');
      }
      
      console.log(`→ SimpleEOD: Found ${multipleData.records.length} tour records to process`);
      
      // Load EOD template - handle both blob URLs and filesystem paths
      const workbook = new ExcelJS.Workbook();
      if (blobStorage.isBlobUrl(eodTemplatePath)) {
        console.log(`→ SimpleEOD: Loading EOD template from blob storage: ${eodTemplatePath}`);
        await workbook.xlsx.load(await blobStorage.downloadFile(eodTemplatePath));
      } else {
        if (!fs.existsSync(eodTemplatePath)) {
          throw new Error(`EOD template file not found: ${eodTemplatePath}`);
        }
        console.log(`→ SimpleEOD: Loading EOD template from filesystem: ${eodTemplatePath}`);
        await workbook.xlsx.readFile(eodTemplatePath);
      }
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('Could not find worksheet in EOD template');
      }
      
      // Store template sections separately: individual tour template (23-38) and totals section (41-44)
      const tourTemplateRows: any[] = [];
      const totalsTemplateRows: any[] = [];
      const templateMergedCells: string[] = [];
      
      // Store merged cells for tour template section (23-38)
      if (worksheet.model.merges) {
        worksheet.model.merges.forEach((merge: any) => {
          const mergeStr = typeof merge === 'string' ? merge : String(merge);
          try {
            const [startCell, endCell] = mergeStr.split(':');
            const mergeStart = Number(worksheet.getCell(startCell).row);
            const mergeEnd = Number(worksheet.getCell(endCell).row);
            if (mergeStart >= 23 && mergeEnd <= 38) {
              templateMergedCells.push(mergeStr);
            }
          } catch (error) {
            console.log(`→ SimpleEOD: Skipping invalid merge range: ${mergeStr}`);
          }
        });
      }
      
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
      
      // Process template header delimiters first
      if (multipleData.templateHeaders) {
        console.log(`→ SimpleEOD: Processing template headers for initial EOD generation - Ship: "${multipleData.templateHeaders.shipName}", Operator: "${multipleData.templateHeaders.tourOperator}"`);
        this.processTemplateHeaderDelimiters(worksheet, multipleData.templateHeaders);
      } else {
        console.log('→ SimpleEOD: WARNING - No template headers found for initial EOD generation');
      }
      
      // Process each record using tour template only
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
        const startRow = 23 + (recordIndex * 17); // Each record takes 17 rows (16 for tour template + 1 blank)
        
        console.log(`→ SimpleEOD: Processing record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Insert tour template rows for this record
        if (recordIndex > 0) {
          // Insert new rows for this record
          worksheet.spliceRows(startRow, 0, new Array(17).fill([])); // Insert 17 empty rows (16 for tour template + 1 blank)
          
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
            const startRowMatch = startCell.match(/\d+/);
            const endRowMatch = endCell.match(/\d+/);
            if (startRowMatch && endRowMatch) {
              const startRowTemplate = parseInt(startRowMatch[0]);
              const endRowTemplate = parseInt(endRowMatch[0]);
              
              // Calculate offset for new record
              const rowOffset = recordIndex * 17;
              
              const newMergeRange = mergeRange.replace(/\d+/g, (match: string) => {
                const rowNum = parseInt(match);
                return (rowNum + rowOffset).toString();
              });
            
              this.safeMergeCells(worksheet, newMergeRange);
            }
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
      worksheet.spliceRows(totalsSectionStartRow, 0, new Array(4).fill([])); // Insert 4 empty rows for totals section
      
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
      
      // Calculate totals by reading from all tour sections in the worksheet
      this.updateTotalsSection(worksheet, totalsSectionStartRow, multipleData.records);
      
      // Save the processed file
      const useBlob = process.env.VERCEL === '1' || process.env.USE_BLOB === 'true';
      if (useBlob) {
        const blobKey = `output/${shipId}/eod_${Date.now()}.xlsx`;
        const blobUrl = await blobStorage.saveWorkbookToBlob(workbook, blobKey);
        console.log(`→ SimpleEOD: Processed ${multipleData.records.length} records and saved to blob: ${blobUrl}`);
        return blobUrl;
      } else {
        await workbook.xlsx.writeFile(outputPath);
        console.log(`→ SimpleEOD: Processed ${multipleData.records.length} records and saved to ${outputPath}`);
        return outputPath;
      }
      
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
   * Find where the last tour section ends in the worksheet
   */
  private findLastTourSectionEnd(worksheet: ExcelJS.Worksheet): number {
    // Look for the last occurrence of tour data by scanning for non-empty cells
    // Start from a reasonable position and scan downward
    let lastDataRow = 38; // Default to first tour section end
    
    // Scan from row 39 onwards to find additional tour sections
    for (let row = 39; row <= 200; row++) {
      const cellA = worksheet.getCell(row, 1);
      const cellB = worksheet.getCell(row, 2);
      const cellC = worksheet.getCell(row, 3);
      
      // Check if this looks like a tour section (has data in key columns)
      if (cellA.value || cellB.value || cellC.value) {
        lastDataRow = Math.max(lastDataRow, row);
      }
    }
    
    // Add buffer to account for tour section structure
    return lastDataRow + 5;
  }

  /**
   * Find where the totals section starts
   */
  private findTotalsSection(worksheet: ExcelJS.Worksheet): number {
    // Look for {{total_adult}}, {{total_chd}}, or "Total" text
    for (let row = 40; row <= 200; row++) {
      for (let col = 1; col <= 10; col++) {
        const cell = worksheet.getCell(row, col);
        if (cell.value) {
          const cellValue = String(cell.value).toLowerCase();
          if (cellValue.includes('total') || cellValue.includes('{{total_')) {
            return row - 3; // Return a few rows before to include the totals header
          }
        }
      }
    }
    return 41; // Default totals section start
  }

  /**
   * Extract tour template from existing section
   */
  private extractTourTemplate(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number): any[] {
    const template = [];
    
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      template.push(this.copyRowData(row));
    }
    
    return template;
  }

  /**
   * Copy tour template to new location
   */
  private copyTourTemplate(worksheet: ExcelJS.Worksheet, template: any[], startRow: number): void {
    for (let i = 0; i < template.length; i++) {
      const targetRow = worksheet.getRow(startRow + i);
      const templateRow = template[i];
      
      // Copy each cell
      for (let col = 1; col <= templateRow.length; col++) {
        if (templateRow[col]) {
          const targetCell = targetRow.getCell(col);
          targetCell.value = templateRow[col].value;
          targetCell.style = { ...templateRow[col].style };
        }
      }
    }
  }

  /**
   * Set guest counts for a tour section
   */
  private setGuestCounts(worksheet: ExcelJS.Worksheet, record: any, startRow: number): void {
    // Guest counts are at startRow + 2 (offset of 2 from tour section start)
    const guestCountRow = startRow + 2;
    
    worksheet.getCell(guestCountRow, 3).value = record.cellL8 || 0; // Adult count
    worksheet.getCell(guestCountRow, 4).value = record.cellM8 || 0; // Child count  
    worksheet.getCell(guestCountRow, 5).value = record.cellN8 || 0; // Comp count
    
    console.log(`→ SimpleEOD: Set guest counts at row ${guestCountRow} - Adults: ${record.cellL8}, Children: ${record.cellM8}, Comp: ${record.cellN8}`);
  }

  /**
   * Add section border to tour section
   */
  private addSectionBorder(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number): void {
    // Add thick black right border to column H for the entire section
    for (let row = startRow; row <= endRow; row++) {
      const cell = worksheet.getCell(row, 8); // Column H
      cell.border = {
        ...cell.border,
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };
    }
  }

  /**
   * Update totals section with new calculations
   */
  private updateTotalsSection(worksheet: ExcelJS.Worksheet, totalsStartRow: number, allRecords: any[]): void {
    // Calculate totals by reading actual guest counts from all tour sections in worksheet
    let totalAdults = 0;
    let totalChildren = 0;
    let totalComp = 0;
    
    console.log(`→ SimpleEOD: Calculating totals by reading all tour sections in worksheet (totals start at row ${totalsStartRow})`);
    
    // Scan through the worksheet to find all tour sections
    // Tour sections start at row 23 and repeat every 17 rows, with guest counts at offset +2 (3rd row)
    let recordIndex = 0;
    let sectionCount = 0;
    
    while (true) {
      // Calculate the current row based on the record processing logic: 23 + (recordIndex * 17)
      const currentRow = 23 + (recordIndex * 17);
      const guestCountRow = currentRow + 2; // Guest counts are at offset +2 from section start
      
      // Stop if we've reached the totals section
      if (currentRow >= totalsStartRow) {
        break;
      }
      
      console.log(`→ SimpleEOD: Checking potential tour section at row ${currentRow} (guest count row ${guestCountRow})`);
      
      const adultCell = worksheet.getCell(guestCountRow, 3); // Column C
      const childCell = worksheet.getCell(guestCountRow, 4); // Column D
      const compCell = worksheet.getCell(guestCountRow, 5);  // Column E
      
      // Check if this row contains numeric guest counts
      const adults = typeof adultCell.value === 'number' ? adultCell.value : 0;
      const children = typeof childCell.value === 'number' ? childCell.value : 0;
      const comp = typeof compCell.value === 'number' ? compCell.value : 0;
      
      console.log(`→ SimpleEOD: Row ${guestCountRow} values - Adults: ${adults} (${typeof adultCell.value}), Children: ${children} (${typeof childCell.value}), Comp: ${comp} (${typeof compCell.value})`);
      
      // Only count if we have valid numeric values (indicating this is a tour section)
      if (adults > 0 || children > 0 || comp > 0) {
        totalAdults += adults;
        totalChildren += children;
        totalComp += comp;
        sectionCount++;
        console.log(`→ SimpleEOD: ✓ Found tour section at row ${currentRow} - Adults: ${adults}, Children: ${children}, Comp: ${comp}`);
      } else {
        console.log(`→ SimpleEOD: ✗ No valid guest counts found at row ${currentRow}`);
        // If we don't find guest counts, assume no more tour sections
        break;
      }
      
      recordIndex++;
    }
    
    console.log(`→ SimpleEOD: Processed ${sectionCount} tour sections`);
    
    // Update totals at the expected positions using delimiter replacement
    this.replaceTotalsDelimiters(worksheet, totalsStartRow, totalAdults, totalChildren, totalComp);
    
    console.log(`→ SimpleEOD: Updated totals section at row ${totalsStartRow + 4} - Adults: ${totalAdults}, Children: ${totalChildren}, Comp: ${totalComp}`);
  }
  
  /**
   * Replace {{total_adult}}, {{total_chd}}, and {{total_comp}} delimiters in totals section
   */
  private replaceTotalsDelimiters(worksheet: ExcelJS.Worksheet, totalsStartRow: number, totalAdults: number, totalChildren: number, totalComp: number): void {
    // Search for delimiters in the totals section (typically 6 rows)
    for (let rowOffset = 0; rowOffset < 6; rowOffset++) {
      const currentRow = totalsStartRow + rowOffset;
      
      // Check each column in this row
      for (let col = 1; col <= 9; col++) { // Columns A through I
        const cell = worksheet.getCell(currentRow, col);
        
        if (cell.value) {
          const cellValueStr = String(cell.value);
          
          // Check for {{total_adult}} delimiter
          if (cellValueStr.includes('{{total_adult}}')) {
            cell.value = totalAdults;
            console.log(`→ SimpleEOD: Found and replaced {{total_adult}} at ${cell.address} = ${totalAdults}`);
          }
          
          // Check for {{total_chd}} delimiter
          if (cellValueStr.includes('{{total_chd}}')) {
            cell.value = totalChildren;
            console.log(`→ SimpleEOD: Found and replaced {{total_chd}} at ${cell.address} = ${totalChildren}`);
          }
          
          // Check for {{total_comp}} delimiter
          if (cellValueStr.includes('{{total_comp}}')) {
            cell.value = totalComp;
            console.log(`→ SimpleEOD: Found and replaced {{total_comp}} at ${cell.address} = ${totalComp}`);
          }
        }
      }
    }
  }

  /**
   * Process template header delimiters in EOD report
   * Updated for new template structure with cruise line field and date
   * C3 -> {{cruise_line}} (NEW), C4 -> {{ship_name}}, C5 -> {{tour_operator}}, C8 -> {{shorex_manager}}, C9 -> {{shorex_asst_manager}}
   * Also searches for {{date}} delimiter anywhere in the template
   */
  private processTemplateHeaderDelimiters(worksheet: ExcelJS.Worksheet, templateHeaders: TemplateHeaderData): void {
    console.log(`→ SimpleEOD: Processing template header delimiters`);
    
    // Process specific delimiter locations (updated mapping with cruise line)
    const delimiterMappings = [
      { cell: 'C3', delimiter: '{{cruise_line}}', value: templateHeaders.cruiseLine },
      { cell: 'C4', delimiter: '{{ship_name}}', value: templateHeaders.shipName },
      { cell: 'C5', delimiter: '{{tour_operator}}', value: templateHeaders.tourOperator },
      { cell: 'C8', delimiter: '{{shorex_manager}}', value: templateHeaders.shorexManager },
      { cell: 'C9', delimiter: '{{shorex_asst_manager}}', value: templateHeaders.shorexAsstManager }
    ];
    
    delimiterMappings.forEach(({ cell, delimiter, value }) => {
      const targetCell = worksheet.getCell(cell);
      if (targetCell.value && String(targetCell.value).includes(delimiter)) {
        targetCell.value = value;
        console.log(`→ SimpleEOD: Replaced ${delimiter} at ${cell} = "${value}"`);
      } else {
        console.log(`→ SimpleEOD: WARNING - ${delimiter} not found at ${cell}, current value: "${targetCell.value}"`);
      }
    });
    
    // Search for {{date}} delimiter globally (date location may vary)
    if (templateHeaders.date) {
      let dateFound = false;
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value && String(cell.value).includes('{{date}}')) {
            cell.value = templateHeaders.date;
            console.log(`→ SimpleEOD: Found and replaced {{date}} at ${cell.address} = "${templateHeaders.date}"`);
            dateFound = true;
          }
        });
      });
      
      if (!dateFound) {
        console.log(`→ SimpleEOD: WARNING - {{date}} delimiter not found anywhere in the template`);
      }
    } else {
      console.log(`→ SimpleEOD: WARNING - No date extracted from dispatch file`);
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
    
    // Log results and apply fallback if delimiters not found
    if (!tourNameFound) {
      console.log(`→ SimpleEOD: WARNING - {{tour_name}} delimiter not found in template section starting at row ${startRow}`);
      // FALLBACK: Set tour name in first row, column B if delimiter not found
      const tourNameCell = worksheet.getCell(startRow, 2); // Column B, first row of section
      tourNameCell.value = record.cellA8;
      tourNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      console.log(`→ SimpleEOD: FALLBACK - Set tour name at B${startRow} = "${record.cellA8}"`);
    }
    if (!notesFound) {
      console.log(`→ SimpleEOD: WARNING - {{notes}} delimiter not found in template section starting at row ${startRow}`);
      // FALLBACK: Set notes in the notes block area
      const notesStartRow = startRow + 5; // Row 6 of section
      const notesCell = worksheet.getCell(notesStartRow, 1); // Column A
      notesCell.value = record.cellH8;
      notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      console.log(`→ SimpleEOD: FALLBACK - Set notes at A${notesStartRow} = "${record.cellH8}"`);
    }
    
    // Apply merged cells for tour name (B-H in first row of section) - always apply
    this.safeMergeCells(worksheet, `B${startRow}:H${startRow}`);
    console.log(`→ SimpleEOD: Applied merged cells B${startRow}:H${startRow} for tour name`);
    
    // Apply merged cells for Comments/Notes subheading (A-H in 5th row of section)
    const commentsRow = startRow + 4; // 5th row of the section
    this.safeMergeCells(worksheet, `A${commentsRow}:H${commentsRow}`);
    console.log(`→ SimpleEOD: Applied merged cells A${commentsRow}:H${commentsRow} for Comments/Notes subheading`);
    
    // Apply merged cells for notes block (A-H across rows 6-10 of section, merged vertically)
    const notesStartRow = startRow + 5; // Row 6 of section
    const notesEndRow = startRow + 9;   // Row 10 of section
    this.safeMergeCells(worksheet, `A${notesStartRow}:H${notesEndRow}`);
    console.log(`→ SimpleEOD: Applied merged cells A${notesStartRow}:H${notesEndRow} for notes block (vertical merge)`);
    
    // Find and replace {{notes}} in the notes block area
    if (notesFound) {
      // Set the notes content in the merged notes block
      const notesCell = worksheet.getCell(notesStartRow, 1); // Column A
      notesCell.value = record.cellH8;
      notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      console.log(`→ SimpleEOD: Set notes content in merged area at A${notesStartRow} = "${record.cellH8}"`);
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
    
    // Apply totals to the final row (row 44 equivalent) - offset 5 from start (row 45 in the layout)
    const totalRow = worksheet.getRow(totalsSectionStartRow + 5);
    totalRow.getCell(3).value = totalAdults;  // Column C
    totalRow.getCell(4).value = totalChildren;  // Column D
    totalRow.getCell(5).value = totalComp;  // Column E
    
    console.log(`→ SimpleEOD: Set C${totalsSectionStartRow + 5} (total_adult) = ${totalAdults}`);
    console.log(`→ SimpleEOD: Set D${totalsSectionStartRow + 5} (total_chd) = ${totalChildren}`);
    console.log(`→ SimpleEOD: Set E${totalsSectionStartRow + 5} (total_comp) = ${totalComp}`);
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
      const workbook = new ExcelJS.Workbook();
      if (blobStorage.isBlobUrl(eodTemplatePath)) {
        await workbook.xlsx.load(await blobStorage.downloadFile(eodTemplatePath));
      } else {
        if (!fs.existsSync(eodTemplatePath)) {
          throw new Error(`EOD template file not found: ${eodTemplatePath}`);
        }
        await workbook.xlsx.readFile(eodTemplatePath);
      }
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
        if (cell.style) {
          cell.style.font = undefined;
        }
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
      const useBlob = process.env.VERCEL === '1' || process.env.USE_BLOB === 'true';
      let finalPath: string;
      if (useBlob) {
        const blobKey = `output/eod_${Date.now()}.xlsx`;
        finalPath = await blobStorage.saveWorkbookToBlob(workbook, blobKey);
        console.log(`→ SimpleEOD: Step 4 - Saved populated EOD report to blob: ${finalPath}`);
      } else {
        await workbook.xlsx.writeFile(outputPath);
        finalPath = outputPath;
        console.log(`→ SimpleEOD: Step 4 - Saved populated EOD report to ${outputPath}`);
      }
      
      // Log success summary
      console.log(`
→ SimpleEOD: SUCCESS SUMMARY:
  ✓ Extracted A8 (Tour Name): "${cellData.cellA8}"
  ✓ Extracted B8 (Departure): "${cellData.cellB8}"  
  ✓ Extracted L8 (Notes): "${cellData.cellH8}"
  ✓ Replaced B17 with: "${cellData.cellA8}"
  ✓ Replaced I22 with: "${cellData.cellB8}"
  ✓ Replaced {{notes}} placeholder with: "${cellData.cellH8}"
  ✓ Generated file: ${useBlob ? finalPath : path.basename(outputPath)}
      `);

      return finalPath;
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