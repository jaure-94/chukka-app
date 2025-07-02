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

      // Find the template row with placeholders to understand the structure
      let templateRow = 1;
      let foundTemplate = false;
      
      // Look for the template row with placeholders (typically row 9 based on logs)
      for (let row = 1; row <= 20; row++) {
        const cell = worksheet.getCell(row, 1);
        if (cell.value && cell.value.toString().includes('{{tour_name}}')) {
          templateRow = row;
          foundTemplate = true;
          console.log(`Found template row at: ${row}`);
          break;
        }
      }

      if (foundTemplate) {
        // Replace placeholders in template row with actual data
        for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
          const record = records[recordIndex];
          const targetRow = templateRow + recordIndex;
          
          // If this is not the first record, copy the template row
          if (recordIndex > 0) {
            worksheet.duplicateRow(templateRow, targetRow, true);
          }
          
          // Replace placeholders in the current row
          for (let col = 1; col <= 8; col++) { // Assuming 8 columns based on headers
            const cell = worksheet.getCell(targetRow, col);
            if (cell.value && typeof cell.value === 'string') {
              let cellValue = cell.value;
              
              // Replace all placeholders
              cellValue = cellValue.replace(/\{\{tour_name\}\}/g, record.tourName || '');
              cellValue = cellValue.replace(/\{\{departure_time\}\}/g, record.departure || '');
              cellValue = cellValue.replace(/\{\{return_time\}\}/g, record.returnTime || '');
              cellValue = cellValue.replace(/\{\{num_adult\}\}/g, record.numAdult?.toString() || '0');
              cellValue = cellValue.replace(/\{\{num_chd\}\}/g, record.numChild?.toString() || '0');
              cellValue = cellValue.replace(/\{\{comp\}\}/g, record.comp?.toString() || '0');
              cellValue = cellValue.replace(/\{\{total_guests\}\}/g, record.totalGuests?.toString() || '0');
              cellValue = cellValue.replace(/\{\{notes\}\}/g, record.notes || '');
              
              cell.value = cellValue;
            }
          }

          console.log(`  → Added record: ${record.tourName} (${record.numAdult} adults, ${record.numChild} children)`);
        }
      } else {
        // Fallback: Add records to a new row without template
        console.log('No template placeholders found, adding records directly');
        for (const record of records) {
          // Based on header structure: Tour Name, Departure, Return, Adults, Children, Comp, Total Guests, Notes
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