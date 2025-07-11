import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import type { CumulativeEodReport, InsertCumulativeEodReport } from "@shared/schema";

export class CumulativeEodManager {
  private outputDir = path.join(process.cwd(), "output");
  private cumulativeDir = path.join(process.cwd(), "cumulative");

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.cumulativeDir)) {
      fs.mkdirSync(this.cumulativeDir, { recursive: true });
    }
  }

  /**
   * Get the current active cumulative EOD report (serves as template for new data)
   */
  async getActiveCumulativeTemplate(): Promise<{ report: CumulativeEodReport; filePath: string } | null> {
    try {
      const activeReport = await storage.getActiveCumulativeEodReport();
      
      if (!activeReport) {
        console.log('→ CumulativeEOD: No active cumulative EOD report found');
        return null;
      }

      const filePath = path.join(this.cumulativeDir, activeReport.filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`→ CumulativeEOD: Active report file not found: ${filePath}`);
        return null;
      }

      console.log(`→ CumulativeEOD: Found active template: ${activeReport.filename} (${activeReport.tourCount} tours)`);
      return { report: activeReport, filePath };
    } catch (error) {
      console.error('→ CumulativeEOD: Error getting active template:', error);
      return null;
    }
  }

  /**
   * Create a new cumulative EOD report from the original template
   */
  async createInitialCumulativeReport(
    originalTemplatePath: string,
    outputPath: string,
    tourCount: number
  ): Promise<CumulativeEodReport> {
    try {
      // Copy original template to cumulative directory
      const filename = path.basename(outputPath);
      const cumulativeFilePath = path.join(this.cumulativeDir, filename);
      
      fs.copyFileSync(outputPath, cumulativeFilePath);
      
      // Create database record
      const reportData: InsertCumulativeEodReport = {
        filename: filename,
        originalFilename: `cumulative_eod_${Date.now()}.xlsx`,
        filePath: cumulativeFilePath,
        version: 1,
        isActive: true,
        tourCount: tourCount
      };

      const cumulativeReport = await storage.createCumulativeEodReport(reportData);
      
      console.log(`→ CumulativeEOD: Created initial cumulative report: ${filename} (${tourCount} tours)`);
      return cumulativeReport;
    } catch (error) {
      console.error('→ CumulativeEOD: Error creating initial cumulative report:', error);
      throw error;
    }
  }

  /**
   * Update existing cumulative EOD report with new tour data
   */
  async updateCumulativeReport(
    activeReport: CumulativeEodReport,
    activeFilePath: string,
    newTourData: any[],
    outputPath: string
  ): Promise<CumulativeEodReport> {
    try {
      console.log(`→ CumulativeEOD: Updating cumulative report with ${newTourData.length} new tours`);
      
      // Load existing cumulative report
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(activeFilePath);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        throw new Error('No worksheet found in cumulative EOD report');
      }

      // Find where to insert new tour data (after existing tours, before totals)
      const insertionRow = this.findInsertionPoint(worksheet, activeReport.tourCount);
      
      // Insert new tour sections
      this.insertNewTourSections(worksheet, insertionRow, newTourData);
      
      // Update totals section
      this.updateTotalsSection(worksheet, activeReport.tourCount + newTourData.length);
      
      // Save updated file
      await workbook.xlsx.writeFile(outputPath);
      
      // Update database record
      const updatedReport = await storage.updateCumulativeEodReport(activeReport.id, {
        tourCount: activeReport.tourCount + newTourData.length,
        version: activeReport.version + 1
      });
      
      // Copy updated file back to cumulative directory
      fs.copyFileSync(outputPath, activeFilePath);
      
      console.log(`→ CumulativeEOD: Updated cumulative report: ${updatedReport.tourCount} total tours`);
      return updatedReport;
    } catch (error) {
      console.error('→ CumulativeEOD: Error updating cumulative report:', error);
      throw error;
    }
  }

  /**
   * Find where to insert new tour data in existing cumulative report
   */
  private findInsertionPoint(worksheet: ExcelJS.Worksheet, existingTourCount: number): number {
    // Each tour takes 17 rows (16 for template + 1 blank), starting from row 23
    // After all tours, we need to insert before the totals section
    const insertionRow = 23 + (existingTourCount * 17);
    console.log(`→ CumulativeEOD: Insertion point for new tours: row ${insertionRow}`);
    return insertionRow;
  }

  /**
   * Insert new tour sections into the cumulative report
   */
  private insertNewTourSections(worksheet: ExcelJS.Worksheet, insertionRow: number, newTourData: any[]): void {
    // This method will be implemented with the tour insertion logic
    console.log(`→ CumulativeEOD: Inserting ${newTourData.length} new tour sections at row ${insertionRow}`);
    
    // For now, we'll add a placeholder - this will be implemented in the next step
    // when we integrate with the existing EOD processing logic
  }

  /**
   * Update the totals section with new tour count
   */
  private updateTotalsSection(worksheet: ExcelJS.Worksheet, totalTourCount: number): void {
    // This method will be implemented to update the totals section
    console.log(`→ CumulativeEOD: Updating totals section for ${totalTourCount} total tours`);
    
    // For now, we'll add a placeholder - this will be implemented in the next step
  }

  /**
   * Set a generated EOD report as the new active cumulative template
   */
  async promoteToActiveCumulative(generatedEodPath: string, tourCount: number): Promise<CumulativeEodReport> {
    try {
      // Copy generated EOD to cumulative directory
      const filename = `cumulative_${Date.now()}.xlsx`;
      const cumulativeFilePath = path.join(this.cumulativeDir, filename);
      
      fs.copyFileSync(generatedEodPath, cumulativeFilePath);
      
      // Create new cumulative report record
      const reportData: InsertCumulativeEodReport = {
        filename: filename,
        originalFilename: path.basename(generatedEodPath),
        filePath: cumulativeFilePath,
        version: 1,
        isActive: false, // Will be set to active after creation
        tourCount: tourCount
      };

      const newCumulativeReport = await storage.createCumulativeEodReport(reportData);
      
      // Set as active (this will deactivate previous active report)
      const activeReport = await storage.setActiveCumulativeEodReport(newCumulativeReport.id);
      
      console.log(`→ CumulativeEOD: Promoted generated EOD to active cumulative: ${filename} (${tourCount} tours)`);
      return activeReport;
    } catch (error) {
      console.error('→ CumulativeEOD: Error promoting to active cumulative:', error);
      throw error;
    }
  }
}

export const cumulativeEodManager = new CumulativeEodManager();