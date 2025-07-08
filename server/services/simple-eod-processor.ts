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
      
      // Store original template section (rows 17-25) for replication
      const templateRows = [];
      const templateMergedCells = [];
      
      // Store merged cells in the template section
      worksheet.model.merges.forEach(merge => {
        const mergeStart = worksheet.getCell(merge).row;
        const mergeEnd = worksheet.getCell(merge.split(':')[1]).row;
        if (mergeStart >= 17 && mergeEnd <= 25) {
          templateMergedCells.push(merge);
        }
      });
      
      for (let rowNum = 17; rowNum <= 25; rowNum++) {
        const row = worksheet.getRow(rowNum);
        templateRows.push(this.copyRowData(row));
      }
      
      console.log('→ SimpleEOD: Template section (rows 17-25) stored for replication');
      
      // Process each record
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
        const startRow = 17 + (recordIndex * 9); // Each record takes 9 rows (17-25)
        
        console.log(`→ SimpleEOD: Processing record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Insert template rows for this record
        if (recordIndex > 0) {
          // Insert new rows for this record
          worksheet.spliceRows(startRow, 0, 9); // Insert 9 empty rows
          
          // Copy template data to new rows
          for (let i = 0; i < templateRows.length; i++) {
            const templateRow = templateRows[i];
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
          
          // Copy merged cells for this record (safely)
          templateMergedCells.forEach(mergeRange => {
            const [startCell, endCell] = mergeRange.split(':');
            const startRowTemplate = parseInt(startCell.match(/\d+/)[0]);
            const endRowTemplate = parseInt(endCell.match(/\d+/)[0]);
            
            // Calculate offset for new record
            const rowOffset = recordIndex * 9;
            
            const newMergeRange = mergeRange.replace(/\d+/g, (match) => {
              const rowNum = parseInt(match);
              return (rowNum + rowOffset).toString();
            });
            
            this.safeMergeCells(worksheet, newMergeRange);
          });
        }
        
        // Apply delimiter replacements for this record
        this.applyDelimiterReplacements(worksheet, record, startRow);
        
        // Store this record in database
        await storage.createExtractedDispatchData({
          dispatchFileId: dispatchFileId,
          cellA8Value: record.cellA8,
          cellB8Value: record.cellB8,
          cellH8Value: record.cellH8
        });
      }
      
      // Calculate totals for all records
      const totalAdults = multipleData.records.reduce((sum, record) => sum + (record.cellL8 || 0), 0);
      const totalChildren = multipleData.records.reduce((sum, record) => sum + (record.cellM8 || 0), 0);
      const totalComp = multipleData.records.reduce((sum, record) => sum + (record.cellN8 || 0), 0);
      
      console.log(`→ SimpleEOD: Calculated totals - Adults: ${totalAdults}, Children: ${totalChildren}, Comp: ${totalComp}`);
      
      // Apply totals to {{total_adult}}, {{total_chd}}, {{total_comp}} delimiters
      this.applyTotalDelimiters(worksheet, totalAdults, totalChildren, totalComp);
      
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
    return worksheet.model.merges.some(merge => merge === range);
  }

  /**
   * Safely merge cells only if not already merged
   */
  private safeMergeCells(worksheet: ExcelJS.Worksheet, range: string): void {
    if (!this.isMerged(worksheet, range)) {
      worksheet.mergeCells(range);
    }
  }

  /**
   * Apply delimiter replacements for a specific record at given row offset
   */
  private applyDelimiterReplacements(worksheet: ExcelJS.Worksheet, record: any, startRow: number): void {
    // Debug: Check what's actually in the tour name cell
    const tourNameCell = worksheet.getCell(startRow, 2); // Column B
    console.log(`→ SimpleEOD: DEBUG - Tour name cell B${startRow} value: "${tourNameCell.value}"`);
    
    // Replace {{tour_name}} in B17 (offset: startRow + 0) and merge cells B to I
    if (tourNameCell.value && String(tourNameCell.value).includes('{{tour_name}}')) {
      tourNameCell.value = record.cellA8;
      tourNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Merge cells B through I for tour name (safely)
      this.safeMergeCells(worksheet, `B${startRow}:I${startRow}`);
      console.log(`→ SimpleEOD: Set row ${startRow} col B (tour_name) = "${record.cellA8}" and merged B:I`);
    } else {
      console.log(`→ SimpleEOD: WARNING - No {{tour_name}} delimiter found in B${startRow}`);
    }
    
    // Replace {{departure_time}} in I22 (offset: startRow + 5)
    const departureTimeCell = worksheet.getCell(startRow + 5, 9); // Column I
    if (departureTimeCell.value && String(departureTimeCell.value).includes('{{departure_time}}')) {
      departureTimeCell.value = record.cellB8;
      console.log(`→ SimpleEOD: Set row ${startRow + 5} col I (departure_time) = "${record.cellB8}"`);
    }
    
    // Handle Comments/Notes subheading - merge cells B through I (offset: startRow + 3)
    const commentsSubheadingRow = startRow + 3;
    const commentsCell = worksheet.getCell(commentsSubheadingRow, 2); // Column B
    if (commentsCell.value && (String(commentsCell.value).toLowerCase().includes('comment') || 
        String(commentsCell.value).toLowerCase().includes('note'))) {
      commentsCell.alignment = { horizontal: 'left', vertical: 'middle' };
      this.safeMergeCells(worksheet, `B${commentsSubheadingRow}:I${commentsSubheadingRow}`);
      console.log(`→ SimpleEOD: Merged comments subheading row ${commentsSubheadingRow} B:I`);
    }
    
    // Debug: Check what's actually in the notes cell
    const notesCell = worksheet.getCell(startRow + 4, 2); // Column B
    console.log(`→ SimpleEOD: DEBUG - Notes cell B${startRow + 4} value: "${notesCell.value}"`);
    
    // Replace {{notes}} in B21 (offset: startRow + 4) and merge cells B through I
    if (notesCell.value && String(notesCell.value).includes('{{notes}}')) {
      notesCell.value = record.cellH8;
      notesCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      
      // Merge cells B through I for notes (safely)
      this.safeMergeCells(worksheet, `B${startRow + 4}:I${startRow + 4}`);
      console.log(`→ SimpleEOD: Set row ${startRow + 4} col B (notes) = "${record.cellH8}" and merged B:I`);
    } else {
      console.log(`→ SimpleEOD: WARNING - No {{notes}} delimiter found in B${startRow + 4}`);
    }
    
    // NEW: Replace guest count delimiters with actual data from dispatch
    // From the template analysis: {{num_adult}} at C25, {{num_chd}} at D25, {{num_comp}} at E25
    // In the replicated template: startRow=17, so guest counts are at startRow + 8 = 25
    
    // Replace {{num_adult}} in guest count cells (offset: startRow + 8)
    const adultCountCell = worksheet.getCell(startRow + 8, 3); // Column C
    if (adultCountCell.value && String(adultCountCell.value).includes('{{num_adult}}')) {
      adultCountCell.value = record.cellL8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 8} col C (num_adult) = ${record.cellL8}`);
    }
    
    // Replace {{num_chd}} in guest count cells (offset: startRow + 8)
    const childCountCell = worksheet.getCell(startRow + 8, 4); // Column D
    if (childCountCell.value && String(childCountCell.value).includes('{{num_chd}}')) {
      childCountCell.value = record.cellM8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 8} col D (num_chd) = ${record.cellM8}`);
    }
    
    // Replace {{num_comp}} in guest count cells (offset: startRow + 8)
    const compCountCell = worksheet.getCell(startRow + 8, 5); // Column E
    if (compCountCell.value && String(compCountCell.value).includes('{{num_comp}}')) {
      compCountCell.value = record.cellN8 || 0;
      console.log(`→ SimpleEOD: Set row ${startRow + 8} col E (num_comp) = ${record.cellN8}`);
    }
  }

  /**
   * Apply total count delimiters to the EOD template
   */
  private applyTotalDelimiters(worksheet: ExcelJS.Worksheet, totalAdults: number, totalChildren: number, totalComp: number): void {
    // Find and replace {{total_adult}}, {{total_chd}}, {{total_comp}} delimiters
    worksheet.eachRow((row, rowNumber) => {
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
    });
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