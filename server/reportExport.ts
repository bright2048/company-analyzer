import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign
} from "docx";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { existsSync } from "node:fs";

interface ReportData {
  companyName: string;
  reportContent: string;
  parkAnalysis?: {
    matchScore: number;
    matchReason: string;
    entryPossibility: string;
    entryReason: string;
    upstreamCompanies: string[];
    downstreamCompanies: string[];
    expansionNeed: string;
    expansionReason: string;
    recommendations: string[];
  };
}

// 解析行内格式（加粗、斜体等）
function parseInlineFormatting(text: string): TextRun[] {
  const children: TextRun[] = [];
  // 匹配 **加粗** 和 *斜体*，但要避免 *** 的情况
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  for (const part of parts) {
    if (!part) continue;

    // 加粗+斜体 ***text***
    if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
      children.push(
        new TextRun({
          text: part.slice(3, -3),
          bold: true,
          italics: true,
        })
      );
    }
    // 加粗 **text**
    else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      children.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
        })
      );
    }
    // 斜体 *text*
    else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      children.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
        })
      );
    }
    else {
      children.push(new TextRun({ text: part }));
    }
  }

  return children.length > 0 ? children : [new TextRun({ text })];
}

// 检测是否为表格行
function isTableRow(line: string): boolean {
  return line.includes("|") && line.trim().startsWith("|");
}

// 检测是否为表格分隔行
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

// 解析表格
function parseTable(lines: string[], startIndex: number): { table: Table; endIndex: number } {
  const tableLines: string[] = [];
  let i = startIndex;

  // 收集所有表格行
  while (i < lines.length && isTableRow(lines[i])) {
    tableLines.push(lines[i]);
    i++;
  }

  // 过滤掉分隔行
  const dataLines = tableLines.filter(line => !isTableSeparator(line));

  if (dataLines.length === 0) {
    return {
      table: new Table({ rows: [] }),
      endIndex: i
    };
  }

  // 解析表格数据
  const rows = dataLines.map(line => {
    const cells = line
      .split("|")
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    return cells;
  });

  // 创建表格
  const tableRows = rows.map((rowData, rowIndex) => {
    const isHeader = rowIndex === 0;

    const cells = rowData.map(cellText => {
      return new TableCell({
        children: [
          new Paragraph({
            children: parseInlineFormatting(cellText),
            alignment: AlignmentType.CENTER,
          })
        ],
        shading: isHeader ? {
          fill: "E8F4F8",
          color: "auto"
        } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100,
        },
      });
    });

    return new TableRow({
      children: cells,
      tableHeader: isHeader,
    });
  });

  const table = new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });

  return { table, endIndex: i };
}

// 解析Markdown内容为段落和表格
function parseMarkdownToDocx(markdown: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 空行
    if (!trimmedLine) {
      elements.push(new Paragraph({ text: "" }));
      i++;
      continue;
    }

    // 检测表格
    if (isTableRow(trimmedLine)) {
      const { table, endIndex } = parseTable(lines, i);
      elements.push(table);
      elements.push(new Paragraph({ text: "" })); // 表格后添加空行
      i = endIndex;
      continue;
    }

    // 一级标题
    if (trimmedLine.startsWith("# ") && !trimmedLine.startsWith("## ")) {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine.substring(2)),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
    }
    // 二级标题
    else if (trimmedLine.startsWith("## ") && !trimmedLine.startsWith("### ")) {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine.substring(3)),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
    }
    // 三级标题
    else if (trimmedLine.startsWith("### ")) {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine.substring(4)),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
    }
    // 列表项
    else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: "• " }),
            ...parseInlineFormatting(trimmedLine.substring(2))
          ],
          indent: { left: 720 },
          spacing: { after: 80 },
        })
      );
    }
    // 数字列表
    else if (/^\d+\.\s/.test(trimmedLine)) {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine),
          indent: { left: 720 },
          spacing: { after: 80 },
        })
      );
    }
    // 普通段落
    else {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine),
          spacing: { after: 120 },
          alignment: AlignmentType.LEFT,
        })
      );
    }

    i++;
  }

  return elements;
}

