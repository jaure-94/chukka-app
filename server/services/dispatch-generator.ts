import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import type { DispatchRecord } from "@shared/schema";

export class DispatchGenerator {
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a dispatch Excel file from stored template and records
   */
  async generateDispatchFile(
    templatePath: string,
    records: DispatchRecord[],
    outputPath: string
  ): Promise<string> {
    try {
      console.log(`Loading dispatch template from: ${templatePath}`);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Dispatch template file not found: ${templatePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('No worksheet found in dispatch template file');
      }

      console.log(`Adding ${records.length} dispatch records to template`);

      // Find the first empty row (assuming headers start at row 1)
      let currentRow = 2; // Start from row 2 (assuming row 1 has headers)
      
      // Find where data should start by looking for existing data
      while (currentRow <= 1000) { // Safety limit
        const cell = worksheet.getCell(currentRow, 1);
        if (!cell.value || cell.value.toString().trim() === '') {
          break;
        }
        currentRow++;
      }

      console.log(`Starting to add records at row ${currentRow}`);

      // Add each record to the worksheet
      for (const record of records) {
        // Column mapping based on typical dispatch file structure
        // Adjust these column indices based on your actual template structure
        worksheet.getCell(currentRow, 1).value = record.tourName; // Tour Name
        worksheet.getCell(currentRow, 2).value = record.numAdult; // Adult Count  
        worksheet.getCell(currentRow, 3).value = record.numChild; // Child Count
        worksheet.getCell(currentRow, 4).value = record.notes || ''; // Notes
        worksheet.getCell(currentRow, 5).value = record.createdAt; // Date/Time

        console.log(`  → Added record: ${record.tourName} (${record.numAdult} adults, ${record.numChild} children)`);
        currentRow++;
      }

      // Save the updated dispatch file
      console.log(`Saving dispatch file to: ${outputPath}`);
      await workbook.xlsx.writeFile(outputPath);
      
      console.log('Dispatch file generation completed successfully');
      return outputPath;
      
    } catch (error) {
      console.error('Dispatch file generation failed:', error);
      throw new Error(`Dispatch file generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a proper ParsedExcelData structure from dispatch records
   * This allows us to reuse the existing EOD processor
   */
  createParsedDataFromRecords(records: DispatchRecord[]) {
    const data = records.map(record => ({
      'Tour': record.tourName,
      'tour_name': record.tourName,
      'Adult': record.numAdult,
      'num_adult': record.numAdult,
      'Child': record.numChild,
      'Children': record.numChild,
      'num_chd': record.numChild,
      'Notes': record.notes || '',
      'notes': record.notes || '',
      'Comments': record.notes || '',
      'Remarks': record.notes || '',
    }));

    return {
      sheets: [{
        name: 'Dispatch Data',
        data: data,
        columns: ['Tour', 'Adult', 'Child', 'Notes']
      }]
    };
  }
}