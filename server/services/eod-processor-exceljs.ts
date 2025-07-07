import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import type { ParsedExcelData } from "./excel-parser";

export interface TourData {
  tour_name: string;
  num_adult: number;
  num_chd: number;
  notes: string;
  departure_time: string;
}

export interface EODTemplateData {
  tours: TourData[];
  total_adult: number;
  total_chd: number;
}

export class EODProcessor {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  extractDispatchData(dispatchData: ParsedExcelData): EODTemplateData {
    const tours: TourData[] = [];
    let totalAdults = 0;
    let totalChildren = 0;

    console.log(`→ EOD: Processing ${dispatchData.sheets.length} sheets for EOD data extraction`);

    for (const sheet of dispatchData.sheets) {
      console.log(`→ EOD: Processing sheet: ${sheet.name} with ${sheet.data.length} rows`);
      
      // Debug: Show first few rows and available columns
      if (sheet.data.length > 0) {
        console.log(`→ EOD: Available columns in sheet "${sheet.name}":`, Object.keys(sheet.data[0]));
        console.log(`→ EOD: First row data:`, sheet.data[0]);
      }
      
      for (const row of sheet.data) {
        const tourName = this.extractTourName(row);
        if (tourName) {
          const adults = this.extractAdultCount(row);
          const children = this.extractChildCount(row);
          const notes = this.extractNotes(row);
          const departureTime = this.extractDepartureTime(row);
          
          console.log(`→ EOD: Found tour "${tourName}" with ${adults} adults, ${children} children, departure: ${departureTime}, notes: ${notes}`);
          
          if (adults > 0 || children > 0) {
            const existingTour = tours.find(t => t.tour_name === tourName);
            if (existingTour) {
              existingTour.num_adult += adults;
              existingTour.num_chd += children;
              // Combine notes if both exist
              if (notes && existingTour.notes) {
                existingTour.notes = existingTour.notes + '; ' + notes;
              } else if (notes) {
                existingTour.notes = notes;
              }
              // Update departure time if not already set
              if (departureTime && !existingTour.departure_time) {
                existingTour.departure_time = departureTime;
              }
            } else {
              tours.push({
                tour_name: tourName,
                num_adult: adults,
                num_chd: children,
                notes: notes,
                departure_time: departureTime
              });
            }
            
            totalAdults += adults;
            totalChildren += children;
          }
        }
      }
    }

    console.log(`Extracted ${tours.length} unique tours with ${totalAdults} adults and ${totalChildren} children`);
    
    return {
      tours,
      total_adult: totalAdults,
      total_chd: totalChildren
    };
  }

  private extractTourName(row: Record<string, any>): string | null {
    const possibleColumns = ['Tour Name', 'tour_name', 'Tour', 'TOUR', 'Product', 'Activity'];
    
    for (const col of possibleColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim().length > 0) {
        return row[col].trim();
      }
    }
    