// 生成Word文档
export async function generateWordDocument(data: ReportData): Promise<{ url: string; key: string }> {
  const elements = parseMarkdownToDocx(data.reportContent);

  // 添加园区匹配分析章节
  if (data.parkAnalysis) {
    elements.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        text: "附录：园区匹配分析详情",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "匹配度评分：", bold: true }),
          new TextRun({ text: `${data.parkAnalysis.matchScore}分` }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "匹配度分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.matchReason }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "入驻可能性：", bold: true }),
          new TextRun({ text: data.parkAnalysis.entryPossibility }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "入驻分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.entryReason }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "扩租需求：", bold: true }),
          new TextRun({ text: data.parkAnalysis.expansionNeed }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "扩租分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.expansionReason }),
        ],
        spacing: { after: 120 },
      })
    );

    if (data.parkAnalysis.upstreamCompanies.length > 0) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: "园区内上游企业：", bold: true }),
            new TextRun({ text: data.parkAnalysis.upstreamCompanies.join("、") }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    if (data.parkAnalysis.downstreamCompanies.length > 0) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: "园区内下游企业：", bold: true }),
            new TextRun({ text: data.parkAnalysis.downstreamCompanies.join("、") }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    if (data.parkAnalysis.recommendations.length > 0) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: "招商建议：", bold: true })],
          spacing: { before: 200, after: 100 },
        })
      );
      for (const rec of data.parkAnalysis.recommendations) {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: "• " + rec })],
            indent: { left: 720 },
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1英寸 = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          new Paragraph({
            text: `${data.companyName} 企业分析报告`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `生成日期：${new Date().toLocaleDateString("zh-CN")}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          ...elements,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileKey = `reports/${nanoid()}-${data.companyName}.docx`;
  const result = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  return { url: result.url, key: fileKey };
}

// 生成PDF文档（使用HTML转PDF）
export async function generatePdfDocument(data: ReportData): Promise<{ url: string; key: string }> {
  // 将Markdown转换为HTML
  const htmlContent = markdownToHtml(data.reportContent);
  
  // 添加园区分析HTML
  let parkAnalysisHtml = "";
  if (data.parkAnalysis) {
    parkAnalysisHtml = `
      <h1>附录：园区匹配分析详情</h1>
      <p><strong>匹配度评分：</strong>${data.parkAnalysis.matchScore}分</p>
      <p><strong>匹配度分析：</strong>${data.parkAnalysis.matchReason}</p>
      <p><strong>入驻可能性：</strong>${data.parkAnalysis.entryPossibility}</p>
      <p><strong>入驻分析：</strong>${data.parkAnalysis.entryReason}</p>
      <p><strong>扩租需求：</strong>${data.parkAnalysis.expansionNeed}</p>
      <p><strong>扩租分析：</strong>${data.parkAnalysis.expansionReason}</p>
      ${data.parkAnalysis.upstreamCompanies.length > 0 ? `<p><strong>园区内上游企业：</strong>${data.parkAnalysis.upstreamCompanies.join("、")}</p>` : ""}
      ${data.parkAnalysis.downstreamCompanies.length > 0 ? `<p><strong>园区内下游企业：</strong>${data.parkAnalysis.downstreamCompanies.join("、")}</p>` : ""}
      ${data.parkAnalysis.recommendations.length > 0 ? `
        <p><strong>招商建议：</strong></p>
        <ul>${data.parkAnalysis.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
      ` : ""}
    `;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: "Microsoft YaHei", "SimSun", sans-serif;
          line-height: 1.8;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #333;
        }
        h1 {
          color: #1a365d;
          border-bottom: 3px solid #3182ce;
          padding-bottom: 12px;
          margin-top: 30px;
          font-size: 24px;
          font-weight: bold;
        }
        h2 {
          color: #2c5282;
          margin-top: 25px;
          font-size: 20px;
          font-weight: bold;
          border-left: 4px solid #3182ce;
          padding-left: 12px;
        }
        h3 {
          color: #2b6cb0;
          margin-top: 20px;
          font-size: 16px;
          font-weight: bold;
        }
        p {
          text-align: justify;
          margin: 10px 0;
          text-indent: 2em;
        }
        ul, ol {
          margin: 10px 0;
          padding-left: 30px;
        }
        li {
          margin: 5px 0;
          line-height: 1.6;
        }
        .title {
          text-align: center;
          font-size: 28px;
          color: #1a365d;
          margin-bottom: 10px;
          font-weight: bold;
        }
        .date {
          text-align: center;
          color: #718096;
          margin-bottom: 40px;
          font-size: 14px;
        }
        strong {
          color: #2d3748;
          font-weight: bold;
        }
        em {
          font-style: italic;
          color: #4a5568;
        }

        /* 表格样式 */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .report-table th {
          background-color: #E8F4F8;
          color: #1a365d;
          font-weight: bold;
          padding: 12px 8px;
          text-align: center;
          border: 1px solid #cbd5e0;
        }
        .report-table td {
          padding: 10px 8px;
          text-align: center;
          border: 1px solid #cbd5e0;
          line-height: 1.6;
        }
        .report-table tr:nth-child(even) {
          background-color: #f7fafc;
        }
        .report-table tr:hover {
          background-color: #edf2f7;
        }
      </style>
    </head>
    <body>
      <div class="title">${data.companyName} 企业分析报告</div>
      <div class="date">生成日期：${new Date().toLocaleDateString("zh-CN")}</div>
      ${htmlContent}
      ${parkAnalysisHtml}
    </body>
    </html>
  `;

  // 使用puppeteer-core生成PDF，优先使用系统Chrome，避免下载Chromium
  const puppeteer = await import("puppeteer-core");
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ].find(candidate => existsSync(candidate));

  if (!executablePath) {
    throw new Error(
      "未找到本机Chrome/Chromium，请安装Chrome或设置PUPPETEER_EXECUTABLE_PATH"
    );
  }

  const browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "16mm", bottom: "16mm", left: "16mm" },
    });

    const fileKey = `reports/${nanoid()}-${data.companyName}.pdf`;
    const result = await storagePut(fileKey, pdfBuffer, "application/pdf");

    return { url: result.url, key: fileKey };
  } finally {
    await browser.close();
  }
}

