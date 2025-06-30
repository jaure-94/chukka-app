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
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Extract data from dispatch file to fill EOD template
   */
  extractDispatchData(dispatchData: ParsedExcelData): EODTemplateData {
    const tours: TourData[] = [];
    let totalAdult = 0;
    let totalChild = 0;

    // Process each sheet in the dispatch file
    for (const sheet of dispatchData.sheets) {
      console.log(`Processing sheet: ${sheet.name}`);
      
      // Look for tour data in the sheet
      for (const row of sheet.data) {
        // Check if this row contains tour information
        const tourName = this.extractTourName(row);
        const adultCount = this.extractAdultCount(row);
        const childCount = this.extractChildCount(row);

        if (tourName && (adultCount > 0 || childCount > 0)) {
          // Check if we already have this tour
          const existingTourIndex = tours.findIndex(t => t.tour_name === tourName);
          
          if (existingTourIndex >= 0) {
            // Add to existing tour
            tours[existingTourIndex].num_adult += adultCount;
            tours[existingTourIndex].num_chd += childCount;
          } else {
            // Create new tour entry
            tours.push({
              tour_name: tourName,
              num_adult: adultCount,
              num_chd: childCount
            });
          }
          
          totalAdult += adultCount;
          totalChild += childCount;
        }
      }
    }

    console.log(`Extracted ${tours.length} unique tours`);
    console.log(`Total adults: ${totalAdult}, Total children: ${totalChild}`);

    return {
      tours,
      total_adult: totalAdult,
      total_chd: totalChild
    };
  }

  private extractTourName(row: Record<string, any>): string | null {
    // Look for tour name in various possible column names
    const possibleColumns = ['tour_name', 'Tour Name', 'Tour', 'Product', 'tour', 'TOUR', 'Product Name'];
    
    for (const col of possibleColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
        return row[col].trim();
      }
    }
    
    return null;
  }

  private extractAdultCount(row: Record<string, any>): number {
    // Look for adult count in various possible column names
    const possibleColumns = ['num_adult', 'Adult', 'Adults', 'ADT', 'adult', 'ADULT', 'Num Adult'];
    
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
    // Look for child count in various possible column names
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
   * Process EOD template file with dispatch data using xlsx-populate for formatting preservation
   */
  async processEODTemplate(
    eodTemplatePath: string,
    dispatchData: ParsedExcelData,
    outputPath: string
  ): Promise<string> {
    try {
      // Extract data from dispatch file
      const templateData = this.extractDispatchData(dispatchData);

      console.log('Reading EOD template file from:', eodTemplatePath);
      
      if (!fs.existsSync(eodTemplatePath)) {
        throw new Error(`EOD template file not found: ${eodTemplatePath}`);
      }
      
      // Load workbook with xlsx-populate to preserve formatting
      const workbook = await XlsxPopulate.fromFileAsync(eodTemplatePath);
      const sheet = workbook.sheet(0); // Get first sheet
      
      console.log(`Found ${templateData.tours.length} tours to process`);
      console.log('Using xlsx-populate for complete formatting preservation');

      // Define template section rows (17-25 in Excel, 17-25 in xlsx-populate)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1;

      // Store the original template section with full formatting
      const templateSection: any[] = [];
      for (let row = templateStartRow; row <= templateEndRow; row++) {
        const rowData: any = {};
        // Store cells from columns A to I (1-9)
        for (let col = 1; col <= 9; col++) {
          const cell = sheet.cell(row, col);
          try {
            const cellStyle = cell.style();
            rowData[col] = {
              value: cell.value(),
              style: cellStyle && typeof cellStyle === 'object' ? cellStyle : null
            };
          } catch (error) {
            // If style reading fails, just store the value
            rowData[col] = {
              value: cell.value(),
              style: null
            };
          }
        }
        templateSection.push(rowData);
      }

      // Clear existing content below template section - simplified approach
      for (let row = templateEndRow + 1; row <= 100; row++) {
        for (let col = 1; col <= 9; col++) {
          try {
            sheet.cell(row, col).clear();
          } catch (error) {
            // Ignore errors for empty cells
          }
        }
      }

      // Create sections for each tour with preserved formatting
      let currentRow = templateStartRow;
      
      for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
        const tour = templateData.tours[tourIndex];
        console.log(`Creating formatted section for tour ${tourIndex + 1}: ${tour.tour_name}`);
        
        // Copy template section with all formatting preserved
        for (let templateRowIndex = 0; templateRowIndex < templateRowCount; templateRowIndex++) {
          const targetRow = currentRow + templateRowIndex;
          const templateRowData = templateSection[templateRowIndex];
          
          for (let col = 1; col <= 9; col++) {
            if (templateRowData[col]) {
              const targetCell = sheet.cell(targetRow, col);
              
              // Get original value and replace placeholders
              let cellValue = templateRowData[col].value;
              
              // Replace placeholders with actual data
              if (cellValue === '{{tour_name}}') {
                cellValue = tour.tour_name;
                console.log(`Replaced {{tour_name}} with "${tour.tour_name}" at row ${targetRow}, col ${col}`);
              } else if (cellValue === '{{num_adult}}') {
                cellValue = tour.num_adult;
                console.log(`Replaced {{num_adult}} with "${tour.num_adult}" at row ${targetRow}, col ${col}`);
              } else if (cellValue === '{{num_chd}}') {
                cellValue = tour.num_chd;
                console.log(`Replaced {{num_chd}} with "${tour.num_chd}" at row ${targetRow}, col ${col}`);
              }
              
              // Set the value (xlsx-populate should preserve existing formatting automatically)
              targetCell.value(cellValue);
              console.log(`Set value "${cellValue}" for cell at row ${targetRow}, col ${col}`);
              
              // Try to apply style if available
              try {
                if (templateRowData[col].style && typeof templateRowData[col].style === 'object') {
                  targetCell.style(templateRowData[col].style);
                  console.log(`Applied formatting to cell at row ${targetRow}, col ${col}`);
                }
              } catch (styleError) {
                const errorMessage = styleError instanceof Error ? styleError.message : String(styleError);
                console.log(`Could not apply style to cell at row ${targetRow}, col ${col}:`, errorMessage);
              }
            }
          }
        }
        
        // Move to next tour section
        currentRow += templateRowCount;
      }

      // Update total calculations in cells D24 and E24 with preserved formatting
      const totalAdultCell = sheet.cell(24, 4); // D24
      const totalChildCell = sheet.cell(24, 5); // E24
      
      totalAdultCell.value(templateData.total_adult);
      totalChildCell.value(templateData.total_chd);
      
      console.log(`Updated totals with formatting - Adults: ${templateData.total_adult}, Children: ${templateData.total_chd}`);

      // Save the processed workbook with complete formatting preservation
      console.log(`Saving processed file with complete formatting to: ${outputPath}`);
      await workbook.toFileAsync(outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error processing EOD template with xlsx-populate:', error);
      throw new Error(`Failed to process EOD template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}