    return null;
  }

  private extractAdultCount(row: Record<string, any>): number {
    const possibleColumns = ['Adults', 'num_adult', 'Adult', 'ADULT', 'adult', 'Num Adult'];
    
    for (const col of possibleColumns) {
      if (row[col] !== undefined && row[col] !== null) {
        const count = parseInt(row[col].toString());
        if (!isNaN(count) && count >= 0) {
          return count;
        }
      }
    }
    
    return 0;
  }

  private extractChildCount(row: Record<string, any>): number {
    const possibleColumns = ['Children', 'num_chd', 'Child', 'CHD', 'child', 'CHILD', 'Num Child'];
    
    for (const col of possibleColumns) {
      if (row[col] !== undefined && row[col] !== null) {
        const count = parseInt(row[col].toString());
        if (!isNaN(count) && count >= 0) {
          return count;
        }
      }
    }
    
    return 0;
  }

  private extractNotes(row: Record<string, any>): string {
    const possibleColumns = ['Notes', 'notes', 'NOTES', 'Note', 'note', 'NOTE', 'Comments', 'comments', 'COMMENTS', 'Comment', 'comment', 'COMMENT', 'Remarks', 'remarks', 'REMARKS', 'Incident, accident, cancellation etc.'];
    
    for (const col of possibleColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim().length > 0) {
        return row[col].trim();
      }
    }
    
    return '';
  }

  private extractDepartureTime(row: Record<string, any>): string {
    const possibleColumns = ['TOUR TIME + duration', 'Tour Time', 'Departure Time', 'departure_time', 'Departure', 'departure', 'DEPARTURE', 'Time'];
    
    for (const col of possibleColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim().length > 0) {
        return row[col].trim();
      }
    }
    
    return '';
  }

  async processEODTemplate(
    eodTemplatePath: string,
    dispatchData: ParsedExcelData,
    outputPath: string
  ): Promise<string> {
    try {
      const templateData = this.extractDispatchData(dispatchData);

      console.log('Loading EOD template with ExcelJS for complete formatting preservation');
      
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(eodTemplatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('No worksheet found in template file');
      }

      console.log(`Processing ${templateData.tours.length} tours with ExcelJS formatting preservation`);

      // First, remove all strike-through formatting from the entire document
      console.log('Removing strike-through formatting from entire document (rows 1-200)');
      for (let rowNum = 1; rowNum <= 200; rowNum++) {
        const row = worksheet.getRow(rowNum);
        for (let colNum = 1; colNum <= 20; colNum++) {
          const cell = row.getCell(colNum);
          if (cell.font && cell.font.strike) {
            const newFont = { ...cell.font };
            delete newFont.strike;
            cell.font = newFont;
            console.log(`  → Removed strike-through from cell ${rowNum},${colNum}`);
          }
        }
      }



      // Template section definition (rows 17-25)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1; // 9 rows

      // Store original template formatting and merged cells
      const templateFormatting: any[] = [];
      const templateMergedCells: any[] = [];
      
      // Store template merged cells information for later replication
      console.log('Analyzing template merged cells for replication');
      
      for (let rowNum = templateStartRow; rowNum <= templateEndRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData: any = {
          height: row.height,
          cells: {}
        };
        
        // Store formatting for each cell in the row
        for (let colNum = 1; colNum <= 20; colNum++) {
          const cell = row.getCell(colNum);
          rowData.cells[colNum] = {
            value: cell.value,
            style: {
              font: cell.font ? (() => {
                const cleanFont = { ...cell.font };
                // Remove strike-through from template formatting
                if (cleanFont.strike) {
                  delete cleanFont.strike;
                }
                return cleanFont;
              })() : undefined,
              fill: cell.fill ? { ...cell.fill } : undefined,
              border: cell.border ? { ...cell.border } : undefined,
              alignment: cell.alignment ? { ...cell.alignment } : undefined,
              numFmt: cell.numFmt
            }
          };
        }
        templateFormatting.push(rowData);
      }

      console.log('Stored complete template formatting for replication');

      // Clear existing content below template section
      for (let rowNum = templateEndRow + 1; rowNum <= 200; rowNum++) {
        const row = worksheet.getRow(rowNum);
        for (let colNum = 1; colNum <= 20; colNum++) {
          const cell = row.getCell(colNum);
          cell.value = null;
          cell.style = {};
        }
      }

      // Process each tour with complete formatting preservation
      for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
        const tour = templateData.tours[tourIndex];
        console.log(`\nProcessing tour ${tourIndex + 1}: ${tour.tour_name}`);
        
        let sectionStartRow: number;
        
        if (tourIndex === 0) {
          // First tour uses the existing template section
          sectionStartRow = templateStartRow;
        } else {
          // Create new sections by copying the template formatting
          sectionStartRow = templateEndRow + 1 + (tourIndex - 1) * templateRowCount;
          console.log(`Creating new section starting at row ${sectionStartRow}`);
          
          // Apply template formatting to new section
          for (let templateRowIndex = 0; templateRowIndex < templateRowCount; templateRowIndex++) {
            const targetRowNum = sectionStartRow + templateRowIndex;
            const templateRow = templateFormatting[templateRowIndex];
            const targetRow = worksheet.getRow(targetRowNum);
            
            // Set row height
            if (templateRow.height) {
              targetRow.height = templateRow.height;
            }
            
            // Apply formatting to each cell
            for (let colNum = 1; colNum <= 20; colNum++) {
              const templateCell = templateRow.cells[colNum];
              const targetCell = targetRow.getCell(colNum);
              
              // Copy value if it exists
              if (templateCell.value !== undefined && templateCell.value !== null) {
                targetCell.value = templateCell.value;
              }
              
              // Apply complete formatting (ensuring no strike-through)
              if (templateCell.style.font) {
                const cleanFont = { ...templateCell.style.font };
                if (cleanFont.strike) {
                  delete cleanFont.strike;
                }
                targetCell.font = cleanFont;
              }
              if (templateCell.style.fill) {
                targetCell.fill = templateCell.style.fill;
              }
              if (templateCell.style.border) {
                targetCell.border = templateCell.style.border;
              }
              if (templateCell.style.alignment) {
                targetCell.alignment = templateCell.style.alignment;
              }
              if (templateCell.style.numFmt) {
                targetCell.numFmt = templateCell.style.numFmt;
              }
            }
            
            console.log(`Applied complete formatting to row ${targetRowNum}`);
          }
        }
        
        // Replace placeholders and handle merged cells in the current section
        for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
          const currentRowNum = sectionStartRow + rowOffset;
          const currentRow = worksheet.getRow(currentRowNum);
          
          for (let colNum = 1; colNum <= 15; colNum++) {
            const cell = currentRow.getCell(colNum);
            const cellValue = cell.value;
            
            if (cellValue === '{{tour_name}}') {
              cell.value = tour.tour_name;
              
              // Merge cells B through I for tour name display
              try {
                worksheet.mergeCells(currentRowNum, 2, currentRowNum, 9); // B to I
                const mergedCell = worksheet.getCell(currentRowNum, 2);
                mergedCell.value = tour.tour_name;
                mergedCell.alignment = { horizontal: 'center', vertical: 'middle' };
                console.log(`  → Merged and set tour name "${tour.tour_name}" across B-I at row ${currentRowNum}`);
              } catch (mergeError) {
                console.log(`  → Tour name merge failed at row ${currentRowNum}, using single cell`);
                cell.value = tour.tour_name;
              }
              
            } else if (cellValue === '{{num_adult}}') {
              cell.value = tour.num_adult;
              console.log(`  → Replaced {{num_adult}} with ${tour.num_adult} at row ${currentRowNum}`);
            } else if (cellValue === '{{num_chd}}') {
              cell.value = tour.num_chd;
              console.log(`  → Replaced {{num_chd}} with ${tour.num_chd} at row ${currentRowNum}`);
            } else if (cellValue === '{{departure_time}}') {
              cell.value = tour.departure_time || '';
              console.log(`  → Replaced {{departure_time}} with "${tour.departure_time || '(no departure time)'}" at row ${currentRowNum}`);
            } else if (cellValue === '{{notes}}') {
              // Handle notes placeholder with merged cells - replace with actual notes data
              const notesText = tour.notes || '';
              // Calculate row height based on text length (approximately 15 chars per line)
              const estimatedLines = Math.max(1, Math.ceil(notesText.length / 80)); // 80 chars per line for merged cell
              const rowHeight = Math.max(20, estimatedLines * 15); // Minimum 20, then 15 per line
              
              try {
                worksheet.mergeCells(currentRowNum, 2, currentRowNum, 9); // B to I
                const mergedCell = worksheet.getCell(currentRowNum, 2);
                mergedCell.value = notesText;
                mergedCell.alignment = { 
                  horizontal: 'left', 
                  vertical: 'top',
                  wrapText: true 
                };
                mergedCell.font = {
                  color: { argb: 'FF003366' }, // Dark blue color
                  bold: false,
                  size: 11
                };
                
                // Set row height to accommodate wrapped text
                const notesRow = worksheet.getRow(currentRowNum);
                notesRow.height = rowHeight;
                
                console.log(`  → Merged and set notes "${tour.notes || '(no notes)'}" across B-I at row ${currentRowNum} with height ${rowHeight}`);
              } catch (mergeError) {
                console.log(`  → Notes merge failed at row ${currentRowNum}, using single cell`);
                cell.value = notesText;
                cell.alignment = { 
                  horizontal: 'left', 
                  vertical: 'top',
                  wrapText: true 
                };
                cell.font = {
                  color: { argb: 'FF003366' }, // Dark blue color
                  bold: false,
                  size: 11
                };
                
                // Set row height for single cell too
                const notesRow = worksheet.getRow(currentRowNum);
                notesRow.height = rowHeight;
              }
              
            } else if (typeof cellValue === 'string' && cellValue.toLowerCase().includes('comments') && cellValue.toLowerCase().includes('notes')) {
              // Handle comments/notes subheading with merged cells
              try {
                worksheet.mergeCells(currentRowNum, 2, currentRowNum, 9); // B to I
                const mergedCell = worksheet.getCell(currentRowNum, 2);
                mergedCell.value = cellValue;
                mergedCell.alignment = { horizontal: 'left', vertical: 'middle' };
                mergedCell.font = { bold: true };
                console.log(`  → Merged comments/notes subheading (left-aligned) across B-I at row ${currentRowNum}`);
              } catch (mergeError) {
                console.log(`  → Comments/notes merge failed at row ${currentRowNum}, using single cell`);
              }
            }
          }
        }
      }

      // Update total calculations in the original template position
      console.log(`\nUpdating totals: Adults=${templateData.total_adult}, Children=${templateData.total_chd}`);
      const totalAdultCell = worksheet.getCell(24, 4); // D24
      const totalChildCell = worksheet.getCell(24, 5); // E24
      
      totalAdultCell.value = templateData.total_adult;
      totalChildCell.value = templateData.total_chd;

      // Apply specific formatting cleanup to designated cells (after all tour processing)
      console.log('*** APPLYING FINAL CELL FORMATTING CLEANUP ***');
      const cellsToCleanup = [
        { row: 3, col: 5 },   // E3
        { row: 4, col: 5 },   // E4
        { row: 5, col: 5 },   // E5
        { row: 6, col: 5 },   // E6
        { row: 10, col: 6 },  // F10
        { row: 18, col: 4 },  // D18
        { row: 19, col: 4 },  // D19
        { row: 18, col: 5 },  // E18
        { row: 19, col: 5 },  // E19
        { row: 23, col: 4 },  // D23
        { row: 24, col: 4 },  // D24
        { row: 23, col: 5 },  // E23
        { row: 24, col: 5 },  // E24
        { row: 22, col: 9 },  // I22
        { row: 23, col: 9 },  // I23
        { row: 24, col: 9 },  // I24
      ];

      for (const cellInfo of cellsToCleanup) {
        const cell = worksheet.getCell(cellInfo.row, cellInfo.col);
        const cellAddress = `${String.fromCharCode(64 + cellInfo.col)}${cellInfo.row}`;
        
        console.log(`  → Processing cell ${cellAddress}, current value: "${cell.value}", current font:`, cell.font);
        
        // Apply clean formatting: remove strikethrough, italics, bold, and set dark blue color
        const currentFont = cell.font || {};
        cell.font = {
          name: currentFont.name || 'Calibri',
          size: currentFont.size || 11,
          color: { argb: 'FF003366' }, // Dark blue
          bold: false,
          italic: false,
          strike: false
        };
        
        console.log(`  → Applied clean formatting to cell ${cellAddress} - removed bold/italic/strike, set dark blue color`);
      }

      // Save the workbook with all formatting preserved
      console.log(`Saving formatted file to: ${outputPath}`);
      await workbook.xlsx.writeFile(outputPath);
      
      console.log('ExcelJS formatting preservation completed successfully');
      return outputPath;
      
    } catch (error) {
      console.error('EOD processing failed:', error);
      throw new Error(`EOD processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}