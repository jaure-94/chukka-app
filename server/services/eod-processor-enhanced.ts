import * as fs from "fs";
import * as path from "path";
import type { ParsedExcelData } from "./excel-parser";
import * as XlsxPopulate from "xlsx-populate";

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

export class EODProcessorEnhanced {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Extract data from dispatch file to fill EOD template
   */
  extractDispatchData(dispatchData: ParsedExcelData): EODTemplateData {
    const tours: TourData[] = [];
    let totalAdults = 0;
    let totalChildren = 0;

    // Process all sheets
    for (const sheet of dispatchData.sheets) {
      console.log(`Processing sheet: ${sheet.name}`);
      
      for (const row of sheet.data) {
        const tourName = this.extractTourName(row);
        if (tourName) {
          const adults = this.extractAdultCount(row);
          const children = this.extractChildCount(row);
          
          if (adults > 0 || children > 0) {
            // Check if this tour already exists, if so combine the counts
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

  /**
   * Enhanced processing with complete row-by-row formatting preservation
   */
  async processEODTemplate(
    eodTemplatePath: string,
    dispatchData: ParsedExcelData,
    outputPath: string
  ): Promise<string> {
    try {
      const templateData = this.extractDispatchData(dispatchData);

      console.log('Loading EOD template with xlsx-populate for complete formatting preservation');
      
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = await XlsxPopulate.fromFileAsync(eodTemplatePath);
      const sheet = workbook.sheet(0);
      
      console.log(`Processing ${templateData.tours.length} tours with enhanced formatting preservation`);

      // Template section definition (rows 17-25)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1; // 9 rows

      // Clear all content below the template section first
      console.log('Clearing existing content below template section');
      for (let row = templateEndRow + 1; row <= 200; row++) {
        for (let col = 1; col <= 20; col++) {
          try {
            sheet.cell(row, col).clear();
          } catch (error) {
            // Ignore clear errors
          }
        }
      }

      // Process each tour by completely duplicating the template section
      let currentSectionStart = templateStartRow;
      
      for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
        const tour = templateData.tours[tourIndex];
        console.log(`\nProcessing tour ${tourIndex + 1}: ${tour.tour_name}`);
        
        // For the first tour, we modify the existing template in place
        // For subsequent tours, we create new sections below
        if (tourIndex > 0) {
          currentSectionStart = templateEndRow + 1 + (tourIndex - 1) * templateRowCount;
          console.log(`Creating new section starting at row ${currentSectionStart}`);
          
          // Copy the entire template section with all formatting
          for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
            const sourceRow = templateStartRow + rowOffset;
            const targetRow = currentSectionStart + rowOffset;
            
            console.log(`Copying complete row ${sourceRow} -> ${targetRow} with all formatting`);
            
            // Copy all cells in the row (extending to column 20 to capture all formatting)
            for (let col = 1; col <= 20; col++) {
              const sourceCell = sheet.cell(sourceRow, col);
              const targetCell = sheet.cell(targetRow, col);
              
              // Get source cell properties
              const sourceValue = sourceCell.value();
              
              // Copy the value first
              if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                targetCell.value(sourceValue);
              }
              
              // Copy all formatting properties
              try {
                const sourceStyle = sourceCell.style();
                if (sourceStyle && typeof sourceStyle === 'object') {
                  targetCell.style(sourceStyle);
                }
              } catch (styleError) {
                console.log(`Style copy warning for row ${targetRow}, col ${col}:`, styleError);
              }
            }
          }
        }
        
        // Now replace placeholders in the current section
        const sectionStart = tourIndex === 0 ? templateStartRow : currentSectionStart;
        
        for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
          const currentRow = sectionStart + rowOffset;
          
          for (let col = 1; col <= 15; col++) {
            const cell = sheet.cell(currentRow, col);
            const cellValue = cell.value();
            
            if (cellValue === '{{tour_name}}') {
              cell.value(tour.tour_name);
              console.log(`  → Replaced {{tour_name}} with "${tour.tour_name}" at row ${currentRow}, col ${col}`);
            } else if (cellValue === '{{num_adult}}') {
              cell.value(tour.num_adult);
              console.log(`  → Replaced {{num_adult}} with "${tour.num_adult}" at row ${currentRow}, col ${col}`);
            } else if (cellValue === '{{num_chd}}') {
              cell.value(tour.num_chd);
              console.log(`  → Replaced {{num_chd}} with "${tour.num_chd}" at row ${currentRow}, col ${col}`);
            }
          }
        }
      }

      // Update total calculations in the original template position (D24, E24)
      console.log(`\nUpdating totals: Adults=${templateData.total_adult}, Children=${templateData.total_chd}`);
      sheet.cell(24, 4).value(templateData.total_adult); // D24
      sheet.cell(24, 5).value(templateData.total_chd);   // E24

      // Save the workbook with all formatting preserved
      console.log(`Saving enhanced formatted file to: ${outputPath}`);
      await workbook.toFileAsync(outputPath);
      
      console.log('Enhanced formatting preservation completed successfully');
      return outputPath;
      
    } catch (error) {
      console.error('Enhanced EOD processing failed:', error);
      throw new Error(`Enhanced EOD processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}