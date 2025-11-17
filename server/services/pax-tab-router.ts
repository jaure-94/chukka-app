import ExcelJS from 'exceljs';
import { parse, format, isValid } from 'date-fns';

export interface TabRoutingResult {
  success: boolean;
  tabName: string | null;
  worksheet: ExcelJS.Worksheet | null;
  parsedDate: Date | null;
  error?: string;
}

/**
 * PaxTabRouter - Routes PAX records to the correct monthly tab
 * Maps dates like "22/12/2025" to tabs like "Dec 25"
 */
export class PaxTabRouter {
  // Map of YYYY-M format to tab names
  private readonly TAB_MAP: { [key: string]: string } = {
    '2025-10': 'Oct 25',
    '2025-11': 'Nov 25',
    '2025-12': 'Dec 25',
    '2026-1': 'Jan 26',
    '2026-2': 'Feb 26',
    '2026-3': 'Mar 26',
    '2026-4': 'Apr 26',
    '2026-5': 'May 26',
    '2026-6': 'Jun 26',
    '2026-7': 'July 26',
    '2026-8': 'Aug 26',
    '2026-9': 'Sept 26',
  };

  /**
   * Parse date from B5 cell value (handles various formats)
   */
  parseDateFromB5(dateValue: any): Date | null {
    if (!dateValue) {
      console.log('→ PaxTabRouter: Empty date value, using current date');
      return new Date();
    }

    // If already a Date object
    if (dateValue instanceof Date) {
      if (isValid(dateValue)) {
        console.log(`→ PaxTabRouter: Valid Date object: ${format(dateValue, 'M/d/yyyy')}`);
        return dateValue;
      }
    }

    // If it's a string, try multiple formats
    if (typeof dateValue === 'string') {
      console.log(`→ PaxTabRouter: Parsing date string: "${dateValue}"`);
      
      const formats = [
        'dd/MM/yyyy',  // 22/12/2025
        'MM/dd/yyyy',  // 12/22/2025
        'd/M/yyyy',    // 2/1/2025
        'yyyy-MM-dd',  // 2025-12-22
        'dd-MMM-yyyy', // 10-Oct-2025
        'd-MMM-yyyy',  // 5-Oct-2025
      ];

      // Try parsing with original and case-normalized variants to accept e.g. "10-oct-2025"
      const candidates = [dateValue, dateValue.toUpperCase(), dateValue.toLowerCase()];
      for (const candidate of candidates) {
        for (const fmt of formats) {
          try {
            const parsed = parse(candidate, fmt, new Date());
            if (isValid(parsed)) {
              console.log(`→ PaxTabRouter: Successfully parsed with format "${fmt}": ${parsed.toISOString()}`);
              return parsed;
            }
          } catch (e) {
            // Continue to next format
          }
        }
      }
    }

    // If it's an Excel serial number
    if (typeof dateValue === 'number' && dateValue > 1 && dateValue < 100000) {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
      if (isValid(date)) {
        console.log(`→ PaxTabRouter: Parsed Excel serial number ${dateValue} to ${format(date, 'M/d/yyyy')}`);
        return date;
      }
    }

    console.error(`→ PaxTabRouter: Failed to parse date: ${dateValue} (type: ${typeof dateValue})`);
    return null;
  }

  /**
   * Get target tab name from parsed date
   */
  getTargetTabName(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-indexed, so add 1
    const key = `${year}-${month}`;
    
    const tabName = this.TAB_MAP[key];
    
    console.log(`→ PaxTabRouter: Date ${month}/${date.getDate()}/${year} → Tab "${tabName || 'NOT FOUND'}"`);
    
    return tabName || 'Oct 25'; // Fallback to Oct 25
  }

  /**
   * Get tab name from date value (without needing workbook)
   */
  getTabNameFromDate(dateValue: any): { tabName: string; parsedDate: Date | null } {
    const parsedDate = this.parseDateFromB5(dateValue);
    
    if (!parsedDate) {
      console.warn('→ PaxTabRouter: Failed to parse date, defaulting to Oct 25');
      return { tabName: 'Oct 25', parsedDate: null };
    }

    const tabName = this.getTargetTabName(parsedDate);
    return { tabName, parsedDate };
  }

  /**
   * Route to the correct tab in the workbook
   */
  routeToTab(workbook: ExcelJS.Workbook, dateValue: any): TabRoutingResult {
    // Parse the date
    const parsedDate = this.parseDateFromB5(dateValue);
    
    if (!parsedDate) {
      return {
        success: false,
        tabName: null,
        worksheet: null,
        parsedDate: null,
        error: 'Failed to parse date'
      };
    }

    // Get target tab name
    const tabName = this.getTargetTabName(parsedDate);
    
    // Get the worksheet
    const worksheet = this.getWorksheet(workbook, tabName);
    
    if (!worksheet) {
      console.error(`→ PaxTabRouter: Tab "${tabName}" not found in workbook`);
      return {
        success: false,
        tabName,
        worksheet: null,
        parsedDate,
        error: `Tab "${tabName}" not found`
      };
    }

    return {
      success: true,
      tabName,
      worksheet,
      parsedDate
    };
  }

  /**
   * Validate that PAX template has all required tabs
   */
  validatePaxTemplate(workbook: ExcelJS.Workbook): { isValid: boolean; missingTabs: string[] } {
    console.log('→ PaxTabRouter: Validating PAX template tabs');
    
    const requiredTabs = Object.values(this.TAB_MAP);
    const missingTabs: string[] = [];
    
    console.log(`→ PaxTabRouter: Required tabs: ${requiredTabs.length}`);
    console.log(`→ PaxTabRouter: Available tabs: ${workbook.worksheets.length}`);
    
    for (const tabName of requiredTabs) {
      const worksheet = this.getWorksheet(workbook, tabName);
      if (!worksheet) {
        missingTabs.push(tabName);
        console.warn(`→ PaxTabRouter: Missing tab: ${tabName}`);
      }
    }
    
    const isValid = missingTabs.length === 0;
    
    if (isValid) {
      console.log('→ PaxTabRouter: ✓ Template validation passed - all tabs present');
    } else {
      console.error(`→ PaxTabRouter: ✗ Template validation failed - missing ${missingTabs.length} tabs: ${missingTabs.join(', ')}`);
    }
    
    return { isValid, missingTabs };
  }

  /**
   * Get worksheet by name (case-insensitive)
   */
  private getWorksheet(workbook: ExcelJS.Workbook, tabName: string): ExcelJS.Worksheet | null {
    // Try exact match first
    let worksheet = workbook.getWorksheet(tabName);
    
    if (worksheet) {
      return worksheet;
    }
    
    // Try case-insensitive search
    const lowerTabName = tabName.toLowerCase();
    for (const ws of workbook.worksheets) {
      if (ws.name.toLowerCase() === lowerTabName) {
        return ws;
      }
    }
    
    return null;
  }
}

// Export singleton instance
export const paxTabRouter = new PaxTabRouter();

