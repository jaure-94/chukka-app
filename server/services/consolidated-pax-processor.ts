import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { PaxProcessor, type PaxReportData, type ValidatedPaxRecord } from './pax-processor';

export interface ConsolidatedPaxData {
  contributingShips: string[];
  records: CrossShipPaxRecord[];
  totalRecordCount: number;
  lastUpdatedByShip: string;
}

export interface CrossShipPaxRecord extends ValidatedPaxRecord {
  shipId: string;
  shipName: string;
  date: string;
  cruiseLine: string;
}

export class ConsolidatedPaxProcessor {
  private paxProcessor: PaxProcessor;

  constructor() {
    this.paxProcessor = new PaxProcessor();
  }

  /**
   * Collect all dispatch data from all ships
   */
  async collectAllDispatchData(): Promise<{ [shipId: string]: PaxReportData }> {
    console.log('→ ConsolidatedPaxProcessor: Collecting dispatch data from all ships');
    
    const allShipData: { [shipId: string]: PaxReportData } = {};
    const ships = ['ship-a', 'ship-b', 'ship-c'];

    for (const shipId of ships) {
      try {
        const latestDispatchFile = await this.findLatestDispatchFile(shipId);
        if (latestDispatchFile) {
          console.log(`→ ConsolidatedPaxProcessor: Found dispatch file for ${shipId}: ${latestDispatchFile}`);
          const shipData = await this.extractDispatchDataForShip(latestDispatchFile, shipId);
          allShipData[shipId] = shipData;
        } else {
          console.log(`→ ConsolidatedPaxProcessor: No dispatch file found for ${shipId}`);
        }
      } catch (error) {
        console.error(`→ ConsolidatedPaxProcessor: Error processing ${shipId}:`, error);
        // Continue with other ships even if one fails
      }
    }

    console.log(`→ ConsolidatedPaxProcessor: Collected data from ${Object.keys(allShipData).length} ships`);
    return allShipData;
  }

  /**
   * Find the latest dispatch file for a specific ship
   */
  private async findLatestDispatchFile(shipId: string): Promise<string | null> {
    const shipUploadsDir = path.join(process.cwd(), 'uploads', shipId);
    
    if (!fs.existsSync(shipUploadsDir)) {
      return null;
    }

    const files = fs.readdirSync(shipUploadsDir);
    const dispatchFiles = files.filter(file => 
      file.toLowerCase().includes('dispatch') && 
      file.endsWith('.xlsx') &&
      !file.toLowerCase().includes('template') // Exclude templates
    );

    if (dispatchFiles.length === 0) {
      return null;
    }

    // Sort by modification time and get the latest
    const filesWithStats = dispatchFiles.map(file => {
      const filePath = path.join(shipUploadsDir, file);
      const stats = fs.statSync(filePath);
      return { file, path: filePath, mtime: stats.mtime };
    });

    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return filesWithStats[0].path;
  }

  /**
   * Extract dispatch data for a specific ship using existing PaxProcessor logic
   */
  private async extractDispatchDataForShip(filePath: string, shipId: string): Promise<PaxReportData> {
    // Use the existing PaxProcessor's private method logic
    // We'll replicate the extraction logic here for consolidated processing
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error(`Dispatch worksheet not found in ${filePath}`);
    }

    // Extract header data
    const date = this.getCellValue(worksheet, 'B4') || '';
    const cruiseLine = this.getCellValue(worksheet, 'B1') || '';
    const shipName = this.getCellValue(worksheet, 'B2') || shipId.toUpperCase();

    console.log(`→ ConsolidatedPaxProcessor: ${shipId} header - Date: ${date}, Cruise: ${cruiseLine}, Ship: ${shipName}`);

    // Extract tour records
    const records: any[] = [];
    
