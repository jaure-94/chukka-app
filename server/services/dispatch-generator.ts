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

      // Start from row 9 as per the dispatch template structure (where data begins)
      let currentRow = 9;
      
      console.log(`Starting to add records at row ${currentRow}`);

      // Add records to the dispatch file starting from row 9
      for (const record of records) {
        // Set values directly in the appropriate columns based on headers:
        // Tour Name, Departure, Return, Adults, Children, Comp, Total Guests, Notes
        worksheet.getCell(currentRow, 1).value = record.tourName; // Tour Name
        worksheet.getCell(currentRow, 2).value = record.departure; // Departure
        worksheet.getCell(currentRow, 3).value = record.returnTime; // Return
        worksheet.getCell(currentRow, 4).value = record.numAdult; // Adults
        worksheet.getCell(currentRow, 5).value = record.numChild; // Children
        worksheet.getCell(currentRow, 6).value = record.comp; // Comp
        worksheet.getCell(currentRow, 7).value = record.totalGuests; // Total Guests
        worksheet.getCell(currentRow, 8).value = record.notes || ''; // Notes

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
      'Tour Name': record.tourName,
      'Adults': record.numAdult,
      'Children': record.numChild,
      'Notes': record.notes || '',
      // Include legacy column names for backward compatibility
      'Tour': record.tourName,
      'tour_name': record.tourName,
      'Adult': record.numAdult,
      'num_adult': record.numAdult,
      'Child': record.numChild,
      'num_chd': record.numChild,
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