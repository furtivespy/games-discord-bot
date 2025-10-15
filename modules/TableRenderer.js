/**
 * TableRenderer - Manual canvas table rendering
 * 
 * Replaces canvas-table with full control over rendering.
 * This allows for easier emoji support and better customization.
 */
class TableRenderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.columns = config.columns || [];
    this.data = config.data || [];
    this.options = config.options || {};
    
    // Default options
    this.defaults = {
      fontFamily: 'Open Sans',
      fontSize: 16,
      padding: 10,
      cellPadding: 10,
      headerFontSize: 18,
      headerFontWeight: 'bold',
      headerBackground: '#f0f0f0',
      headerTextAlign: 'center',
      titleFontSize: 24,
      titleFontFamily: 'Open Sans',
      borderColor: '#aaa',
      borderWidth: 1,
      textAlign: 'left'
    };
    
    // Merge options with defaults
    this.settings = { ...this.defaults, ...this.options };
    // Keep section-specific settings separate without polluting them with general defaults
    if (this.options.header) {
      this.settings.header = { ...this.options.header };
    }
    if (this.options.title) {
      this.settings.title = { ...this.options.title };
    }
    if (this.options.cell) {
      this.settings.cell = { ...this.options.cell };
    }
    if (this.options.borders) {
      this.settings.borders = this.options.borders;
    }
  }

  /**
   * Measure text width for a given string
   */
  measureText(text, fontSize, fontFamily) {
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    return this.ctx.measureText(text).width;
  }

  /**
   * Static method to calculate required table dimensions before creating canvas
   */
  static calculateRequiredDimensions(columns, data, options = {}) {
    // Create a temporary small canvas just for measuring
    const { createCanvas } = require('canvas');
    const tempCanvas = createCanvas(100, 100);
    const tempCtx = tempCanvas.getContext('2d');
    
    const settings = {
      fontFamily: options.fontFamily || 'Open Sans',
      fontSize: options.cell?.fontSize || 16,
      padding: options.cell?.padding || 10,
      headerFontSize: options.header?.fontSize || 18,
      headerFontFamily: options.header?.fontFamily || options.fontFamily || 'Open Sans',
      titleFontSize: options.title?.fontSize || 24,
    };
    
    const padding = settings.padding;
    
    // Calculate column widths
    const columnWidths = columns.map((col, colIndex) => {
      let maxWidth = 0;
      
      // Check header width with bold font weight
      const headerText = col.title || '';
      const headerFontWeight = options.header?.fontWeight || 'bold';
      tempCtx.font = `${headerFontWeight} ${settings.headerFontSize}px ${settings.headerFontFamily}`;
      const headerWidth = tempCtx.measureText(headerText).width;
      maxWidth = Math.max(maxWidth, headerWidth);
      
      // Check data widths
      data.forEach(row => {
        const cellData = row[colIndex];
        const cellValue = typeof cellData === 'object' ? cellData.value : cellData;
        const cellFont = cellData?.fontFamily || settings.fontFamily;
        const cellSize = cellData?.fontSize || settings.fontSize;
        const cellWeight = cellData?.fontWeight || 'normal';
        tempCtx.font = `${cellWeight} ${cellSize}px ${cellFont}`;
        maxWidth = Math.max(maxWidth, tempCtx.measureText(String(cellValue)).width);
      });
      
      // Add padding to the measured width (increased for more breathing room)
      let columnWidth = maxWidth + (padding * 2.5); // Extra padding for comfort
      
      // Set minimum column widths for better appearance
      if (colIndex === 0) {
        // First column (Player) - minimum 200px
        columnWidth = Math.max(columnWidth, 200);
      } else if (col.title.toLowerCase().includes('team')) {
        // Team column - minimum 150px
        columnWidth = Math.max(columnWidth, 150);
      } else {
        // All other columns - minimum 100px
        columnWidth = Math.max(columnWidth, 100);
      }
      
      return columnWidth;
    });
    
    // Calculate dimensions
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const tableMargin = 15; // Consistent margin around the table
    const titleHeight = options.title?.text ? settings.titleFontSize + (padding * 2) : 0;
    const headerHeight = settings.headerFontSize + (padding * 2);
    const rowHeight = settings.fontSize + (padding * 2);
    
    // Canvas size = table size + margins on all sides
    const canvasWidth = tableWidth + (tableMargin * 2); // Left and right margins
    const canvasHeight = titleHeight + headerHeight + (rowHeight * data.length) + (tableMargin * 2); // Top and bottom margins
    
    return {
      canvasWidth,
      canvasHeight,
      tableWidth,
      columnWidths
    };
  }

  /**
   * Calculate column widths based on content
   */
  calculateColumnWidths() {
    const numColumns = this.columns.length;
    const padding = this.settings.cell?.padding || this.settings.cellPadding;
    
    // Calculate based on content - use the same logic as calculateRequiredDimensions
    const columnWidths = this.columns.map((col, colIndex) => {
      let maxWidth = 0;
      
      // Check header width with bold font weight
      const headerText = col.title || '';
      const headerFont = this.settings.header?.fontFamily || this.settings.fontFamily;
      const headerSize = this.settings.header?.fontSize || this.settings.headerFontSize;
      const headerWeight = this.settings.header?.fontWeight || 'bold';
      
      // Measure with proper font weight
      this.ctx.font = `${headerWeight} ${headerSize}px ${headerFont}`;
      const headerWidth = this.ctx.measureText(headerText).width;
      maxWidth = Math.max(maxWidth, headerWidth);
      
      // Check data widths
      this.data.forEach(row => {
        const cellData = row[colIndex];
        const cellValue = typeof cellData === 'object' ? cellData.value : cellData;
        const cellFont = cellData?.fontFamily || this.settings.cell?.fontFamily || this.settings.fontFamily;
        const cellSize = cellData?.fontSize || this.settings.cell?.fontSize || this.settings.fontSize;
        const cellWeight = cellData?.fontWeight || 'normal';
        
        this.ctx.font = `${cellWeight} ${cellSize}px ${cellFont}`;
        maxWidth = Math.max(maxWidth, this.ctx.measureText(String(cellValue)).width);
      });
      
      // Add padding to the measured width (increased for more breathing room)
      let columnWidth = maxWidth + (padding * 2.5); // Extra padding for comfort
      
      // Set minimum column widths for better appearance (same as in calculateRequiredDimensions)
      if (colIndex === 0) {
        columnWidth = Math.max(columnWidth, 200);
      } else if (col.title.toLowerCase().includes('team')) {
        columnWidth = Math.max(columnWidth, 150);
      } else {
        columnWidth = Math.max(columnWidth, 100);
      }
      
      return columnWidth;
    });
    
    // Don't scale - use actual measured widths
    return columnWidths;
  }

  /**
   * Draw a cell with borders, background, and text
   */
  drawCell(x, y, width, height, cellData, columnOptions = {}) {
    const ctx = this.ctx;
    const value = typeof cellData === 'object' ? cellData.value : cellData;
    const background = cellData?.background || '#ffffff';
    const color = cellData?.color || '#000000';
    const fontWeight = cellData?.fontWeight || 'normal';
    const fontSize = cellData?.fontSize || this.settings.cell?.fontSize || this.settings.fontSize;
    const fontFamily = cellData?.fontFamily || this.settings.cell?.fontFamily || this.settings.fontFamily;
    const padding = this.settings.cell?.padding || this.settings.cellPadding;
    const textAlign = columnOptions.textAlign || cellData?.textAlign || this.settings.textAlign;
    
    // Draw background
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
    
    // Draw text
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle'; // Use middle baseline for proper vertical centering
    
    // Calculate text position based on alignment
    let textX = x + padding;
    if (textAlign === 'center') {
      textX = x + width / 2;
      ctx.textAlign = 'center';
    } else if (textAlign === 'right') {
      textX = x + width - padding;
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }
    
    const textY = y + height / 2; // Vertical center with middle baseline
    ctx.fillText(String(value), textX, textY);
    
    // Reset text properties
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Draw table borders
   */
  drawBorders(columnWidths, rowHeight, headerHeight, titleHeight, tableX) {
    const ctx = this.ctx;
    const borderColor = this.settings.borders?.table?.color || this.settings.borderColor;
    const borderWidth = this.settings.borders?.table?.width || this.settings.borderWidth;
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    
    // Calculate actual table width and height based on content
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const tableMargin = 15; // Must match the margin used in generateTable
    // Height is header + all data rows
    const tableHeight = headerHeight + (rowHeight * this.data.length);
    
    let currentY = titleHeight + tableMargin;
    let currentX = tableX;
    
    // Draw outer border
    ctx.strokeRect(tableX, titleHeight + tableMargin, tableWidth, tableHeight);
    
    // Draw horizontal lines (after each row)
    currentY += headerHeight;
    for (let i = 0; i <= this.data.length; i++) {
      ctx.beginPath();
      ctx.moveTo(tableX, currentY);
      ctx.lineTo(tableX + tableWidth, currentY);
      ctx.stroke();
      
      if (i < this.data.length) {
        currentY += rowHeight;
      }
    }
    
    // Draw vertical lines (between columns)
    currentX = tableX;
    for (let i = 0; i <= columnWidths.length; i++) {
      ctx.beginPath();
      ctx.moveTo(currentX, titleHeight + tableMargin);
      ctx.lineTo(currentX, titleHeight + tableMargin + tableHeight);
      ctx.stroke();
      
      if (i < columnWidths.length) {
        currentX += columnWidths[i];
      }
    }
    
    // Draw thicker line under header if specified
    if (this.settings.header?.border?.bottom) {
      const bottomBorder = this.settings.header.border.bottom;
      ctx.strokeStyle = bottomBorder.color || borderColor;
      ctx.lineWidth = bottomBorder.width || borderWidth;
      ctx.beginPath();
      ctx.moveTo(tableX, titleHeight + tableMargin + headerHeight);
      ctx.lineTo(tableX + tableWidth, titleHeight + tableMargin + headerHeight);
      ctx.stroke();
      
      // Reset line width
      ctx.lineWidth = borderWidth;
    }
  }

  /**
   * Generate and render the table
   */
  async generateTable() {
    const ctx = this.ctx;
    
    // Fill canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    const columnWidths = this.calculateColumnWidths();
    
    // Calculate heights with proper padding
    const padding = this.settings.cell?.padding || this.settings.cellPadding;
    const titleHeight = this.settings.title?.text ? (this.settings.title.fontSize || this.settings.titleFontSize) + (padding * 2) : 0;
    const headerHeight = (this.settings.header?.fontSize || this.settings.headerFontSize) + (padding * 2);
    const rowHeight = (this.settings.cell?.fontSize || this.settings.fontSize) + (padding * 2);
    
    // Calculate table dimensions and margins
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const tableMargin = 15; // Margin around the table (increased for visibility)
    const tableX = tableMargin; // Start position with left margin
    
    let currentY = tableMargin; // Start with top margin
    let currentX = tableX;
    
    // Draw title if present
    if (this.settings.title?.text) {
      const titleFont = this.settings.title.fontFamily || this.settings.titleFontFamily;
      const titleSize = this.settings.title.fontSize || this.settings.titleFontSize;
      
      ctx.fillStyle = '#000000';
      ctx.font = `${titleSize}px ${titleFont}`;
      ctx.textAlign = 'center';
      // Center title over the table
      ctx.fillText(this.settings.title.text, tableX + tableWidth / 2, currentY + titleSize);
      ctx.textAlign = 'left';
      
      currentY += titleHeight;
    }
    
    // Draw header row
    currentX = tableX;
    const headerBg = this.settings.header?.background || this.settings.headerBackground;
    const headerFont = this.settings.header?.fontFamily || this.settings.fontFamily;
    const headerSize = this.settings.header?.fontSize || this.settings.headerFontSize;
    const headerWeight = this.settings.header?.fontWeight || this.settings.headerFontWeight;
    const headerAlign = this.settings.header?.textAlign || this.settings.headerTextAlign;
    
    ctx.fillStyle = headerBg;
    ctx.fillRect(tableX, currentY, tableWidth, headerHeight);
    
    ctx.fillStyle = '#000000';
    ctx.font = `${headerWeight} ${headerSize}px ${headerFont}`;
    ctx.textBaseline = 'middle'; // Use middle baseline for proper vertical centering
    
    const headerPadding = this.settings.header?.padding || padding;
    
    this.columns.forEach((col, colIndex) => {
      const width = columnWidths[colIndex];
      const text = col.title || '';
      
      // Calculate text position based on alignment
      let textX = currentX + headerPadding;
      if (headerAlign === 'center') {
        textX = currentX + width / 2;
        ctx.textAlign = 'center';
      } else if (headerAlign === 'right') {
        textX = currentX + width - headerPadding;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }
      
      const textY = currentY + headerHeight / 2;
      ctx.fillText(text, textX, textY);
      
      currentX += width;
    });
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    currentY += headerHeight;
    
    // Draw data rows
    this.data.forEach((row, rowIndex) => {
      currentX = tableX;
      
      row.forEach((cellData, colIndex) => {
        const width = columnWidths[colIndex];
        const columnOptions = this.columns[colIndex]?.options || {};
        
        this.drawCell(currentX, currentY, width, rowHeight, cellData, columnOptions);
        
        currentX += width;
      });
      
      currentY += rowHeight;
    });
    
    // Draw borders
    this.drawBorders(columnWidths, rowHeight, headerHeight, titleHeight, tableX);
  }

  /**
   * Render to buffer (PNG)
   */
  async renderToBuffer() {
    return this.canvas.toBuffer('image/png');
  }
}

module.exports = TableRenderer;