// 简单的Markdown转HTML（支持表格）
function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const htmlLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测表格
    if (trimmedLine.includes("|") && trimmedLine.startsWith("|")) {
      // 跳过分隔行
      if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }

      // 解析表格行
      const cells = trimmedLine
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);

      const isHeader = tableRows.length === 0;
      const cellTag = isHeader ? "th" : "td";
      const rowHtml = `<tr>${cells.map(cell => {
        // 处理单元格内的加粗和斜体
        let cellContent = cell
          .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>");
        return `<${cellTag}>${cellContent}</${cellTag}>`;
      }).join("")}</tr>`;

      tableRows.push(rowHtml);
    } else {
      // 如果之前在表格中，现在结束表格
      if (inTable) {
        const tableHtml = `<table class="report-table">${tableRows.join("")}</table>`;
        htmlLines.push(tableHtml);
        tableRows = [];
        inTable = false;
      }

      // 处理其他Markdown元素
      if (!trimmedLine) {
        htmlLines.push("<p>&nbsp;</p>");
      }
      // 标题
      else if (trimmedLine.startsWith("### ")) {
        htmlLines.push(`<h3>${processInlineFormatting(trimmedLine.substring(4))}</h3>`);
      } else if (trimmedLine.startsWith("## ")) {
        htmlLines.push(`<h2>${processInlineFormatting(trimmedLine.substring(3))}</h2>`);
      } else if (trimmedLine.startsWith("# ")) {
        htmlLines.push(`<h1>${processInlineFormatting(trimmedLine.substring(2))}</h1>`);
      }
      // 列表项
      else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
        htmlLines.push(`<li>${processInlineFormatting(trimmedLine.substring(2))}</li>`);
      }
      // 数字列表
      else if (/^\d+\.\s/.test(trimmedLine)) {
        htmlLines.push(`<li>${processInlineFormatting(trimmedLine.replace(/^\d+\.\s/, ""))}</li>`);
      }
      // 普通段落
      else {
        htmlLines.push(`<p>${processInlineFormatting(trimmedLine)}</p>`);
      }
    }
  }

  // 处理最后可能未闭合的表格
  if (inTable && tableRows.length > 0) {
    const tableHtml = `<table class="report-table">${tableRows.join("")}</table>`;
    htmlLines.push(tableHtml);
  }

  let html = htmlLines.join("\n");

  // 包装连续的列表项
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
    // 判断是否为数字列表（通过检查原始内容）
    return `<ul>${match}</ul>`;
  });

  return html;
}

// 处理行内格式（加粗、斜体）
function processInlineFormatting(text: string): string {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
