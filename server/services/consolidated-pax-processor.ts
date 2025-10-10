import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { PaxProcessor, type PaxReportData, type ValidatedPaxRecord } from './pax-processor';
import { paxTabRouter } from './pax-tab-router';

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
  country: string;
  port: string;
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

    // Extract header data (NEW TEMPLATE STRUCTURE)
    const country = this.getCellValue(worksheet, 'B1') || '';      // B1: Country
    const cruiseLine = this.getCellValue(worksheet, 'B2') || '';   // B2: Cruise Line
    const shipName = this.getCellValue(worksheet, 'B3') || shipId.toUpperCase(); // B3: Ship Name
    const port = this.getCellValue(worksheet, 'E3') || '';         // E3: Port
    const date = this.getCellValue(worksheet, 'B5') || '';         // B5: Date

    console.log(`→ ConsolidatedPaxProcessor: ${shipId} header - Country: ${country}, Cruise: ${cruiseLine}, Ship: ${shipName}, Port: ${port}, Date: ${date}`);

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

          console.log(`→ ConsolidatedPaxProcessor: ${shipId} - Found tour "${tourName}" - Allotment: ${allotment}, Sold: ${sold}, OnBoard: ${paxOnBoard}, OnTour: ${paxOnTour}`);
        }
      }
    }

    return {
      date,
      cruiseLine,
      shipName,
      country,
      port,
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
        // Use actual selected ship name from dropdown instead of generic names
        const friendlyShipName = shipData.shipName || 'Unknown Ship';
        
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
   * Process consolidated PAX for single ship update (successive entries)
   * This prevents cross-ship aggregation for successive entries
   */
  async processConsolidatedPaxForSingleShip(
    templatePath: string,
    shipId: string,
    dispatchFilePath: string,
    selectedShipName?: string
  ): Promise<{ filename: string; data: ConsolidatedPaxData }> {
    console.log(`→ ConsolidatedPaxProcessor: Processing INDIVIDUAL ship PAX for ${shipId} ONLY (no cross-ship aggregation)`);

    // Extract data ONLY from the current ship's dispatch file
    const shipData = await this.extractDispatchDataForShip(dispatchFilePath, shipId);
    
    // Override ship name if provided from dropdown selection
    if (selectedShipName) {
      shipData.shipName = selectedShipName;
    }

    console.log(`→ ConsolidatedPaxProcessor: INDIVIDUAL ship data - Ship: ${shipData.shipName}, Date: ${shipData.date}, Records: ${shipData.records.length}`);

    // Create consolidated data with ONLY this ship's current data (no other ships)
    const consolidatedData: ConsolidatedPaxData = {
      contributingShips: [shipId],
      records: [],
      totalRecordCount: 0,
      lastUpdatedByShip: shipId
    };

    // Validate records for ONLY this ship's current dispatch
    const validatedRecords = this.validateAndMapRecords(shipData.records);
    
    console.log(`→ ConsolidatedPaxProcessor: INDIVIDUAL ship validated ${validatedRecords.length} records from ${shipId} dispatch`);
    
    // Convert to cross-ship records for ONLY this ship (no aggregation across ships)
    for (const record of validatedRecords) {
      console.log(`→ ConsolidatedPaxProcessor: INDIVIDUAL record - ${record.tourName}: sold=${record.sold}, allot=${record.allotment}, onBoard=${record.paxOnBoard}, onTour=${record.paxOnTour}`);
      
      consolidatedData.records.push({
        ...record,
        shipId,
        shipName: shipData.shipName,
        date: shipData.date,
        cruiseLine: shipData.cruiseLine,
        country: shipData.country,      // NEW
        port: shipData.port             // NEW
      });
    }

    consolidatedData.totalRecordCount = consolidatedData.records.length;
    
    console.log(`→ ConsolidatedPaxProcessor: INDIVIDUAL ship data final - ${consolidatedData.records.length} records from ${shipId} ONLY (no cross-ship aggregation)`);

    // Process INDIVIDUAL ship PAX - UPDATE EXISTING or CREATE NEW (with multi-tab support)
    const outputFilename = await this.updateOrCreateConsolidatedPax(consolidatedData, templatePath, false);
    
    return {
      filename: outputFilename,
      data: consolidatedData
    };
  }

  /**
   * Generate consolidated PAX report (multi-ship aggregation)
   */
  async generateConsolidatedPax(consolidatedData: ConsolidatedPaxData, templatePath: string): Promise<string> {
    console.log(`→ ConsolidatedPaxProcessor: Generating consolidated PAX report from ${consolidatedData.contributingShips.length} ships`);
    
    // Load PAX template
    const workbook = new ExcelJS.Workbook();
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`PAX template not found at: ${templatePath}`);
    }
    
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
   * Generate single ship PAX report (individual values, no aggregation with MULTI-TAB SUPPORT)
   */
  async generateSingleShipPax(consolidatedData: ConsolidatedPaxData, templatePath: string): Promise<string> {
    console.log(`→ ConsolidatedPaxProcessor: Generating single ship PAX report from ${consolidatedData.contributingShips[0]} (MULTI-TAB)`);
    
    // Load PAX template
    const workbook = new ExcelJS.Workbook();
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`PAX template not found at: ${templatePath}`);
    }
    
    await workbook.xlsx.readFile(templatePath);
    
    // Validate PAX template has all required tabs
    const validation = paxTabRouter.validatePaxTemplate(workbook);
    if (!validation.isValid) {
      console.warn(`→ ConsolidatedPaxProcessor: PAX template missing ${validation.missingTabs.length} tabs: ${validation.missingTabs.join(', ')}`);
    }
    
    // Group records by target tab based on date
    const recordsByTab = this.groupRecordsByTab(consolidatedData.records);
    
    console.log(`→ ConsolidatedPaxProcessor: Single ship records distributed across ${Object.keys(recordsByTab).length} tab(s)`);
    
    // Process each tab separately with its records
    for (const [tabName, tabRecords] of Object.entries(recordsByTab)) {
      console.log(`→ ConsolidatedPaxProcessor: Processing tab "${tabName}" with ${tabRecords.length} record(s)`);
      
      const worksheet = workbook.getWorksheet(tabName);
      
      if (!worksheet) {
        console.error(`→ ConsolidatedPaxProcessor: Tab "${tabName}" not found in workbook, skipping ${tabRecords.length} records`);
        continue;
      }
      
      // Create tab-specific data for single ship
      const tabConsolidatedData: ConsolidatedPaxData = {
        contributingShips: consolidatedData.contributingShips,
        records: tabRecords,
        totalRecordCount: tabRecords.length,
        lastUpdatedByShip: consolidatedData.lastUpdatedByShip
      };
      
      // Generate single ship report data for this tab (no aggregation, SAME DELIMITER LOGIC)
      await this.populateSingleShipReport(worksheet, tabConsolidatedData);
      
      console.log(`→ ConsolidatedPaxProcessor: ✓ Tab "${tabName}" populated successfully (single ship)`);
    }

    // Save to consolidated directory
    const outputFilename = `consolidated_pax_${Date.now()}.xlsx`;
    const consolidatedDir = path.join(process.cwd(), 'output', 'consolidated', 'pax');
    const outputPath = path.join(consolidatedDir, outputFilename);
    
    // Ensure consolidated directory exists
    if (!fs.existsSync(consolidatedDir)) {
      fs.mkdirSync(consolidatedDir, { recursive: true });
    }
    
    await workbook.xlsx.writeFile(outputPath);

    console.log(`→ ConsolidatedPaxProcessor: Single ship PAX report saved to ${outputPath}`);
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

    console.log(`→ ConsolidatedPaxProcessor: Aggregating ${consolidatedData.records.length} records from ${consolidatedData.contributingShips.length} ships`);
    
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
    
    // Use the actual selected ship name from the triggering ship
    let consolidatedShipName = 'Unknown Ship';
    if (triggeringShipRecord && triggeringShipRecord.shipName) {
      consolidatedShipName = triggeringShipRecord.shipName;
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
   * Populate single ship report with individual values (no aggregation)
   */
  private async populateSingleShipReport(worksheet: ExcelJS.Worksheet, consolidatedData: ConsolidatedPaxData): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: Populating single ship report with ${consolidatedData.records.length} individual records`);

    // Use individual values from single ship (no aggregation)
    const tourTotals = {
      catamaran: { sold: 0, allotment: 0 },
      champagne: { sold: 0, allotment: 0 },
      invisible: { sold: 0, allotment: 0 }
    };

    let totalPaxOnBoard = 0;
    let totalPaxOnTour = 0;

    console.log(`→ ConsolidatedPaxProcessor: Using individual values from single ship (no aggregation)`);
    
    // Use individual values from each tour type (no += aggregation)
    for (const record of consolidatedData.records) {
      console.log(`→ ConsolidatedPaxProcessor: Processing ${record.tourType} - sold: ${record.sold}, allot: ${record.allotment}, onBoard: ${record.paxOnBoard}, onTour: ${record.paxOnTour}`);
      
      // Set direct values for each tour type (no aggregation)
      if (record.tourType === 'catamaran') {
        tourTotals.catamaran.sold = record.sold;
        tourTotals.catamaran.allotment = record.allotment;
      } else if (record.tourType === 'champagne') {
        tourTotals.champagne.sold = record.sold;
        tourTotals.champagne.allotment = record.allotment;
      } else if (record.tourType === 'invisible') {
        tourTotals.invisible.sold = record.sold;
        tourTotals.invisible.allotment = record.allotment;
      }

      // For PAX totals, accumulate within same ship (this is correct)
      totalPaxOnBoard += record.paxOnBoard;
      totalPaxOnTour += record.paxOnTour;
    }

    // Get ship data from the single ship
    const shipRecord = consolidatedData.records[0];
    const shipDate = shipRecord?.date || new Date().toLocaleDateString('en-GB');
    const shipCruiseLine = shipRecord?.cruiseLine || 'Unknown Cruise Line';
    const shipName = shipRecord?.shipName || 'Unknown Ship';

    console.log(`→ ConsolidatedPaxProcessor: Using single ship data - Date: ${shipDate}, Cruise: ${shipCruiseLine}, Ship: ${shipName}`);

    // Use template row 4 for delimiter replacement
    const templateRow = 4;

    // Replace delimiters with single ship data
    this.replaceDelimiter(worksheet, templateRow, 1, '{{date}}', shipDate);
    this.replaceDelimiter(worksheet, templateRow, 2, '{{cruise_line}}', shipCruiseLine);
    this.replaceDelimiter(worksheet, templateRow, 3, '{{ship_name}}', shipName);

    // Tour-specific individual data (no aggregation)
    this.replaceDelimiter(worksheet, templateRow, 4, '{{cat_sold}}', tourTotals.catamaran.sold);
    this.replaceDelimiter(worksheet, templateRow, 5, '{{cat_allot}}', tourTotals.catamaran.allotment);
    this.replaceDelimiter(worksheet, templateRow, 6, '{{champ_sold}}', tourTotals.champagne.sold);
    this.replaceDelimiter(worksheet, templateRow, 7, '{{champ_allot}}', tourTotals.champagne.allotment);
    this.replaceDelimiter(worksheet, templateRow, 8, '{{inv_sold}}', tourTotals.invisible.sold);
    this.replaceDelimiter(worksheet, templateRow, 9, '{{inv_allot}}', tourTotals.invisible.allotment);

    // Analysis data (columns BT=72, BU=73)
    this.replaceDelimiter(worksheet, templateRow, 72, '{{pax_on_board}}', totalPaxOnBoard);
    this.replaceDelimiter(worksheet, templateRow, 73, '{{pax_on_tour}}', totalPaxOnTour);

    console.log(`→ ConsolidatedPaxProcessor: Individual ship values - Cat: ${tourTotals.catamaran.sold}/${tourTotals.catamaran.allotment}, Champ: ${tourTotals.champagne.sold}/${tourTotals.champagne.allotment}, Inv: ${tourTotals.invisible.sold}/${tourTotals.invisible.allotment}`);
    console.log(`→ ConsolidatedPaxProcessor: Ship totals - OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
  }

  /**
   * Main entry point for consolidated PAX generation
   */
  async processConsolidatedPax(templatePath: string, triggeringShipId: string = 'system', forceCreateNew: boolean = false, selectedShipName?: string): Promise<{ filename: string; data: ConsolidatedPaxData }> {
    console.log(`→ ConsolidatedPaxProcessor: Starting consolidated PAX generation (triggered by ${triggeringShipId})`);

    try {
      // Step 1: Collect data from all ships
      const allShipData = await this.collectAllDispatchData();
      
      if (Object.keys(allShipData).length === 0) {
        throw new Error('No dispatch data found from any ship');
      }
      
      // Override ship name if provided from dropdown selection
      if (selectedShipName && allShipData[triggeringShipId]) {
        console.log(`→ ConsolidatedPaxProcessor: Overriding ship name for ${triggeringShipId} from "${allShipData[triggeringShipId].shipName}" to "${selectedShipName}"`);
        allShipData[triggeringShipId].shipName = selectedShipName;
      }

      // Step 2: Validate and merge data
      const consolidatedData = this.validateCrossShipData(allShipData);
      consolidatedData.lastUpdatedByShip = triggeringShipId;

      // Step 3: Check if existing consolidated PAX exists and update it, or create new one
      const filename = await this.updateOrCreateConsolidatedPax(consolidatedData, templatePath, forceCreateNew);

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
  private async updateOrCreateConsolidatedPax(consolidatedData: ConsolidatedPaxData, templatePath: string, forceCreateNew: boolean = false): Promise<string> {
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

      if (existingFiles.length > 0 && !forceCreateNew) {
        const latestFile = existingFiles[0];
        const existingFilePath = path.join(consolidatedOutputDir, latestFile);
        
        // Check if the file has proper content before trying to read it
        const fileStats = fs.statSync(existingFilePath);
        if (fileStats.size === 0) {
          console.log(`→ ConsolidatedPaxProcessor: Latest file ${latestFile} is empty (0 bytes), skipping and creating new file`);
          // Skip empty/corrupted file and create a new one
          return await this.generateSingleShipPax(consolidatedData, templatePath);
        }
        
        // Check if file is too small (likely contains wrong template data)
        // Consolidated PAX files are typically 10-30KB, dispatch templates are ~10KB
        // Only reject files smaller than 5KB as they're likely corrupted
        if (fileStats.size < 5000) {
          console.log(`→ ConsolidatedPaxProcessor: Latest file ${latestFile} is too small (${fileStats.size} bytes), likely corrupted. Creating new file.`);
          // Skip corrupted file and create a new one
          return await this.generateSingleShipPax(consolidatedData, templatePath);
        }
        
        console.log(`→ ConsolidatedPaxProcessor: Updating existing consolidated PAX: ${latestFile} (${fileStats.size} bytes)`);
        
        // Update existing consolidated PAX
        await this.updateExistingConsolidatedPax(existingFilePath, consolidatedData);
        return latestFile;
      }
    }

    // No existing file found, create new one
    console.log(`→ ConsolidatedPaxProcessor: No existing consolidated PAX found, creating new one`);
    return await this.generateSingleShipPax(consolidatedData, templatePath);
  }

  /**
   * Group records by target tab based on date
   */
  private groupRecordsByTab(records: CrossShipPaxRecord[]): { [tabName: string]: CrossShipPaxRecord[] } {
    console.log('→ ConsolidatedPaxProcessor: ═══════════════════════════════════════');
    console.log('→ ConsolidatedPaxProcessor: GROUPING RECORDS BY TAB (MULTI-TAB LOGIC)');
    console.log(`→ ConsolidatedPaxProcessor: Total records to group: ${records.length}`);
    console.log('→ ConsolidatedPaxProcessor: ═══════════════════════════════════════');
    
    const recordsByTab: { [tabName: string]: CrossShipPaxRecord[] } = {};
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      console.log(`→ ConsolidatedPaxProcessor: [Record ${i+1}/${records.length}]`);
      console.log(`  Ship: ${record.shipId}`);
      console.log(`  Tour: ${record.tourName}`);
      console.log(`  Date field value: "${record.date}"`);
      
      // Get the tab name from the date (doesn't need workbook)
      const { tabName, parsedDate } = paxTabRouter.getTabNameFromDate(record.date);
      
      console.log(`  → ✓ Parsed date successfully: ${parsedDate ? parsedDate.toLocaleDateString('en-US') : 'N/A'}`);
      console.log(`  → ✓ Routed to tab: "${tabName}"`);
      
      if (!recordsByTab[tabName]) {
        recordsByTab[tabName] = [];
      }
      recordsByTab[tabName].push(record);
    }
    
    console.log('→ ConsolidatedPaxProcessor: ═══ GROUPING SUMMARY ═══');
    for (const [tabName, tabRecords] of Object.entries(recordsByTab)) {
      const ships = [...new Set(tabRecords.map(r => r.shipId))].join(', ');
      console.log(`→ ConsolidatedPaxProcessor: Tab "${tabName}" has ${tabRecords.length} record(s) from ships: ${ships}`);
    }
    console.log('→ ConsolidatedPaxProcessor: ═══════════════════════════════════════');
    
    return recordsByTab;
  }

  /**
   * Update existing consolidated PAX file with new records (MULTI-TAB SUPPORT)
   */
  private async updateExistingConsolidatedPax(
    existingFilePath: string,
    consolidatedData: ConsolidatedPaxData
  ): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: ═══════════════════════════════════════`);
    console.log(`→ ConsolidatedPaxProcessor: UPDATING EXISTING CONSOLIDATED PAX FILE`);
    console.log(`→ ConsolidatedPaxProcessor: File: ${path.basename(existingFilePath)}`);
    console.log(`→ ConsolidatedPaxProcessor: Ship: ${consolidatedData.lastUpdatedByShip}`);
    console.log(`→ ConsolidatedPaxProcessor: Records: ${consolidatedData.records.length}`);
    console.log(`→ ConsolidatedPaxProcessor: ═══════════════════════════════════════`);
    
    // Load existing PAX file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(existingFilePath);
    
    // Validate template has all required tabs
    const validation = paxTabRouter.validatePaxTemplate(workbook);
    if (!validation.isValid) {
      console.warn(`→ ConsolidatedPaxProcessor: PAX template missing ${validation.missingTabs.length} tabs: ${validation.missingTabs.join(', ')}`);
    }
    
    // Group records by tab
    const recordsByTab = this.groupRecordsByTab(consolidatedData.records);
    
    console.log(`→ ConsolidatedPaxProcessor: Updating ${Object.keys(recordsByTab).length} tab(s) in EXISTING file (not creating new)`);
    
    // Process each tab that has new records
    for (const [tabName, tabRecords] of Object.entries(recordsByTab)) {
      console.log(`→ ConsolidatedPaxProcessor: Updating tab "${tabName}" with ${tabRecords.length} new record(s)`);
      
      const worksheet = workbook.getWorksheet(tabName);
      
      if (!worksheet) {
        console.error(`→ ConsolidatedPaxProcessor: Tab "${tabName}" not found in workbook, skipping ${tabRecords.length} records`);
        continue;
      }
      
      // Find the next available row in this tab
      const nextRow = this.findNextAvailableRow(worksheet);
      console.log(`→ ConsolidatedPaxProcessor: Tab "${tabName}" - next available row: ${nextRow}`);
      
      // Create tab-specific data
      const tabConsolidatedData: ConsolidatedPaxData = {
        contributingShips: consolidatedData.contributingShips,
        records: tabRecords,
        totalRecordCount: tabRecords.length,
        lastUpdatedByShip: consolidatedData.lastUpdatedByShip
      };
      
      // Add the consolidated record for this tab
      await this.addConsolidatedRecordToExistingFile(worksheet, tabConsolidatedData, nextRow);
      
      console.log(`→ ConsolidatedPaxProcessor: ✓ Tab "${tabName}" updated successfully at row ${nextRow}`);
    }
    
    // Save the updated workbook back to the same file (OVERWRITE existing)
    console.log(`→ ConsolidatedPaxProcessor: Saving changes to EXISTING file: ${path.basename(existingFilePath)}`);
    await workbook.xlsx.writeFile(existingFilePath);
    
    console.log('→ ConsolidatedPaxProcessor: ✓ Successfully updated existing consolidated PAX file with multi-tab support');
    console.log(`→ ConsolidatedPaxProcessor: ═══════════════════════════════════════`);
  }

  /**
   * Find the next available row in consolidated PAX report (same logic as individual PAX)
   */
  private findNextAvailableRow(worksheet: ExcelJS.Worksheet): number {
    // Start checking from row 5 (after template row 4)
    let currentRow = 5;
    
    // Look for the first empty row by checking column A (date column)
    while (currentRow <= 1000) { // Safety limit
      const cellA = worksheet.getCell(currentRow, 1); // Column A
      if (!cellA.value || cellA.value === '') {
        return currentRow;
      }
      currentRow++;
    }
    
    // If we reach here, assume we can add at row 5 as fallback
    return 5;
  }

  /**
   * Add new consolidated record to existing file (same pattern as individual PAX)
   */
  private async addConsolidatedRecordToExistingFile(
    worksheet: ExcelJS.Worksheet,
    consolidatedData: ConsolidatedPaxData,
    targetRow: number
  ): Promise<void> {
    console.log(`→ ConsolidatedPaxProcessor: Adding consolidated record to row ${targetRow}`);

    // Copy the template row (row 4) formatting to preserve styling
    const templateRow = worksheet.getRow(4);
    const newRow = worksheet.getRow(targetRow);

    // Copy template row formatting to new row
    templateRow.eachCell((cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);
      
      // Copy formatting
      newCell.font = cell.font;
      newCell.alignment = cell.alignment;
      newCell.border = cell.border;
      newCell.fill = cell.fill;
      newCell.numFmt = cell.numFmt;
    });

    // Populate the new row with consolidated data (same logic as populateConsolidatedReport)
    await this.populateConsolidatedRowData(newRow, consolidatedData);
  }

  /**
   * Populate a single row with consolidated PAX data (FIXED: No aggregation - direct ship values)
   */
  private async populateConsolidatedRowData(row: ExcelJS.Row, consolidatedData: ConsolidatedPaxData): Promise<void> {
    // FIXED: Use direct single-ship values instead of aggregating
    // Initialize tour totals to zero (will be populated from single ship's records)
    const tourTotals = {
      catamaran: { sold: 0, allotment: 0 },
      champagne: { sold: 0, allotment: 0 },
      invisible: { sold: 0, allotment: 0 }
    };

    let totalPaxOnBoard = 0;
    let totalPaxOnTour = 0;

    // Filter to only include records from the triggering ship (CRITICAL FIX)
    const triggeringShipRecords = consolidatedData.records.filter(record => 
      record.shipId === consolidatedData.lastUpdatedByShip
    );

    console.log(`→ ConsolidatedPaxProcessor: Processing ${triggeringShipRecords.length} records from ship ${consolidatedData.lastUpdatedByShip}`);

    // Process records from SINGLE SHIP ONLY (no cross-ship aggregation)
    // For single ship, we can have multiple tour types, so we sum within the ship only
    for (const record of triggeringShipRecords) {
      console.log(`→ ConsolidatedPaxProcessor: Ship ${record.shipId} record - ${record.tourType}: sold=${record.sold}, allot=${record.allotment}, onBoard=${record.paxOnBoard}, onTour=${record.paxOnTour}`);
      
      // Set direct values by tour type for THIS SHIP ONLY
      if (record.tourType === 'catamaran') {
        tourTotals.catamaran.sold = record.sold;
        tourTotals.catamaran.allotment = record.allotment;
      } else if (record.tourType === 'champagne') {
        tourTotals.champagne.sold = record.sold;
        tourTotals.champagne.allotment = record.allotment;  
      } else if (record.tourType === 'invisible') {
        tourTotals.invisible.sold = record.sold;
        tourTotals.invisible.allotment = record.allotment;
      }

      // For PAX totals within same ship, accumulate across all tours
      totalPaxOnBoard += record.paxOnBoard;
      totalPaxOnTour += record.paxOnTour;
      
      console.log(`→ ConsolidatedPaxProcessor: Running totals - OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
    }

    console.log(`→ ConsolidatedPaxProcessor: Final ship values - Cat: ${tourTotals.catamaran.sold}/${tourTotals.catamaran.allotment}, Champ: ${tourTotals.champagne.sold}/${tourTotals.champagne.allotment}, Inv: ${tourTotals.invisible.sold}/${tourTotals.invisible.allotment}, PAX: ${totalPaxOnBoard}/${totalPaxOnTour}`);

    // Get representative data (use triggering ship's data for headers)
    const triggeringShipRecord = consolidatedData.records.find(record => 
      record.shipId === consolidatedData.lastUpdatedByShip
    ) || consolidatedData.records[0];
    
    const consolidatedDate = triggeringShipRecord?.date || new Date().toLocaleDateString('en-GB');
    const consolidatedCruiseLine = triggeringShipRecord?.cruiseLine || 'Multi-Ship Operation';
    
    // Use the actual selected ship name from the triggering ship
    let consolidatedShipName = 'Unknown Ship';
    if (triggeringShipRecord && triggeringShipRecord.shipName) {
      consolidatedShipName = triggeringShipRecord.shipName;
    }

    // Set direct mapping values
    row.getCell(1).value = consolidatedDate; // A: date
    row.getCell(2).value = consolidatedCruiseLine; // B: cruise_line
    row.getCell(3).value = consolidatedShipName; // C: ship_name

    // Tour-specific aggregated data
    row.getCell(4).value = tourTotals.catamaran.sold; // D: cat_sold
    row.getCell(5).value = tourTotals.catamaran.allotment; // E: cat_allot
    row.getCell(6).value = tourTotals.champagne.sold; // F: champ_sold
    row.getCell(7).value = tourTotals.champagne.allotment; // G: champ_allot
    row.getCell(8).value = tourTotals.invisible.sold; // H: inv_sold
    row.getCell(9).value = tourTotals.invisible.allotment; // I: inv_allot

    // Analysis data (columns BT=72, BU=73)
    row.getCell(72).value = totalPaxOnBoard; // BT: pax_on_board
    row.getCell(73).value = totalPaxOnTour; // BU: pax_on_tour

    console.log(`→ ConsolidatedPaxProcessor: Added consolidated record - Ship: ${consolidatedShipName}, Date: ${consolidatedDate}, OnBoard: ${totalPaxOnBoard}, OnTour: ${totalPaxOnTour}`);
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
        console.log(`→ ConsolidatedPaxProcessor: ✓ Validated tour "${record.tourName}" as ${tourType}`);
      } else {
        console.log(`→ ConsolidatedPaxProcessor: ✗ Invalid tour name "${record.tourName}" - skipping record`);
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