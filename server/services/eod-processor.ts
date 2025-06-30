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

    // Search through all sheets for the required data
    for (const sheet of dispatchData.sheets) {
      for (const row of sheet.data) {
        // Look for tour name (common field names)
        const tourFields = ['Tour Name', 'tour_name', 'Tour', 'TourName', 'Product', 'Activity'];
        for (const field of tourFields) {
          if (row[field] && !tour_name) {
            tour_name = String(row[field]).trim();
            break;
          }
        }

        // Look for adult count
        const adultFields = ['Adults', 'Adult', 'num_adult', 'Adult Count', 'AdultCount', 'Pax Adult'];
        for (const field of adultFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            num_adult += value;
          }
        }

        // Look for children count
        const childFields = ['Children', 'Child', 'num_chd', 'Children Count', 'ChildCount', 'Pax Child', 'Kids'];
        for (const field of childFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            num_chd += value;
          }
        }
      }
    }

    return {
      tour_name,
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
              
              // Replace placeholders
              cellValue = cellValue.replace(/\{\{tour_name\}\}/g, templateData.tour_name);
              cellValue = cellValue.replace(/\{\{num_adult\}\}/g, templateData.num_adult.toString());
              cellValue = cellValue.replace(/\{\{num_chd\}\}/g, templateData.num_chd.toString());
              
              // Update cell if changes were made
              if (cellValue !== cell.v) {
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