    for (let row = 8; row <= 200; row++) {
      const tourNameCell = worksheet.getCell(row, 1);
      const allotmentCell = worksheet.getCell(row, 8);
      const soldCell = worksheet.getCell(row, 10);
      const paxOnBoardCell = worksheet.getCell(row, 17);
      const paxOnTourCell = worksheet.getCell(row, 18);

      if (tourNameCell.value && typeof tourNameCell.value === 'string') {
        const tourName = tourNameCell.value.trim();
        
        if (tourName && tourName !== 'TOUR') {
          const allotment = this.extractNumericValue(allotmentCell.value);
          const sold = this.extractNumericValue(soldCell.value);
          const paxOnBoard = this.extractNumericValue(paxOnBoardCell.value);
          const paxOnTour = this.extractNumericValue(paxOnTourCell.value);

          records.push({
            tourName,
            allotment,
            sold,
            paxOnBoard,
            paxOnTour
          });

          console.log(`→ ConsolidatedPaxProcessor: ${shipId} - Found tour "${tourName}"`);
        }
      }
    }

    return {
      date,
      cruiseLine,
      shipName,
      records
    };
  }

  /**
   * Validate and merge data from all ships
   */
  validateCrossShipData(allShipData: { [shipId: string]: PaxReportData }): ConsolidatedPaxData {
    console.log('→ ConsolidatedPaxProcessor: Validating and merging cross-ship data');
    
    const crossShipRecords: CrossShipPaxRecord[] = [];
    const contributingShips: string[] = [];

    for (const [shipId, shipData] of Object.entries(allShipData)) {
      contributingShips.push(shipId);
      
      // Validate records for this ship
      const validatedRecords = this.validateAndMapRecords(shipData.records);
      
      // Convert to cross-ship records
      for (const record of validatedRecords) {
        // Use friendly ship name for consolidated reports instead of original ship name
        const shipIdToName = {
          'ship-a': 'Ship A',
          'ship-b': 'Ship B', 
          'ship-c': 'Ship C'
        };
        
        const friendlyShipName = shipIdToName[shipId as keyof typeof shipIdToName] || shipData.shipName;
        
        crossShipRecords.push({
          ...record,
          shipId,
          shipName: friendlyShipName,
          date: shipData.date,
          cruiseLine: shipData.cruiseLine
        });
        
        console.log(`→ ConsolidatedPaxProcessor: ${shipId} record attributed to "${friendlyShipName}"`);
      }
    }

    // Detect potential conflicts (same tour types across ships)
    this.detectTourConflicts(crossShipRecords);

    return {
      contributingShips,
      records: crossShipRecords,
      totalRecordCount: crossShipRecords.length,
      lastUpdatedByShip: contributingShips[contributingShips.length - 1] || 'unknown'
    };
  }

  /**
   * Detect potential scheduling conflicts between ships
   */
  private detectTourConflicts(records: CrossShipPaxRecord[]): void {
    const tourTypesByShip: { [tourType: string]: string[] } = {};
    
    for (const record of records) {
      if (!tourTypesByShip[record.tourType]) {
        tourTypesByShip[record.tourType] = [];
      }
      if (!tourTypesByShip[record.tourType].includes(record.shipId)) {
        tourTypesByShip[record.tourType].push(record.shipId);
      }
    }

    for (const [tourType, ships] of Object.entries(tourTypesByShip)) {
      if (ships.length > 1) {
        console.log(`→ ConsolidatedPaxProcessor: ⚠️  Tour conflict detected - ${tourType} appears on ships: ${ships.join(', ')}`);
      }
    }
  }

  /**
   * Generate consolidated PAX report
   */
  async generateConsolidatedPax(consolidatedData: ConsolidatedPaxData, templatePath: string): Promise<string> {
    console.log(`→ ConsolidatedPaxProcessor: Generating consolidated PAX report from ${consolidatedData.contributingShips.length} ships`);
    
    // Load PAX template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('Consolidated PAX template worksheet not found');
    }

    // Generate consolidated report data
    await this.populateConsolidatedReport(worksheet, consolidatedData);

    // Save to consolidated directory
    const outputFilename = `consolidated_pax_${Date.now()}.xlsx`;
    const consolidatedDir = path.join(process.cwd(), 'output', 'consolidated', 'pax');
    const outputPath = path.join(consolidatedDir, outputFilename);
    
    // Ensure consolidated directory exists
    if (!fs.existsSync(consolidatedDir)) {
      fs.mkdirSync(consolidatedDir, { recursive: true });
    }
    
    await workbook.xlsx.writeFile(outputPath);

    console.log(`→ ConsolidatedPaxProcessor: Consolidated PAX report saved to ${outputPath}`);
    return outputFilename;
  }

  /**
   * Populate consolidated report with cross-ship data
   */
  private async populateConsolidatedReport(worksheet: ExcelJS.Worksheet, consolidatedData: ConsolidatedPaxData): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: Populating consolidated report with ${consolidatedData.records.length} total records`);

    // Aggregate data across all ships
    const tourTotals = {
      catamaran: { sold: 0, allotment: 0 },
      champagne: { sold: 0, allotment: 0 },
      invisible: { sold: 0, allotment: 0 }
    };

    let totalPaxOnBoard = 0;
    let totalPaxOnTour = 0;

    // Aggregate from all ships
    for (const record of consolidatedData.records) {
      tourTotals[record.tourType].sold += record.sold;
      tourTotals[record.tourType].allotment += record.allotment;
      totalPaxOnBoard += record.paxOnBoard;
      totalPaxOnTour += record.paxOnTour;
    }

    // Get representative data (use triggering ship's data for headers)
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - lastUpdatedByShip: ${consolidatedData.lastUpdatedByShip}`);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Available ship records: ${consolidatedData.records.map(r => r.shipId).join(', ')}`);
    
    // Find the triggering ship's record to use their ship name
    const triggeringShipRecord = consolidatedData.records.find(record => 
      record.shipId === consolidatedData.lastUpdatedByShip
    ) || consolidatedData.records[0];
    
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Found triggering ship record: ${triggeringShipRecord ? triggeringShipRecord.shipId : 'none'}`);
    
    const consolidatedDate = triggeringShipRecord?.date || new Date().toLocaleDateString('en-GB');
    const consolidatedCruiseLine = triggeringShipRecord?.cruiseLine || 'Multi-Ship Operation';
    
    // Format ship name to be user-friendly (e.g., "Ship A" instead of "SHIP-A" or "Liberty")
    const shipIdToName = {
      'ship-a': 'Ship A',
      'ship-b': 'Ship B', 
      'ship-c': 'Ship C'
    };
    
    // Use the friendly name based on triggering ship
    let consolidatedShipName = 'Unknown Ship';
    if (consolidatedData.lastUpdatedByShip && shipIdToName[consolidatedData.lastUpdatedByShip as keyof typeof shipIdToName]) {
      consolidatedShipName = shipIdToName[consolidatedData.lastUpdatedByShip as keyof typeof shipIdToName];
    }

    console.log(`→ ConsolidatedPaxProcessor: Using ship name "${consolidatedShipName}" from triggering ship ${consolidatedData.lastUpdatedByShip}`);

    // Use template row 4 for delimiter replacement (same as original logic)
    const templateRow = 4;

    // Replace delimiters with consolidated data
    this.replaceDelimiter(worksheet, templateRow, 1, '{{date}}', consolidatedDate);
    this.replaceDelimiter(worksheet, templateRow, 2, '{{cruise_line}}', consolidatedCruiseLine);
    this.replaceDelimiter(worksheet, templateRow, 3, '{{ship_name}}', consolidatedShipName);

    // Tour-specific aggregated data
    this.replaceDelimiter(worksheet, templateRow, 4, '{{cat_sold}}', tourTotals.catamaran.sold);
    this.replaceDelimiter(worksheet, templateRow, 5, '{{cat_allot}}', tourTotals.catamaran.allotment);
    this.replaceDelimiter(worksheet, templateRow, 6, '{{champ_sold}}', tourTotals.champagne.sold);
    this.replaceDelimiter(worksheet, templateRow, 7, '{{champ_allot}}', tourTotals.champagne.allotment);
    this.replaceDelimiter(worksheet, templateRow, 8, '{{inv_sold}}', tourTotals.invisible.sold);
    this.replaceDelimiter(worksheet, templateRow, 9, '{{inv_allot}}', tourTotals.invisible.allotment);

    // Analysis data (columns BT=72, BU=73)
    this.replaceDelimiter(worksheet, templateRow, 72, '{{pax_on_board}}', totalPaxOnBoard);
    this.replaceDelimiter(worksheet, templateRow, 73, '{{pax_on_tour}}', totalPaxOnTour);

    console.log(`→ ConsolidatedPaxProcessor: Consolidated totals - Catamaran: ${tourTotals.catamaran.sold}/${tourTotals.catamaran.allotment}, Champagne: ${tourTotals.champagne.sold}/${tourTotals.champagne.allotment}, Invisible: ${tourTotals.invisible.sold}/${tourTotals.invisible.allotment}`);
    console.log(`→ ConsolidatedPaxProcessor: Overall totals - OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
  }

  /**
   * Main entry point for consolidated PAX generation
   */
  async processConsolidatedPax(templatePath: string, triggeringShipId: string = 'system'): Promise<{ filename: string; data: ConsolidatedPaxData }> {
    console.log(`→ ConsolidatedPaxProcessor: Starting consolidated PAX generation (triggered by ${triggeringShipId})`);

    try {
      // Step 1: Collect data from all ships
      const allShipData = await this.collectAllDispatchData();
      
      if (Object.keys(allShipData).length === 0) {
        throw new Error('No dispatch data found from any ship');
      }

      // Step 2: Validate and merge data
      const consolidatedData = this.validateCrossShipData(allShipData);
      consolidatedData.lastUpdatedByShip = triggeringShipId;

      // Step 3: Generate consolidated report
      const filename = await this.generateConsolidatedPax(consolidatedData, templatePath);

      console.log(`→ ConsolidatedPaxProcessor: Consolidated PAX generation completed - ${filename}`);
      return { filename, data: consolidatedData };

    } catch (error) {
      console.error('→ ConsolidatedPaxProcessor: Error in consolidated PAX generation:', error);
      throw error;
    }
  }

  // Helper methods (reusing logic from PaxProcessor)
  private validateAndMapRecords(records: any[]): ValidatedPaxRecord[] {
    const validatedRecords: ValidatedPaxRecord[] = [];

    for (const record of records) {
      let tourType: 'catamaran' | 'champagne' | 'invisible' | null = null;

      if (record.tourName === 'Catamaran Sail & Snorkel') {
        tourType = 'catamaran';
      } else if (record.tourName === 'Champagne Adults Only') {
        tourType = 'champagne';
      } else if (record.tourName === 'Invisible Boat Family') {
        tourType = 'invisible';
      }

      if (tourType) {
        validatedRecords.push({
          ...record,
          tourType
        });
      }
    }

    return validatedRecords;
  }

  private replaceDelimiter(worksheet: ExcelJS.Worksheet, row: number, col: number, delimiter: string, value: string | number): void {
    const cell = worksheet.getCell(row, col);
    
    if (cell.value && String(cell.value).includes(delimiter)) {
      cell.value = value;
      console.log(`→ ConsolidatedPaxProcessor: Replaced ${delimiter} at ${cell.address} = ${value}`);
    }
  }

  private getCellValue(worksheet: ExcelJS.Worksheet, address: string): string {
    const cell = worksheet.getCell(address);
    if (!cell.value) return '';
    
    if (cell.value instanceof Date) {
      const day = cell.value.getDate().toString().padStart(2, '0');
      const month = (cell.value.getMonth() + 1).toString().padStart(2, '0');
      const year = cell.value.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    if (typeof cell.value === 'number' && cell.value > 1 && cell.value < 100000) {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (cell.value - 1) * 24 * 60 * 60 * 1000);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return String(cell.value);
  }

  private extractNumericValue(cellValue: any): number {
    if (typeof cellValue === 'number') {
      return cellValue;
    }
    
    if (cellValue && typeof cellValue === 'object') {
      if ('result' in cellValue && typeof cellValue.result === 'number') {
        return cellValue.result;
      }
      
      if ('value' in cellValue && typeof cellValue.value === 'number') {
        return cellValue.value;
      }
      
      if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
        const text = cellValue.richText.map((part: any) => part.text || '').join('');
        const parsed = Number(text);
        return isNaN(parsed) ? 0 : parsed;
      }
      
      if ('formula' in cellValue && 'result' in cellValue) {
        if (typeof cellValue.result === 'number') {
          return cellValue.result;
        }
      }
      
      for (const prop of ['calculatedValue', 'value', 'number', 'val']) {
        if (prop in cellValue && typeof cellValue[prop] === 'number') {
          return cellValue[prop];
        }
      }
    }
    
    if (typeof cellValue === 'string') {
      const parsed = Number(cellValue);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }
}