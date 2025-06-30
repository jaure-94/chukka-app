import XLSX from "xlsx";
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

  /**
   * Extract data from dispatch file to fill EOD template
   */
  extractDispatchData(dispatchData: ParsedExcelData): EODTemplateData {
    const tourMap = new Map<string, TourData>();
    let total_adult = 0;
    let total_chd = 0;

    console.log('Extracting dispatch data from sheets:', dispatchData.sheets.map(s => s.name));

    // Search through all sheets for the required data
    for (const sheet of dispatchData.sheets) {
      console.log(`Processing sheet: ${sheet.name} with ${sheet.data.length} rows`);
      console.log('Available columns:', sheet.columns);

      for (const row of sheet.data) {
        let tourName = "";
        let adults = 0;
        let children = 0;

        // Look for tour name (exact match first, then variations)
        const tourFields = ['Tour Name', 'tour_name', 'Tour', 'TourName', 'Product', 'Activity'];
        for (const field of tourFields) {
          if (row[field] && String(row[field]).trim()) {
            tourName = String(row[field]).trim();
            break; // Use first found tour name
          }
        }

        // Look for adult count (exact match)
        const adultFields = ['Adults', 'Adult', 'num_adult', 'Adult Count', 'AdultCount', 'Pax Adult'];
        for (const field of adultFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            if (value > 0) {
              adults = value;
              console.log(`Found adults: ${value} from field: ${field}`);
              break; // Use first found adult count
            }
          }
        }

        // Look for children count (exact match)
        const childFields = ['Children', 'Child', 'num_chd', 'Children Count', 'ChildCount', 'Pax Child', 'Kids'];
        for (const field of childFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const value = parseInt(String(row[field])) || 0;
            if (value > 0) {
              children = value;
              console.log(`Found children: ${value} from field: ${field}`);
              break; // Use first found children count
            }
          }
        }

        // If we found a tour name and at least some participants, add/update the tour
        if (tourName && (adults > 0 || children > 0)) {
          if (tourMap.has(tourName)) {
            // Add to existing tour
            const existing = tourMap.get(tourName)!;
            existing.num_adult += adults;
            existing.num_chd += children;
          } else {
            // Create new tour entry
            tourMap.set(tourName, {
              tour_name: tourName,
              num_adult: adults,
              num_chd: children
            });
          }
          
          total_adult += adults;
          total_chd += children;
        }
      }
    }

    const tours = Array.from(tourMap.values());
    console.log('Final extracted tours:', tours);
    console.log('Totals:', { total_adult, total_chd });
    
    return { tours, total_adult, total_chd };
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
        
        // Find where to insert tour data (look for {{tour_name}} placeholder)
        let insertStartRow = -1;
        let tourNameCol = -1;
        let adultCol = -1;
        let childCol = -1;
        let totalAdultRow = -1;
        let totalChildRow = -1;
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        // First pass: find placeholder locations and total cells
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            
            if (cell && cell.v && typeof cell.v === 'string') {
              if (cell.v.includes('{{tour_name}}')) {
                insertStartRow = row;
                tourNameCol = col;
                console.log(`Found tour_name placeholder at ${cellAddress}`);
              }
              if (cell.v.includes('{{num_adult}}')) {
                adultCol = col;
                if (insertStartRow === -1) insertStartRow = row;
                console.log(`Found num_adult placeholder at ${cellAddress}`);
              }
              if (cell.v.includes('{{num_chd}}')) {
                childCol = col;
                if (insertStartRow === -1) insertStartRow = row;
                console.log(`Found num_chd placeholder at ${cellAddress}`);
              }
            }
            
            // Look for total cells (D24, E24 based on user description)
            if (row === 23 && col === 3) { // D24 (0-indexed: row 23, col 3)
              totalAdultRow = row;
            }
            if (row === 23 && col === 4) { // E24 (0-indexed: row 23, col 4)
              totalChildRow = row;
            }
          }
        }
        
        if (insertStartRow >= 0 && templateData.tours.length > 0) {
          console.log(`Inserting ${templateData.tours.length} tours starting at row ${insertStartRow}`);
          
          // Clear existing placeholder rows
          for (let i = 0; i < templateData.tours.length; i++) {
            const currentRow = insertStartRow + i;
            
            // Add tour name
            if (tourNameCol >= 0) {
              const tourCellAddress = XLSX.utils.encode_cell({ r: currentRow, c: tourNameCol });
              if (!worksheet[tourCellAddress]) worksheet[tourCellAddress] = {};
              worksheet[tourCellAddress].v = templateData.tours[i].tour_name;
              worksheet[tourCellAddress].t = 's'; // string type
              console.log(`Set ${tourCellAddress} = ${templateData.tours[i].tour_name}`);
            }
            
            // Add adult count
            if (adultCol >= 0) {
              const adultCellAddress = XLSX.utils.encode_cell({ r: currentRow, c: adultCol });
              if (!worksheet[adultCellAddress]) worksheet[adultCellAddress] = {};
              worksheet[adultCellAddress].v = templateData.tours[i].num_adult;
              worksheet[adultCellAddress].t = 'n'; // number type
              console.log(`Set ${adultCellAddress} = ${templateData.tours[i].num_adult}`);
            }
            
            // Add child count
            if (childCol >= 0) {
              const childCellAddress = XLSX.utils.encode_cell({ r: currentRow, c: childCol });
              if (!worksheet[childCellAddress]) worksheet[childCellAddress] = {};
              worksheet[childCellAddress].v = templateData.tours[i].num_chd;
              worksheet[childCellAddress].t = 'n'; // number type
              console.log(`Set ${childCellAddress} = ${templateData.tours[i].num_chd}`);
            }
          }
          
          // Update totals in D24 and E24
          if (totalAdultRow >= 0) {
            const totalAdultAddress = XLSX.utils.encode_cell({ r: totalAdultRow, c: 3 });
            if (!worksheet[totalAdultAddress]) worksheet[totalAdultAddress] = {};
            worksheet[totalAdultAddress].v = templateData.total_adult;
            worksheet[totalAdultAddress].t = 'n';
            console.log(`Set total adults ${totalAdultAddress} = ${templateData.total_adult}`);
          }
          
          if (totalChildRow >= 0) {
            const totalChildAddress = XLSX.utils.encode_cell({ r: totalChildRow, c: 4 });
            if (!worksheet[totalChildAddress]) worksheet[totalChildAddress] = {};
            worksheet[totalChildAddress].v = templateData.total_chd;
            worksheet[totalChildAddress].t = 'n';
            console.log(`Set total children ${totalChildAddress} = ${templateData.total_chd}`);
          }
          
          // Update worksheet range to include new data
          const newRange = XLSX.utils.encode_range({
            s: { r: range.s.r, c: range.s.c },
            e: { r: Math.max(range.e.r, insertStartRow + templateData.tours.length - 1), c: range.e.c }
          });
          worksheet['!ref'] = newRange;
        } else {
          console.log('No placeholders found or no tours to insert');
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