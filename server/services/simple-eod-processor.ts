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
        if (mergeStart >= 23 && mergeEnd <= 44) {
          templateMergedCells.push(merge);
        }
      });
      
      for (let rowNum = 23; rowNum <= 44; rowNum++) {
        const row = worksheet.getRow(rowNum);
        templateRows.push(this.copyRowData(row));
      }
      
      console.log('→ SimpleEOD: Template section (rows 23-44) stored for replication including totals section');
      
      // Process each record
      for (let recordIndex = 0; recordIndex < multipleData.records.length; recordIndex++) {
        const record = multipleData.records[recordIndex];
        const startRow = 23 + (recordIndex * 23); // Each record takes 23 rows (23-44 + 1 blank row)
        
        console.log(`→ SimpleEOD: Processing record ${recordIndex + 1}: "${record.cellA8}" starting at row ${startRow}`);
        
        // Insert template rows for this record
        if (recordIndex > 0) {
          // Insert new rows for this record
          worksheet.spliceRows(startRow, 0, 23); // Insert 23 empty rows (22 for template + 1 blank)
          
          // Copy template data to new rows (first 22 rows are template, last row is blank)
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
          
          // Add blank row at the end (row 22 + 1 = 23rd row is blank)
          const blankRow = worksheet.getRow(startRow + templateRows.length);
          blankRow.height = 20; // Set a default height for the blank row
          
          // Copy merged cells for this record (safely)
          templateMergedCells.forEach(mergeRange => {
            const [startCell, endCell] = mergeRange.split(':');
            const startRowTemplate = parseInt(startCell.match(/\d+/)[0]);
            const endRowTemplate = parseInt(endCell.match(/\d+/)[0]);
            
            // Calculate offset for new record
            const rowOffset = recordIndex * 23;
            
            const newMergeRange = mergeRange.replace(/\d+/g, (match) => {
              const rowNum = parseInt(match);
              return (rowNum + rowOffset).toString();
            });
            
            this.safeMergeCells(worksheet, newMergeRange);
          });
        }
        
        // Apply delimiter replacements for this record
        this.applyDelimiterReplacements(worksheet, record, startRow);
        
        // Also search for {{notes}} in the entire worksheet (not just the replicated section)
        this.searchAndReplaceNotesGlobally(worksheet, record.cellH8);
        
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
    
    // Search through the entire template section (22 rows: 23-44) for delimiters
    for (let rowOffset = 0; rowOffset < 22; rowOffset++) {
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