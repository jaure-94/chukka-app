import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import type { DispatchRecord } from "../../shared/schema.js";
import { blobStorage } from "./blob-storage.js";

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
    outputPath: string,
    shipId: string = 'ship-a'
  ): Promise<string> {
    try {
      console.log(`Loading dispatch template from: ${templatePath}`);
      
      const workbook = new ExcelJS.Workbook();
      if (blobStorage.isBlobUrl(templatePath)) {
        await workbook.xlsx.load(await blobStorage.downloadFile(templatePath));
      } else {
        if (!fs.existsSync(templatePath)) {
          throw new Error(`Dispatch template file not found: ${templatePath}`);
        }
        await workbook.xlsx.readFile(templatePath);
      }
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('No worksheet found in dispatch template file');
      }

      console.log(`Adding ${records.length} dispatch records to template`);

      // Populate template header fields if available in the first record
      if (records.length > 0) {
        const firstRecord = records[0];
        if (firstRecord.shipName) {
          worksheet.getCell('B1').value = firstRecord.shipName;
          console.log(`Set ship name at B1: ${firstRecord.shipName}`);
        }
        if (firstRecord.tourOperator) {
          worksheet.getCell('B2').value = firstRecord.tourOperator;
          console.log(`Set tour operator at B2: ${firstRecord.tourOperator}`);
        }
        if (firstRecord.shorexManager) {
          worksheet.getCell('B5').value = firstRecord.shorexManager;
          console.log(`Set shorex manager at B5: ${firstRecord.shorexManager}`);
        }
        if (firstRecord.shorexAsstManager) {
          worksheet.getCell('B6').value = firstRecord.shorexAsstManager;
          console.log(`Set shorex assistant manager at B6: ${firstRecord.shorexAsstManager}`);
        }
      }

      // Start from row 9 as per the dispatch template structure (where data begins)
      let currentRow = 9;
      
      console.log(`Starting to add records at row ${currentRow}`);

      // Store the formatting from the first data row (row 9) to use as template
      const templateRowIndex = 9;
      const templateRowFormatting: any[] = [];
      
      // Capture formatting from the template row 9 (first data row)
      for (let col = 1; col <= 8; col++) {
        const templateCell = worksheet.getCell(templateRowIndex, col);
        templateRowFormatting[col] = {
          font: templateCell.font ? { ...templateCell.font } : undefined,
          fill: templateCell.fill ? { ...templateCell.fill } : undefined,
          border: templateCell.border ? { ...templateCell.border } : undefined,
          alignment: templateCell.alignment ? { ...templateCell.alignment } : undefined,
          numFmt: templateCell.numFmt,
          style: templateCell.style ? { ...templateCell.style } : undefined
        };
      }

      console.log('Captured template formatting from row 9');

      // Add records to the dispatch file starting from row 9
      for (const record of records) {
        // Set values and apply preserved formatting to each cell
        const cells = [
          { col: 1, value: record.tourName },
          { col: 2, value: record.departure },
          { col: 3, value: record.returnTime },
          { col: 4, value: record.numAdult },
          { col: 5, value: record.numChild },
          { col: 6, value: record.comp },
          { col: 7, value: record.totalGuests },
          { col: 8, value: record.notes || '' }
        ];

        cells.forEach(({ col, value }) => {
          const cell = worksheet.getCell(currentRow, col);
          cell.value = value;
          
          // Apply the preserved formatting from template row
          const templateFormat = templateRowFormatting[col];
          if (templateFormat) {
            if (templateFormat.font) cell.font = templateFormat.font;
            if (templateFormat.fill) cell.fill = templateFormat.fill;
            if (templateFormat.border) cell.border = templateFormat.border;
            if (templateFormat.alignment) cell.alignment = templateFormat.alignment;
            if (templateFormat.numFmt) cell.numFmt = templateFormat.numFmt;
          }
        });

        console.log(`  → Added record with formatting: ${record.tourName} (${record.numAdult} adults, ${record.numChild} children)`);
        currentRow++;
      }

      // Save the updated dispatch file
      console.log(`Saving dispatch file to: ${outputPath}`);
      const useBlob = process.env.VERCEL === '1' || process.env.USE_BLOB === 'true';
      
      if (useBlob) {
        // Scope dispatch outputs by ship to avoid cross-ship collisions
        const blobKey = `output/${shipId}/dispatch_${Date.now()}.xlsx`;
        const blobUrl = await blobStorage.saveWorkbookToBlob(workbook, blobKey);
        console.log('Dispatch file generation completed successfully, saved to blob:', blobUrl);
        return blobUrl;
      } else {
        await workbook.xlsx.writeFile(outputPath);
        console.log('Dispatch file generation completed successfully');
        return outputPath;
      }
      
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