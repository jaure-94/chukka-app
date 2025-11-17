import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import type { ExcelData } from "../../shared/schema.js";
import { storage } from "../storage.js";

export class TemplateProcessor {
  private templatesDir = path.join(process.cwd(), "server", "templates");
  private outputDir = path.join(process.cwd(), "output");

  constructor() {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Register Handlebars helpers
    this.registerHelpers();
  }

  private registerHelpers() {
    Handlebars.registerHelper("formatCurrency", (value: any) => {
      if (typeof value === "number") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      }
      return value;
    });

    Handlebars.registerHelper("formatDate", (value: any) => {
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return value;
    });

    Handlebars.registerHelper("sum", (array: any[], field: string) => {
      return array.reduce((sum, item) => {
        const value = parseFloat(item[field]) || 0;
        return sum + value;
      }, 0);
    });

    Handlebars.registerHelper("count", (array: any[]) => {
      return array ? array.length : 0;
    });

    Handlebars.registerHelper("contains", (array: any[], value: any) => {
      if (!Array.isArray(array)) return false;
      return array.includes(value);
    });
  }

  async processTemplate(
    templateType: string,
    excelData: ExcelData[],
    fileId: number
  ): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateType}.hbs`);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateType}`);
      }

      const templateContent = fs.readFileSync(templatePath, "utf-8");
      const template = Handlebars.compile(templateContent);

      // Group data by sheet
      const dataBySheet = excelData.reduce((acc, row) => {
        if (!acc[row.sheetName]) {
          acc[row.sheetName] = [];
        }
        acc[row.sheetName].push(row.data);
        return acc;
      }, {} as Record<string, any[]>);

      // Prepare template data
      const templateData = {
        fileId,
        sheets: Object.entries(dataBySheet).map(([name, data]) => ({
          name,
          data,
          summary: this.generateSummary(data),
        })),
        generatedAt: new Date().toISOString(),
        totalRecords: excelData.length,
      };

      const htmlContent = template(templateData);
      
      // Save to file
      const outputFileName = `${templateType}_${fileId}_${Date.now()}.html`;
      const outputPath = path.join(this.outputDir, outputFileName);
      fs.writeFileSync(outputPath, htmlContent);

      return `output/${outputFileName}`;
    } catch (error) {
      throw new Error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSummary(data: any[]): Record<string, any> {
    if (!data || data.length === 0) {
      return { recordCount: 0 };
    }

    const summary: Record<string, any> = {
      recordCount: data.length,
    };

    // Generate basic statistics for numeric fields
    const firstRow = data[0];
    Object.keys(firstRow).forEach(key => {
      const values = data.map(row => row[key]).filter(val => val !== null && val !== undefined);
      const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
      
      if (numericValues.length > 0) {
        summary[`${key}_sum`] = numericValues.reduce((sum, val) => sum + val, 0);
        summary[`${key}_avg`] = summary[`${key}_sum`] / numericValues.length;
        summary[`${key}_min`] = Math.min(...numericValues);
        summary[`${key}_max`] = Math.max(...numericValues);
      }
    });

    return summary;
  }

  /**
   * Find the active consolidated PAX template
   */
  async findConsolidatedPaxTemplate(): Promise<string | null> {
    console.log('→ TemplateProcessor: Legacy findConsolidatedPaxTemplate called - redirecting to getConsolidatedPaxTemplatePath');
    
    // Redirect to the new method that uses individual PAX templates
    try {
      return await this.getConsolidatedPaxTemplatePath();
    } catch (error) {
      console.error('→ TemplateProcessor: Error redirecting to getConsolidatedPaxTemplatePath:', error);
      return null;
    }
  }

  /**
   * Validate that a PAX template has the required delimiters
   */
  async validatePaxTemplate(templatePath: string): Promise<boolean> {
    try {
      // For now, just check if the file exists and is readable
      const stats = fs.statSync(templatePath);
      return stats.isFile() && stats.size > 0;
    } catch (error) {
      console.error('→ TemplateProcessor: PAX template validation failed:', error);
      return false;
    }
  }

  /**
   * Get consolidated PAX template path with fallback
   */
  async getConsolidatedPaxTemplatePath(): Promise<string> {
    console.log('→ TemplateProcessor: Getting consolidated PAX template path');
    
    // Always use the standard individual ship PAX template for consolidated reports
    // This ensures consolidated reports have the same structure as individual ship reports
    console.log('→ TemplateProcessor: Using standard individual PAX template for consolidated report');
    
    try {
      const shipPaxTemplate = await storage.getActivePaxTemplate('ship-a');
      
      if (shipPaxTemplate) {
        const templatePath = shipPaxTemplate.filePath;
        console.log(`→ TemplateProcessor: Found individual PAX template: ${templatePath}`);
        if (await this.validatePaxTemplate(templatePath)) {
          console.log(`→ TemplateProcessor: Using individual PAX template for consolidated report: ${templatePath}`);
          return templatePath;
        }
      }
    } catch (error) {
      console.error('→ TemplateProcessor: Error getting individual PAX template:', error);
    }
    
    // If individual template fails, fallback to file system search
    console.log('→ TemplateProcessor: Individual PAX template not available, searching file system');
    const ships = ['ship-a', 'ship-b', 'ship-c'];
    for (const shipId of ships) {
      const shipTemplatesDir = path.join(process.cwd(), "uploads", shipId);
      if (fs.existsSync(shipTemplatesDir)) {
        const files = fs.readdirSync(shipTemplatesDir);
        const paxTemplate = files.find(file => 
          file.toLowerCase().includes('pax') && 
          file.endsWith('.xlsx')
        );
        
        if (paxTemplate) {
          const templatePath = path.join(shipTemplatesDir, paxTemplate);
          console.log(`→ TemplateProcessor: Using fallback PAX template from ${shipId}: ${paxTemplate}`);
          return templatePath;
        }
      }
    }
    
    throw new Error('No valid PAX template available for consolidated report generation');
  }
}
