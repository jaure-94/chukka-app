import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import type { ParsedExcelData } from "./excel-parser";

export interface EODTemplateData {
  tour_name: string;
  num_adult: number;
  num_chd: number;
}

export class EODProcessor {
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
    let tour_name = "";
    let num_adult = 0;
    let num_chd = 0;
    const tourNames = new Set<string>();

    console.log('Extracting dispatch data from sheets:', dispatchData.sheets.map(s => s.name));

    // Search through all sheets for the required data
    for (const sheet of dispatchData.sheets) {
      console.log(`Processing sheet: ${sheet.name} with ${sheet.data.length} rows`);
      console.log('Available columns:', sheet.columns);

      for (const row of sheet.data) {
        // Look for tour name (exact match first, then variations)
        const tourFields = ['Tour Name', 'tour_name', 'Tour', 'TourName', 'Product', 'Activity'];
        for (const field of tourFields) {
          if (row[field] && String(row[field]).trim()) {
            const tourValue = String(row[field]).trim();
            tourNames.add(tourValue);
            if (!tour_name) {
              tour_name = tourValue;
            }
          }
        }

        // Look for adult count (exact match)
        const adultFields = ['Adults', 'Adult', 'num_adult', 'Adult Count', 'AdultCount', 'Pax Adult'];
        for (const field of adultFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            if (value > 0) {
              num_adult += value;
              console.log(`Found adults: ${value} from field: ${field}`);
            }
          }
        }

        // Look for children count (exact match)
        const childFields = ['Children', 'Child', 'num_chd', 'Children Count', 'ChildCount', 'Pax Child', 'Kids'];
        for (const field of childFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            if (value > 0) {
              num_chd += value;
              console.log(`Found children: ${value} from field: ${field}`);
            }
          }
        }
      }
    }

    // If multiple tour names, combine them
    if (tourNames.size > 1) {
      tour_name = Array.from(tourNames).join(', ');
    }

    console.log('Extracted data:', { tour_name, num_adult, num_chd });

    return {
      tour_name: tour_name || "Unknown Tour",
      num_adult,
      num_chd
    };
  }

  /**
   * Process EOD template file with dispatch data
   */
  async processEODTemplate(
    eodTemplatePath: string, 
    dispatchData: ParsedExcelData,
    outputFileName: string
  ): Promise<string> {
    try {
      // Extract data from dispatch file
      const templateData = this.extractDispatchData(dispatchData);

      // Read EOD template file
      const workbook = XLSX.readFile(eodTemplatePath);
      
      // Process each sheet in the template
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // Get the range of the worksheet
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        // Iterate through all cells and replace placeholders
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            
            if (cell && cell.v && typeof cell.v === 'string') {
              let cellValue = cell.v;
              const originalValue = cellValue;
              
              // Replace placeholders
              if (cellValue.includes('{{tour_name}}')) {
                console.log(`Found {{tour_name}} in cell ${cellAddress}, replacing with: ${templateData.tour_name}`);
                cellValue = cellValue.replace(/\{\{tour_name\}\}/g, templateData.tour_name);
              }
              if (cellValue.includes('{{num_adult}}')) {
                console.log(`Found {{num_adult}} in cell ${cellAddress}, replacing with: ${templateData.num_adult}`);
                cellValue = cellValue.replace(/\{\{num_adult\}\}/g, templateData.num_adult.toString());
              }
              if (cellValue.includes('{{num_chd}}')) {
                console.log(`Found {{num_chd}} in cell ${cellAddress}, replacing with: ${templateData.num_chd}`);
                cellValue = cellValue.replace(/\{\{num_chd\}\}/g, templateData.num_chd.toString());
              }
              
              // Update cell if changes were made
              if (cellValue !== originalValue) {
                console.log(`Cell ${cellAddress} updated: "${originalValue}" -> "${cellValue}"`);
                cell.v = cellValue;
                cell.w = cellValue; // Also update the formatted value
              }
            }
          }
        }
      }

      // Save the processed file
      const outputPath = path.join(this.outputDir, outputFileName);
      XLSX.writeFile(workbook, outputPath);

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to process EOD template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}