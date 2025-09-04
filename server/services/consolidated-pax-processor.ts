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
   * Collect all PAX data from all ships (from updated PAX files, not dispatch files)
   */
  async collectAllPaxData(): Promise<{ [shipId: string]: PaxReportData }> {
    console.log('→ ConsolidatedPaxProcessor: Collecting PAX data from all ships (from updated PAX files)');
    
    const allShipData: { [shipId: string]: PaxReportData } = {};
    const ships = ['ship-a', 'ship-b', 'ship-c'];

    for (const shipId of ships) {
      try {
        console.log(`→ ConsolidatedPaxProcessor: DEBUG - Processing ${shipId}...`);
        const latestPaxFile = await this.findLatestPaxFile(shipId);
        if (latestPaxFile) {
          console.log(`→ ConsolidatedPaxProcessor: Found PAX file for ${shipId}: ${latestPaxFile}`);
          const shipData = await this.extractPaxDataForShip(latestPaxFile, shipId);
          console.log(`→ ConsolidatedPaxProcessor: DEBUG - ${shipId} extracted ${shipData.records.length} records`);
          allShipData[shipId] = shipData;
        } else {
          console.log(`→ ConsolidatedPaxProcessor: No PAX file found for ${shipId}, falling back to dispatch file`);
          // Fallback to dispatch file if no PAX file exists
          const latestDispatchFile = await this.findLatestDispatchFile(shipId);
          if (latestDispatchFile) {
            console.log(`→ ConsolidatedPaxProcessor: Found dispatch file for ${shipId}: ${latestDispatchFile}`);
            const shipData = await this.extractDispatchDataForShip(latestDispatchFile, shipId);
            console.log(`→ ConsolidatedPaxProcessor: DEBUG - ${shipId} extracted ${shipData.records.length} records from dispatch`);
            allShipData[shipId] = shipData;
          }
        }
        console.log(`→ ConsolidatedPaxProcessor: DEBUG - ${shipId} processing completed`);
      } catch (error) {
        console.error(`→ ConsolidatedPaxProcessor: Error processing ${shipId}:`, error);
        // Continue with other ships even if one fails
      }
    }

    console.log(`→ ConsolidatedPaxProcessor: Collected data from ${Object.keys(allShipData).length} ships`);
    return allShipData;
  }

  /**
   * Collect all dispatch data from all ships (original method for fallback)
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
   * Find the latest PAX file for a specific ship
   */
  private async findLatestPaxFile(shipId: string): Promise<string | null> {
    const shipOutputDir = path.join(process.cwd(), 'output', shipId);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Looking for PAX files in ${shipOutputDir}`);
    
    if (!fs.existsSync(shipOutputDir)) {
      console.log(`→ ConsolidatedPaxProcessor: DEBUG - Directory does not exist: ${shipOutputDir}`);
      return null;
    }

    const files = fs.readdirSync(shipOutputDir);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Files in ${shipId} directory: ${files.length} files`);
    
    const paxFiles = files.filter(file => 
      file.startsWith('pax_') && 
      file.endsWith('.xlsx')
    );
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - PAX files found for ${shipId}: ${paxFiles.length} (${paxFiles.join(', ')})`);

    if (paxFiles.length === 0) {
      console.log(`→ ConsolidatedPaxProcessor: DEBUG - No PAX files found for ${shipId}`);
      return null;
    }

    // Sort by timestamp in filename and get the latest
    const sortedFiles = paxFiles.sort((a, b) => {
      const timestampA = parseInt(a.replace('pax_', '').replace('.xlsx', ''));
      const timestampB = parseInt(b.replace('pax_', '').replace('.xlsx', ''));
      return timestampB - timestampA; // Newest first
    });

    const latestFile = path.join(shipOutputDir, sortedFiles[0]);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Latest PAX file for ${shipId}: ${latestFile}`);
    return latestFile;
  }

  /**
   * Extract PAX data for a specific ship from PAX file
   */
  private async extractPaxDataForShip(filePath: string, shipId: string): Promise<PaxReportData> {
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Extracting PAX data for ${shipId} from ${filePath}`);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        throw new Error(`PAX worksheet not found in ${filePath}`);
      }

      // Extract header data from PAX file
      const date = this.getCellValue(worksheet, 'A4') || '';
      const cruiseLine = this.getCellValue(worksheet, 'B4') || '';  
      const shipName = this.getCellValue(worksheet, 'C4') || shipId.toUpperCase();

      console.log(`→ ConsolidatedPaxProcessor: ${shipId} PAX header - Date: ${date}, Cruise: ${cruiseLine}, Ship: ${shipName}`);

      // Extract PAX records (starting from row 5, skipping template row 4)
      const records: any[] = [];
    
    for (let row = 5; row <= 100; row++) { // Check up to row 100
      const dateCell = worksheet.getCell(row, 1);
      if (!dateCell.value || dateCell.value === '') {
        break; // Stop at first empty row
      }

      // Skip if this is just a template or header row
      const tourNameValue = this.getCellValue(worksheet, `B${row}`);
      if (!tourNameValue || tourNameValue === '' || tourNameValue === 'TOUR') {
        continue;
      }

      // Extract the tour data from this PAX entry row
      const allotment = this.extractNumericValue(worksheet.getCell(row, 8).value); // Column H
      const sold = this.extractNumericValue(worksheet.getCell(row, 10).value); // Column J  
      const paxOnBoard = this.extractNumericValue(worksheet.getCell(row, 72).value); // Column BT
      const paxOnTour = this.extractNumericValue(worksheet.getCell(row, 73).value); // Column BU

      records.push({
        tourName: tourNameValue,
        allotment,
        sold,
        paxOnBoard,
        paxOnTour
      });

      console.log(`→ ConsolidatedPaxProcessor: ${shipId} PAX row ${row} - ${tourNameValue}: ${sold}/${allotment}, OnBoard: ${paxOnBoard}, OnTour: ${paxOnTour}`);
    }

    console.log(`→ ConsolidatedPaxProcessor: DEBUG - ${shipId} PAX extraction completed with ${records.length} records`);
    return {
      date,
      cruiseLine,
      shipName,
      records
    };
  } catch (error) {
    console.error(`→ ConsolidatedPaxProcessor: ERROR - Failed to extract PAX data for ${shipId}:`, error);
    throw error;
  }
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
   * Populate consolidated report with cross-ship data (individual rows, not aggregated)
   */
  private async populateConsolidatedReport(worksheet: ExcelJS.Worksheet, consolidatedData: ConsolidatedPaxData): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: Populating consolidated report with ${consolidatedData.records.length} individual records`);

    // For consolidated PAX, we want to show individual rows from each ship, not aggregated totals
    // This means we'll populate starting from row 5, with each record as a separate row

    // Get representative data (use triggering ship's data for headers)
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - lastUpdatedByShip: ${consolidatedData.lastUpdatedByShip}`);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Available ship records: ${consolidatedData.records.map(r => r.shipId).join(', ')}`);
    
    // Find the triggering ship's record to use their ship name
    const triggeringShipRecord = consolidatedData.records.find(record => 
      record.shipId === consolidatedData.lastUpdatedByShip
    ) || consolidatedData.records[0];
    
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Found triggering ship record: ${triggeringShipRecord ? triggeringShipRecord.shipId : 'none'}`);
    
    const consolidatedDate = triggeringShipRecord?.date || new Date().toLocaleDateString('en-GB');
    const consolidatedCruiseLine = triggeringShipRecord?.cruiseLine || 'CCL';
    
    // For consolidated reports, show "All Ships" in the header
    const consolidatedShipName = "All Ships";
    console.log(`→ ConsolidatedPaxProcessor: Using ship name "${consolidatedShipName}" for consolidated header`);

    // Set header information (consolidated view)
    worksheet.getCell('A4').value = consolidatedDate; // Date
    worksheet.getCell('B4').value = consolidatedCruiseLine; // Cruise Line  
    worksheet.getCell('C4').value = consolidatedShipName; // "All Ships"

    // Find the first empty row (starting from row 5)
    let currentRow = 5;
    while (worksheet.getCell(currentRow, 1).value && currentRow < 200) {
      currentRow++;
    }

    console.log(`→ ConsolidatedPaxProcessor: Adding ${consolidatedData.records.length} individual records starting from row ${currentRow}`);

    // Add each record as a separate row (individual entries, not aggregated)
    for (const record of consolidatedData.records) {
      console.log(`→ ConsolidatedPaxProcessor: Adding ${record.shipName} - ${record.tourName} to row ${currentRow}`);
      
      // Set individual record data
      worksheet.getCell(`A${currentRow}`).value = record.date;
      worksheet.getCell(`B${currentRow}`).value = `${record.shipName} - ${record.tourName}`; // Show ship and tour
      worksheet.getCell(`H${currentRow}`).value = record.allotment;
      worksheet.getCell(`J${currentRow}`).value = record.sold;
      worksheet.getCell(`BT${currentRow}`).value = record.paxOnBoard;
      worksheet.getCell(`BU${currentRow}`).value = record.paxOnTour;

      currentRow++;
    }

    console.log(`→ ConsolidatedPaxProcessor: Added ${consolidatedData.records.length} individual records to consolidated PAX`);
  }

  /**
   * Main entry point for consolidated PAX generation
   */
  async processConsolidatedPax(templatePath: string, triggeringShipId: string = 'system'): Promise<{ filename: string; data: ConsolidatedPaxData }> {
    console.log(`→ ConsolidatedPaxProcessor: Starting consolidated PAX generation (triggered by ${triggeringShipId})`);

    try {
      // Step 1: Collect data from all ships (prefer PAX files over dispatch files)
      const allShipData = await this.collectAllPaxData();
      
      if (Object.keys(allShipData).length === 0) {
        throw new Error('No PAX data found from any ship');
      }

      // Step 2: Validate and merge data
      const consolidatedData = this.validateCrossShipData(allShipData);
      consolidatedData.lastUpdatedByShip = triggeringShipId;

      // Step 3: Check if existing consolidated PAX exists and update it, or create new one
      const filename = await this.updateOrCreateConsolidatedPax(consolidatedData, templatePath);

      console.log(`→ ConsolidatedPaxProcessor: Consolidated PAX processing completed - ${filename}`);
      return { filename, data: consolidatedData };

    } catch (error) {
      console.error('→ ConsolidatedPaxProcessor: Error in consolidated PAX processing:', error);
      throw error;
    }
  }

  /**
   * Update existing consolidated PAX or create new one
   */
  private async updateOrCreateConsolidatedPax(consolidatedData: ConsolidatedPaxData, templatePath: string): Promise<string> {
    const consolidatedOutputDir = path.join(process.cwd(), 'output', 'consolidated', 'pax');
    
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Checking for existing consolidated PAX in: ${consolidatedOutputDir}`);
    console.log(`→ ConsolidatedPaxProcessor: DEBUG - Directory exists: ${fs.existsSync(consolidatedOutputDir)}`);
    
    // Check if consolidated PAX files exist
    if (fs.existsSync(consolidatedOutputDir)) {
      const allFiles = fs.readdirSync(consolidatedOutputDir);
      console.log(`→ ConsolidatedPaxProcessor: DEBUG - All files in directory: ${allFiles.join(', ')}`);
      
      const existingFiles = allFiles
        .filter(file => file.startsWith('consolidated_pax_') && file.endsWith('.xlsx'))
        .sort((a, b) => {
          const timestampA = parseInt(a.replace('consolidated_pax_', '').replace('.xlsx', ''));
          const timestampB = parseInt(b.replace('consolidated_pax_', '').replace('.xlsx', ''));
          return timestampB - timestampA; // Newest first
        });

      console.log(`→ ConsolidatedPaxProcessor: DEBUG - Filtered consolidated PAX files: ${existingFiles.join(', ')}`);

      if (existingFiles.length > 0) {
        const latestFile = existingFiles[0];
        const existingFilePath = path.join(consolidatedOutputDir, latestFile);
        console.log(`→ ConsolidatedPaxProcessor: Updating existing consolidated PAX: ${latestFile}`);
        
        // Update existing consolidated PAX
        await this.updateExistingConsolidatedPax(existingFilePath, consolidatedData);
        return latestFile;
      }
    }

    // No existing file found, create new one
    console.log(`→ ConsolidatedPaxProcessor: No existing consolidated PAX found, creating new one`);
    return await this.generateConsolidatedPax(consolidatedData, templatePath);
  }

  /**
   * Update existing consolidated PAX file
   */
  private async updateExistingConsolidatedPax(existingFilePath: string, consolidatedData: ConsolidatedPaxData): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: Loading existing consolidated PAX for update`);

    // Load existing consolidated PAX file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(existingFilePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('Existing consolidated PAX worksheet not found');
    }

    // Update the consolidated data (same logic as populate but on existing file)
    await this.populateConsolidatedReport(worksheet, consolidatedData);

    // Save back to the same file (overwrite)
    await workbook.xlsx.writeFile(existingFilePath);
    console.log(`→ ConsolidatedPaxProcessor: Updated existing consolidated PAX file`);
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