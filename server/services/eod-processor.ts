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

      // Read EOD template file with full formatting support
      const workbook = XLSX.readFile(eodTemplatePath, {
        cellHTML: false,
        cellNF: false,
        cellStyles: true,
        sheetStubs: true,
        bookDeps: true,
        bookFiles: true,
        bookProps: true,
        bookSheets: true,
        bookVBA: true
      });
      
      // Log workbook structure for debugging
      console.log('Workbook has styles:', !!(workbook as any).SSF);
      console.log('Workbook props:', workbook.Props ? 'YES' : 'NO');
      
      // Process each sheet in the template
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        // Find template row (row 17, 0-indexed = 16) that contains placeholders
        const templateRowIndex = 16; // Row 17 in 0-indexed
        const templateEndRowIndex = 24; // Row 25 in 0-indexed
        let hasPlaceholders = false;
        
        // Check if row 17 has placeholders
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: templateRowIndex, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v && typeof cell.v === 'string') {
            if (cell.v.includes('{{tour_name}}') || cell.v.includes('{{num_adult}}') || cell.v.includes('{{num_chd}}')) {
              hasPlaceholders = true;
              break;
            }
          }
        }
        
        if (hasPlaceholders && templateData.tours.length > 0) {
          console.log(`Found template row with placeholders, duplicating for ${templateData.tours.length} tours`);
          
          // Store worksheet formatting properties
          const originalMerges = worksheet['!merges'] ? [...worksheet['!merges']] : [];
          const originalRowInfo = worksheet['!rows'] ? [...worksheet['!rows']] : [];
          const originalColInfo = worksheet['!cols'] ? [...worksheet['!cols']] : [];
          
          // Store the original template rows (17-25) with all formatting
          const templateRows: any[] = [];
          for (let row = templateRowIndex; row <= templateEndRowIndex; row++) {
            const rowData: any = {};
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              if (worksheet[cellAddress]) {
                // Deep copy to preserve all formatting properties including styles
                const cell = worksheet[cellAddress];
                rowData[col] = {
                  v: cell.v,      // value
                  t: cell.t,      // type
                  f: cell.f,      // formula
                  w: cell.w,      // formatted text
                  s: cell.s ? JSON.parse(JSON.stringify(cell.s)) : undefined, // style object
                  z: cell.z,      // number format
                  l: cell.l,      // hyperlink
                  c: cell.c,      // comments
                  h: cell.h,      // rich text
                };
                console.log(`Storing cell ${cellAddress} with style:`, cell.s ? 'YES' : 'NO');
              }
            }
            templateRows.push(rowData);
          }
          
          // Clear original template area
          for (let row = templateRowIndex; row <= templateEndRowIndex; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              delete worksheet[cellAddress];
            }
          }
          
          // Create rows for each tour
          let currentInsertRow = templateRowIndex;
          
          for (let tourIndex = 0; tourIndex < templateData.tours.length; tourIndex++) {
            const tour = templateData.tours[tourIndex];
            console.log(`Creating rows for tour ${tourIndex + 1}: ${tour.tour_name}`);
            
            // Duplicate the template rows for this tour
            for (let templateRowOffset = 0; templateRowOffset < templateRows.length; templateRowOffset++) {
              const targetRow = currentInsertRow + templateRowOffset;
              const sourceRowData = templateRows[templateRowOffset];
              
              for (let col = range.s.c; col <= range.e.c; col++) {
                if (sourceRowData[col]) {
                  const cellAddress = XLSX.utils.encode_cell({ r: targetRow, c: col });
                  const sourceCell = sourceRowData[col];
                  
                  // Create new cell with all properties preserved
                  worksheet[cellAddress] = {
                    v: sourceCell.v,
                    t: sourceCell.t,
                    f: sourceCell.f,
                    w: sourceCell.w,
                    s: sourceCell.s,
                    z: sourceCell.z,
                    l: sourceCell.l,
                    c: sourceCell.c,
                    h: sourceCell.h,
                  };
                  
                  // Remove undefined properties to keep clean structure
                  Object.keys(worksheet[cellAddress]).forEach(key => {
                    if (worksheet[cellAddress][key] === undefined) {
                      delete worksheet[cellAddress][key];
                    }
                  });
                  
                  // Replace placeholders in the cell value
                  if (worksheet[cellAddress].v && typeof worksheet[cellAddress].v === 'string') {
                    let cellValue = worksheet[cellAddress].v;
                    const originalValue = cellValue;
                    
                    if (cellValue.includes('{{tour_name}}')) {
                      cellValue = cellValue.replace(/\{\{tour_name\}\}/g, tour.tour_name);
                    }
                    if (cellValue.includes('{{num_adult}}')) {
                      cellValue = cellValue.replace(/\{\{num_adult\}\}/g, tour.num_adult.toString());
                    }
                    if (cellValue.includes('{{num_chd}}')) {
                      cellValue = cellValue.replace(/\{\{num_chd\}\}/g, tour.num_chd.toString());
                    }
                    
                    if (cellValue !== originalValue) {
                      console.log(`Cell ${cellAddress} updated: "${originalValue}" -> "${cellValue}"`);
                      worksheet[cellAddress].v = cellValue;
                      worksheet[cellAddress].w = cellValue;
                    }
                  }
                  
                  console.log(`Copied cell ${cellAddress} with formatting:`, worksheet[cellAddress].s ? 'YES' : 'NO');
                }
              }
            }
            
            currentInsertRow += templateRows.length;
          }
          
          // Update totals at the end (assuming they're in the last section)
          // Find cells with {{num_adult}} and {{num_chd}} that aren't part of individual tour rows
          for (let row = currentInsertRow; row <= range.e.r + (templateData.tours.length * templateRows.length); row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              const cell = worksheet[cellAddress];
              
              if (cell && cell.v && typeof cell.v === 'string') {
                let cellValue = cell.v;
                const originalValue = cellValue;
                
                if (cellValue.includes('{{num_adult}}')) {
                  cellValue = cellValue.replace(/\{\{num_adult\}\}/g, templateData.total_adult.toString());
                }
                if (cellValue.includes('{{num_chd}}')) {
                  cellValue = cellValue.replace(/\{\{num_chd\}\}/g, templateData.total_chd.toString());
                }
                
                if (cellValue !== originalValue) {
                  console.log(`Total cell ${cellAddress} updated: "${originalValue}" -> "${cellValue}"`);
                  cell.v = cellValue;
                  cell.w = cellValue;
                }
              }
            }
          }
          
          // Handle merged cells - duplicate merges for each tour section
          if (originalMerges.length > 0) {
            const newMerges = [...originalMerges];
            
            for (let tourIndex = 1; tourIndex < templateData.tours.length; tourIndex++) {
              const rowOffset = tourIndex * templateRows.length;
              
              for (const merge of originalMerges) {
                // Only duplicate merges that are within the template rows (17-25)
                if (merge.s.r >= templateRowIndex && merge.e.r <= templateEndRowIndex) {
                  const newMerge = {
                    s: { r: merge.s.r + rowOffset, c: merge.s.c },
                    e: { r: merge.e.r + rowOffset, c: merge.e.c }
                  };
                  newMerges.push(newMerge);
                  console.log(`Duplicated merge from ${XLSX.utils.encode_range(merge)} to ${XLSX.utils.encode_range(newMerge)}`);
                }
              }
            }
            
            worksheet['!merges'] = newMerges;
          }
          
          // Extend row info for new rows
          if (originalRowInfo.length > 0) {
            const newRowInfo = [...originalRowInfo];
            
            for (let tourIndex = 1; tourIndex < templateData.tours.length; tourIndex++) {
              const rowOffset = tourIndex * templateRows.length;
              
              for (let templateRowOffset = 0; templateRowOffset < templateRows.length; templateRowOffset++) {
                const sourceRowIndex = templateRowIndex + templateRowOffset;
                const targetRowIndex = sourceRowIndex + rowOffset;
                
                if (originalRowInfo[sourceRowIndex]) {
                  newRowInfo[targetRowIndex] = JSON.parse(JSON.stringify(originalRowInfo[sourceRowIndex]));
                  console.log(`Duplicated row formatting from row ${sourceRowIndex + 1} to row ${targetRowIndex + 1}`);
                }
              }
            }
            
            worksheet['!rows'] = newRowInfo;
          }
          
          // Update worksheet range
          const newEndRow = Math.max(range.e.r, currentInsertRow - 1);
          const newRange = XLSX.utils.encode_range({
            s: { r: range.s.r, c: range.s.c },
            e: { r: newEndRow, c: range.e.c }
          });
          worksheet['!ref'] = newRange;
          
        } else {
          console.log('No template placeholders found or no tours to process');
        }
      }

      // Save the processed file with full formatting support
      const outputPath = path.join(this.outputDir, outputFileName);
      XLSX.writeFile(workbook, outputPath, {
        cellStyles: true,
        bookSST: true,
        bookType: 'xlsx',
        compression: true
      });

      console.log(`Saved processed file to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to process EOD template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}