import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import type { ParsedExcelData } from "./excel-parser";

export interface TourData {
  tour_name: string;
  num_adult: number;
  num_chd: number;
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

    for (const sheet of dispatchData.sheets) {
      console.log(`Processing sheet: ${sheet.name}`);
      
      for (const row of sheet.data) {
        const tourName = this.extractTourName(row);
        if (tourName) {
          const adults = this.extractAdultCount(row);
          const children = this.extractChildCount(row);
          
          if (adults > 0 || children > 0) {
            const existingTour = tours.find(t => t.tour_name === tourName);
            if (existingTour) {
              existingTour.num_adult += adults;
              existingTour.num_chd += children;
            } else {
              tours.push({
                tour_name: tourName,
                num_adult: adults,
                num_chd: children
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
    const possibleColumns = ['tour_name', 'Tour', 'Tour Name', 'TOUR', 'Product', 'Activity'];
    
    for (const col of possibleColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim().length > 0) {
        return row[col].trim();
      }
    }
    
    return null;
  }

  private extractAdultCount(row: Record<string, any>): number {
    const possibleColumns = ['num_adult', 'Adult', 'Adults', 'ADULT', 'adult', 'Num Adult'];
    
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
    const possibleColumns = ['num_chd', 'Child', 'Children', 'CHD', 'child', 'CHILD', 'Num Child'];
    
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

      // Template section definition (rows 17-25)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1; // 9 rows

      // Store original template formatting and merged cell information
      const templateFormatting: any[] = [];
      const mergedCells: any[] = [];
      
      // Capture existing merged cells in template section
      if (worksheet.model && worksheet.model.merges) {
        worksheet.model.merges.forEach((merge: any) => {
          const mergeObj = {
            top: merge.top,
            left: merge.left,
            bottom: merge.bottom,
            right: merge.right
          };
          
          // Only include merges within our template section
          if (mergeObj.top >= templateStartRow && mergeObj.bottom <= templateEndRow) {
            mergedCells.push(mergeObj);
            console.log(`Found merged cells in template: rows ${mergeObj.top}-${mergeObj.bottom}, cols ${mergeObj.left}-${mergeObj.right}`);
          }
        });
      } else {
        console.log('No merged cells found in template or worksheet.model.merges not available');
      }
      
      for (let rowNum = templateStartRow; rowNum <= templateEndRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData: any = {
          height: row.height,
          cells: {},
          rowNumber: rowNum
        };
        
        // Store formatting for each cell in the row
        for (let colNum = 1; colNum <= 20; colNum++) {
          const cell = row.getCell(colNum);
          rowData.cells[colNum] = {
            value: cell.value,
            style: {
              font: cell.font ? { ...cell.font } : undefined,
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
              
              // Apply complete formatting
              if (templateCell.style.font) {
                targetCell.font = templateCell.style.font;
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
          
          // Apply merged cells for this new section
          mergedCells.forEach(merge => {
            const rowOffset = sectionStartRow - templateStartRow;
            const newTop = merge.top + rowOffset;
            const newBottom = merge.bottom + rowOffset;
            
            try {
              // Merge the cells in the new section
              worksheet.mergeCells(newTop, merge.left, newBottom, merge.right);
              console.log(`Applied merged cells to new section: rows ${newTop}-${newBottom}, cols ${merge.left}-${merge.right}`);
            } catch (mergeError) {
              console.log(`Failed to merge cells in new section: ${mergeError}`);
            }
          });
        }
        
        // Replace placeholders in the current section (improved logic for merged cells)
        for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
          const currentRowNum = sectionStartRow + rowOffset;
          const currentRow = worksheet.getRow(currentRowNum);
          
          for (let colNum = 1; colNum <= 15; colNum++) {
            const cell = currentRow.getCell(colNum);
            const cellValue = cell.value;
            
            // Check if this cell is part of a merged range
            const mergeInfo = mergedCells.find(merge => {
              const mergeTop = sectionStartRow + (merge.top - templateStartRow);
              const mergeBottom = sectionStartRow + (merge.bottom - templateStartRow);
              const rowInRange = currentRowNum >= mergeTop && currentRowNum <= mergeBottom;
              const colInRange = colNum >= merge.left && colNum <= merge.right;
              return rowInRange && colInRange;
            });
            
            if (mergeInfo) {
              // This cell is part of a merged range
              const mergeTop = sectionStartRow + (mergeInfo.top - templateStartRow);
              const mergeLeft = mergeInfo.left;
              const isTopLeftOfMerge = currentRowNum === mergeTop && colNum === mergeLeft;
              
              if (isTopLeftOfMerge) {
                // Only replace placeholders in the top-left cell of merged ranges
                if (cellValue === '{{tour_name}}') {
                  cell.value = tour.tour_name;
                  console.log(`  → Replaced {{tour_name}} with "${tour.tour_name}" at merged cell top-left ${currentRowNum},${colNum}`);
                } else if (cellValue === '{{notes}}') {
                  cell.value = ''; // Keep notes empty or add tour-specific notes
                  console.log(`  → Cleared {{notes}} placeholder at merged cell top-left ${currentRowNum},${colNum}`);
                }
              } else {
                // Clear any placeholders from non-top-left cells in merged range
                if (cellValue && typeof cellValue === 'string' && cellValue.includes('{{')) {
                  cell.value = '';
                  console.log(`  → Cleared duplicate placeholder from merged cell ${currentRowNum},${colNum}`);
                }
              }
            } else {
              // This cell is not merged, replace placeholders normally
              if (cellValue === '{{tour_name}}') {
                cell.value = tour.tour_name;
                console.log(`  → Replaced {{tour_name}} with "${tour.tour_name}" at row ${currentRowNum}`);
              } else if (cellValue === '{{num_adult}}') {
                cell.value = tour.num_adult;
                console.log(`  → Replaced {{num_adult}} with ${tour.num_adult} at row ${currentRowNum}`);
              } else if (cellValue === '{{num_chd}}') {
                cell.value = tour.num_chd;
                console.log(`  → Replaced {{num_chd}} with ${tour.num_chd} at row ${currentRowNum}`);
              } else if (cellValue === '{{notes}}') {
                cell.value = '';
                console.log(`  → Cleared {{notes}} placeholder at row ${currentRowNum}`);
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