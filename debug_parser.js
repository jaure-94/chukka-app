import XLSX from 'xlsx';
import path from 'path';

// Test the Excel parsing with the uploaded file
const filePath = 'uploads/539fd504d52ab4cd167f2d7a4d343a7f';

try {
  console.log('Reading file:', filePath);
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n=== Processing Sheet: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log('Sheet range:', worksheet['!ref']);
    
    // Check what's in rows 1-10
    for (let row = 0; row < Math.min(10, range.e.r + 1); row++) {
      console.log(`Row ${row + 1}:`);
      for (let col = range.s.c; col <= Math.min(range.s.c + 7, range.e.c); col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          console.log(`  ${cellAddress}: "${cell.v}"`);
        }
      }
    }
    
    // Test our parsing logic
    const startRow = 7; // Row 8 (0-indexed as 7)
    console.log(`\n--- Headers from row ${startRow + 1} ---`);
    const columns = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: startRow, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        columns.push(String(cell.v).trim());
        console.log(`  Column ${col + 1}: "${cell.v}"`);
      }
    }
    
    console.log(`\n--- Data from row ${startRow + 2} onwards ---`);
    let dataRows = 0;
    for (let row = startRow + 1; row <= Math.min(startRow + 5, range.e.r); row++) {
      const rowData = {};
      let hasData = false;
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        const columnName = columns[col - range.s.c] || `Column${col + 1}`;
        
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          rowData[columnName] = cell.v;
          hasData = true;
        } else {
          rowData[columnName] = '';
        }
      }
      
      if (hasData) {
        dataRows++;
        console.log(`  Row ${row + 1}:`, JSON.stringify(rowData, null, 2));
      }
    }
    
    console.log(`\nFound ${dataRows} data rows in this sheet`);
  }
  
} catch (error) {
  console.error('Error parsing file:', error);
}