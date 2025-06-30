import XlsxPopulate from "xlsx-populate";
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
      console.log('Loading EOD template for formatting preservation');
      
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      const workbook = await XlsxPopulate.fromFileAsync(eodTemplatePath);
      const sheet = workbook.sheet(0);
      
      console.log(`Processing ${templateData.tours.length} tours with xlsx-populate formatting`);

      // Define template section (rows 17-25)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1;

      // Store template formatting before making changes
      const templateFormats: any[][] = [];
      console.log('Capturing template formatting from rows 17-25');
      
      for (let row = templateStartRow; row <= templateEndRow; row++) {
        const rowFormats: any[] = [];
        for (let col = 1; col <= 15; col++) {
          const cell = sheet.cell(row, col);
          try {
            const cellStyle = cell.style();
            const cellValue = cell.value();
            rowFormats.push({
              style: cellStyle,
              value: cellValue,
              hasContent: cellValue !== undefined && cellValue !== null && cellValue !== ''
            });
          } catch (error) {
            rowFormats.push({ style: null, value: null, hasContent: false });
          }
        }
        templateFormats.push(rowFormats);
      }

      // Clear existing content below template
      for (let row = templateEndRow + 1; row <= 200; row++) {
        for (let col = 1; col <= 15; col++) {
          try {
            sheet.cell(row, col).clear();
          } catch (error) {
            // Continue
          }
        }
      }

      // Process each tour
      for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
        const tour = templateData.tours[tourIndex];
        console.log(`\nProcessing tour ${tourIndex + 1}: ${tour.tour_name}`);
        
        let sectionStartRow: number;
        
        if (tourIndex === 0) {
          // First tour modifies existing template
          sectionStartRow = templateStartRow;
        } else {
          // Create new section by copying template formatting
          sectionStartRow = templateEndRow + 1 + (tourIndex - 1) * templateRowCount;
          console.log(`Creating new section at row ${sectionStartRow}`);
          
          // Apply stored template formatting to new section
          for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
            const targetRow = sectionStartRow + rowOffset;
            const templateRowFormats = templateFormats[rowOffset];
            
            for (let col = 1; col <= 15; col++) {
              const targetCell = sheet.cell(targetRow, col);
              const templateFormat = templateRowFormats[col - 1];
              
              if (templateFormat) {
                // Apply value if template had content (preserve placeholders for replacement)
                if (templateFormat.hasContent) {
                  targetCell.value(templateFormat.value);
                }
                
                // Apply formatting
                if (templateFormat.style && typeof templateFormat.style === 'object') {
                  try {
                    targetCell.style(templateFormat.style);
                  } catch (styleError) {
                    // Continue if individual style fails
                  }
                }
              }
            }
          }
        }
        
        // Replace placeholders in current section with enhanced debugging
        console.log(`  Searching for placeholders in section rows ${sectionStartRow} to ${sectionStartRow + templateRowCount - 1}`);
        
        for (let rowOffset = 0; rowOffset < templateRowCount; rowOffset++) {
          const currentRow = sectionStartRow + rowOffset;
          
          for (let col = 1; col <= 15; col++) {
            const cell = sheet.cell(currentRow, col);
            const cellValue = cell.value();
            
            // Debug: log all cell values to see what we're working with
            if (cellValue && typeof cellValue === 'string' && cellValue.includes('{{')) {
              console.log(`  Found potential placeholder "${cellValue}" at row ${currentRow}, col ${col}`);
            }
            
            if (cellValue === '{{tour_name}}') {
              cell.value(tour.tour_name);
              console.log(`  → Replaced {{tour_name}} with "${tour.tour_name}" at row ${currentRow}, col ${col}`);
            } else if (cellValue === '{{num_adult}}') {
              cell.value(tour.num_adult);
              console.log(`  → Replaced {{num_adult}} with ${tour.num_adult} at row ${currentRow}, col ${col}`);
            } else if (cellValue === '{{num_chd}}') {
              cell.value(tour.num_chd);
              console.log(`  → Replaced {{num_chd}} with ${tour.num_chd} at row ${currentRow}, col ${col}`);
            }
          }
        }
      }

      // Update totals
      console.log(`\nUpdating totals: Adults=${templateData.total_adult}, Children=${templateData.total_chd}`);
      sheet.cell(24, 4).value(templateData.total_adult);
      sheet.cell(24, 5).value(templateData.total_chd);

      // Save with formatting preserved
      console.log(`Saving file with preserved formatting to: ${outputPath}`);
      await workbook.toFileAsync(outputPath);
      
      console.log('EOD processing completed with formatting preservation');
      return outputPath;
      
    } catch (error) {
      console.error('EOD processing failed:', error);
      throw new Error(`EOD processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}