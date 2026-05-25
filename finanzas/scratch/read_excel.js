const xlsx = require('xlsx');
const path = require('path');

const files = [
  'MovimientosFacturadosNacionales_21-04-2026.xls',
  'MovimientosNoFacturadosNacionales_01-05-2026.xls'
];

files.forEach(file => {
  const filePath = path.join('c:\\Users\\arant\\OneDrive\\Desarrollo\\portal\\home\\utilidades', file);
  console.log(`\n=== READING FILE: ${file} ===`);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet['!ref']);
    
    // Print first 20 rows
    for (let r = 0; r <= Math.min(range.e.r, 25); r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = xlsx.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        row.push(cell ? cell.v : '');
      }
      if (row.some(val => val !== '')) {
        console.log(`Row ${r}:`, row.slice(0, 8)); // print first 8 columns
      }
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
});
