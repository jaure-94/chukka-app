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
   * Process EOD template file with dispatch data using ExcelJS for complete formatting preservation
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
      
      // Load workbook with ExcelJS to preserve formatting
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(eodTemplatePath);
      
      const worksheet = workbook.getWorksheet(1); // Get first worksheet
      if (!worksheet) {
        throw new Error('No worksheet found in template file');
      }
      
      console.log(`Found ${templateData.tours.length} tours to process`);
      console.log('Using ExcelJS for complete formatting preservation');

      // Define template section rows (17-25 in Excel)
      const templateStartRow = 17;
      const templateEndRow = 25;
      const templateRowCount = templateEndRow - templateStartRow + 1;

      // Store the template section for cloning
      const templateRows: any[] = [];
      for (let rowNum = templateStartRow; rowNum <= templateEndRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        templateRows.push({
          rowNum,
          values: row.values,
          style: {
            height: row.height,
            hidden: row.hidden,
            outlineLevel: row.outlineLevel
          },
          cells: []
        });
        
        // Store cell formatting for columns A-I (1-9)
        for (let colNum = 1; colNum <= 9; colNum++) {
          const cell = row.getCell(colNum);
          templateRows[templateRows.length - 1].cells.push({
            colNum,
            value: cell.value,
            style: cell.style,
            dataValidation: cell.dataValidation,
            note: cell.note
          });
        }
      }

      console.log(`Stored template section with ${templateRows.length} rows and complete formatting`);

      // Clear content below template section
      for (let rowNum = templateEndRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        for (let colNum = 1; colNum <= 9; colNum++) {
          row.getCell(colNum).value = null;
        }
      }

      // Create sections for each tour with preserved formatting
      let currentRow = templateStartRow;
      
      for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
        const tour = templateData.tours[tourIndex];
        console.log(`Creating formatted section for tour ${tourIndex + 1}: ${tour.tour_name}`);
        
        // Copy template rows with complete formatting for each tour
        for (let templateRowIndex = 0; templateRowIndex < templateRowCount; templateRowIndex++) {
          const targetRowNum = currentRow + templateRowIndex;
          const templateRowData = templateRows[templateRowIndex];
          const targetRow = worksheet.getRow(targetRowNum);
          
          // Copy row-level formatting
          targetRow.height = templateRowData.style.height;
          targetRow.hidden = templateRowData.style.hidden;
          targetRow.outlineLevel = templateRowData.style.outlineLevel;
          
          // Copy cells with complete formatting
          for (const cellData of templateRowData.cells) {
            const targetCell = targetRow.getCell(cellData.colNum);
            
            // Get the value and replace placeholders
            let cellValue = cellData.value;
            
            if (cellValue === '{{tour_name}}') {
              cellValue = tour.tour_name;
              console.log(`Replaced {{tour_name}} with "${tour.tour_name}" at row ${targetRowNum}, col ${cellData.colNum}`);
            } else if (cellValue === '{{num_adult}}') {
              cellValue = tour.num_adult;
              console.log(`Replaced {{num_adult}} with "${tour.num_adult}" at row ${targetRowNum}, col ${cellData.colNum}`);
            } else if (cellValue === '{{num_chd}}') {
              cellValue = tour.num_chd;
              console.log(`Replaced {{num_chd}} with "${tour.num_chd}" at row ${targetRowNum}, col ${cellData.colNum}`);
            }
            
            // Set value and preserve all formatting
            targetCell.value = cellValue;
            targetCell.style = { ...cellData.style }; // Deep copy style
            if (cellData.dataValidation) targetCell.dataValidation = cellData.dataValidation;
            if (cellData.note) targetCell.note = cellData.note;
            
            console.log(`Applied complete formatting to cell ${targetRowNum},${cellData.colNum}`);
          }
        }
        
        // Move to next tour section
        currentRow += templateRowCount;
      }

      // Update total calculations in cells D24 and E24 with preserved formatting
      const totalAdultCell = worksheet.getCell(24, 4); // D24
      const totalChildCell = worksheet.getCell(24, 5); // E24
      
      totalAdultCell.value = templateData.total_adult;
      totalChildCell.value = templateData.total_chd;
      
      console.log(`Updated totals with formatting - Adults: ${templateData.total_adult}, Children: ${templateData.total_chd}`);

      // Save the processed workbook with complete formatting preservation
      console.log(`Saving processed file with ExcelJS formatting to: ${outputPath}`);
      await workbook.xlsx.writeFile(outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error processing EOD template with ExcelJS:', error);
      throw new Error(`Failed to process EOD template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}