const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Generate a beautifully designed, A4-formatted Excel file for registered users.
 * Features:
 * - A4 Paper PageSetup (PaperSize: 9, Portrait, FitToWidth: 1, HorizontalCentered: true)
 * - Repeat print header rows on every page
 * - Two logos on top sides (Left: Logo_Ahle_Hadith, Right: JamatLogo)
 * - Large elegant heading: "SHARI JAMATE AHLE HADITH"
 * - Subtitle: "REGISTERED USERS DIRECTORY"
 * - Auto-adjusted column widths
 * - Professional Islamic Emerald theme with zebra rows & borders
 *
 * @param {Array} users Array of user objects
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateUsersExcel(users = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JamaitApp';
  workbook.lastModifiedBy = 'Shari Jamate Ahle Hadith Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Registered Users', {
    pageSetup: {
      paperSize: 9, // A4 ISO paper standard
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, // Auto-flow pages vertically
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
      horizontalCentered: true,
    },
    views: [{ showGridLines: true }]
  });

  // Repeat table header row (Row 6) on every printed page
  worksheet.pageSetup.printTitlesRow = '6:6';

  // -------------------------------------------------------------
  // Embed Logos (Left & Right)
  // -------------------------------------------------------------
  const possibleAssetsDirs = [
    path.resolve(__dirname, '../../frontend/assets'),
    path.resolve(__dirname, '../assets'),
    path.resolve(process.cwd(), '../frontend/assets'),
    path.resolve(process.cwd(), 'frontend/assets'),
  ];

  let logo1Path = null;
  let logo2Path = null;

  for (const dir of possibleAssetsDirs) {
    const l1 = path.join(dir, 'Logo_Ahle_Hadith.png');
    const l2 = path.join(dir, 'JamatLogo.png');
    if (!logo1Path && fs.existsSync(l1)) logo1Path = l1;
    if (!logo2Path && fs.existsSync(l2)) logo2Path = l2;
  }

  // Fallbacks if one is missing
  if (!logo1Path && logo2Path) logo1Path = logo2Path;
  if (!logo2Path && logo1Path) logo2Path = logo1Path;

  // Add Left Logo (Column A, Rows 2-4)
  if (logo1Path && fs.existsSync(logo1Path)) {
    try {
      const logo1Id = workbook.addImage({
        filename: logo1Path,
        extension: 'png',
      });
      worksheet.addImage(logo1Id, {
        tl: { col: 0.15, row: 1.15 },
        ext: { width: 68, height: 68 },
        editAs: 'oneCell',
      });
    } catch (e) {
      console.warn('Could not embed left logo:', e.message);
    }
  }

  // Add Right Logo (Column G, Rows 2-4)
  if (logo2Path && fs.existsSync(logo2Path)) {
    try {
      const logo2Id = workbook.addImage({
        filename: logo2Path,
        extension: 'png',
      });
      worksheet.addImage(logo2Id, {
        tl: { col: 7.2, row: 1.15 },
        ext: { width: 68, height: 68 },
        editAs: 'oneCell',
      });
    } catch (e) {
      console.warn('Could not embed right logo:', e.message);
    }
  }

  // -------------------------------------------------------------
  // Row Heights Setup
  // -------------------------------------------------------------
  worksheet.getRow(1).height = 10; // Top margin
  worksheet.getRow(2).height = 32; // Main Header
  worksheet.getRow(3).height = 20; // Subtitle
  worksheet.getRow(4).height = 18; // Metadata
  worksheet.getRow(5).height = 10; // Spacing
  worksheet.getRow(6).height = 30; // Table Column Headers

  // -------------------------------------------------------------
  // Header Text (Merged Cells B to F)
  // -------------------------------------------------------------
  // Main Title: Shari Jamate Ahle Hadith
  worksheet.mergeCells('B2:G2');
  const titleCell = worksheet.getCell('B2');
  titleCell.value = 'SHARI JAMATE AHLE HADITH';
  titleCell.font = {
    name: 'Calibri',
    size: 20,
    bold: true,
    color: { argb: 'FF1B6B3C' }, // Deep Islamic Emerald
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle: Registered Users Directory
  worksheet.mergeCells('B3:G3');
  const subCell = worksheet.getCell('B3');
  subCell.value = 'REGISTERED USERS DIRECTORY';
  subCell.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF2D3748' },
  };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Metadata: Date, Count, A4 paper note
  worksheet.mergeCells('B4:G4');
  const metaCell = worksheet.getCell('B4');
  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  metaCell.value = `Official Community Record | Exported: ${dateFormatted} | Total Records: ${users.length} | Format: A4`;
  metaCell.font = {
    name: 'Calibri',
    size: 9,
    italic: true,
    color: { argb: 'FF718096' },
  };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // -------------------------------------------------------------
  // Table Columns Definition
  // -------------------------------------------------------------
  const columnsConfig = [
    { key: 'sno', header: 'S.NO', minWidth: 8, align: 'center' },
    { key: 'name', header: 'FULL NAME', minWidth: 26, align: 'left' },
    { key: 'occupation', header: 'OCCUPATION', minWidth: 20, align: 'left' },
    { key: 'phone', header: 'MOBILE NUMBER', minWidth: 17, align: 'center' },
    { key: 'email', header: 'EMAIL ADDRESS', minWidth: 28, align: 'left' },
    { key: 'aadhaar', header: 'AADHAAR NUMBER', minWidth: 18, align: 'center' },
    { key: 'role', header: 'ROLE', minWidth: 14, align: 'center' },
    { key: 'joined', header: 'REGISTRATION DATE', minWidth: 18, align: 'center' },
  ];

  // Render Header Row (Row 6)
  const headerRow = worksheet.getRow(6);
  columnsConfig.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = col.header;
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B6B3C' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0E4424' } },
      bottom: { style: 'medium', color: { argb: 'FF0E4424' } },
      left: { style: 'thin', color: { argb: 'FF2D8550' } },
      right: { style: 'thin', color: { argb: 'FF2D8550' } },
    };
  });

  // Track max content length for each column to auto-adjust widths
  const maxContentLength = columnsConfig.map(c => c.header.length);

  // -------------------------------------------------------------
  // Render Data Rows (Rows 7+)
  // -------------------------------------------------------------
  users.forEach((user, index) => {
    const rowNum = 7 + index;
    const row = worksheet.getRow(rowNum);
    row.height = 23;

    const isEven = index % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF4F9F5'; // Alternating clean mint-white

    // Format fields
    const snoVal = index + 1;
    const nameVal = user.name || 'N/A';
    const occupationVal = user.occupation || 'N/A';
    const phoneVal = user.phone || 'N/A';
    const emailVal = user.email || 'N/A';
    const aadhaarVal = user.aadhaar || 'N/A';
    const roleVal = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')) : 'User';
    
    let joinedVal = 'N/A';
    if (user.created_at) {
      try {
        joinedVal = new Date(user.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      } catch (e) {
        joinedVal = String(user.created_at).slice(0, 10);
      }
    }

    const rowData = [snoVal, nameVal, occupationVal, phoneVal, emailVal, aadhaarVal, roleVal, joinedVal];

    rowData.forEach((val, colIdx) => {
      const colNum = colIdx + 1;
      const cell = row.getCell(colNum);
      cell.value = val;
      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: 'FF1A202C' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgColor },
      };
      cell.alignment = {
        horizontal: columnsConfig[colIdx].align,
        vertical: 'middle',
        indent: columnsConfig[colIdx].align === 'left' ? 1 : 0,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Measure max length for auto-width
      const strLen = String(val).length;
      if (strLen > maxContentLength[colIdx]) {
        maxContentLength[colIdx] = strLen;
      }
    });
  });

  // -------------------------------------------------------------
  // Summary / Footer Row
  // -------------------------------------------------------------
  const summaryRowNum = 7 + users.length;
  const summaryRow = worksheet.getRow(summaryRowNum);
  summaryRow.height = 24;

  // Merge A to H for Total Users Count
  worksheet.mergeCells(`A${summaryRowNum}:H${summaryRowNum}`);
  for (let c = 1; c <= 8; c++) {
    const cell = summaryRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1B6B3C' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E0' } },
      left: c === 1 ? { style: 'thin', color: { argb: 'FFCBD5E0' } } : undefined,
      right: c === 8 ? { style: 'thin', color: { argb: 'FFCBD5E0' } } : undefined,
    };
  }
  const sumLeftCell = worksheet.getCell(`A${summaryRowNum}`);
  sumLeftCell.value = `Total Registered Users: ${users.length}`;
  sumLeftCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1B6B3C' } };
  sumLeftCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  // -------------------------------------------------------------
  // Apply Auto-Adjusted Column Widths
  // -------------------------------------------------------------
  columnsConfig.forEach((cfg, idx) => {
    const colNum = idx + 1;
    const computedWidth = Math.max(cfg.minWidth, maxContentLength[idx] + 3);
    worksheet.getColumn(colNum).width = computedWidth;
  });

  // Return workbook buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generateUsersExcel };
