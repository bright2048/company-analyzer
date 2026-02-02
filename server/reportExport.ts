import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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

// 解析Markdown内容为段落
function parseMarkdownToDocx(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    // 一级标题
    if (trimmedLine.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
    }
    // 二级标题
    else if (trimmedLine.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
    }
    // 三级标题
    else if (trimmedLine.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
    }
    // 列表项
    else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "• " + trimmedLine.substring(2) }),
          ],
          indent: { left: 720 },
        })
      );
    }
    // 数字列表
    else if (/^\d+\.\s/.test(trimmedLine)) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine,
          indent: { left: 720 },
        })
      );
    }
    // 普通段落（处理加粗文本）
    else {
      const children: TextRun[] = [];
      const parts = trimmedLine.split(/(\*\*[^*]+\*\*)/g);
      
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          children.push(
            new TextRun({
              text: part.slice(2, -2),
              bold: true,
            })
          );
        } else if (part) {
          children.push(new TextRun({ text: part }));
        }
      }

      paragraphs.push(
        new Paragraph({
          children,
          spacing: { after: 120 },
        })
      );
    }
  }

  return paragraphs;
}

// 生成Word文档
export async function generateWordDocument(data: ReportData): Promise<{ url: string; key: string }> {
  const paragraphs = parseMarkdownToDocx(data.reportContent);

  // 添加园区匹配分析章节
  if (data.parkAnalysis) {
    paragraphs.push(
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
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "匹配度分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.matchReason }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "入驻可能性：", bold: true }),
          new TextRun({ text: data.parkAnalysis.entryPossibility }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "入驻分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.entryReason }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "扩租需求：", bold: true }),
          new TextRun({ text: data.parkAnalysis.expansionNeed }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "扩租分析：", bold: true }),
          new TextRun({ text: data.parkAnalysis.expansionReason }),
        ],
      })
    );

    if (data.parkAnalysis.upstreamCompanies.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "园区内上游企业：", bold: true }),
            new TextRun({ text: data.parkAnalysis.upstreamCompanies.join("、") }),
          ],
        })
      );
    }

    if (data.parkAnalysis.downstreamCompanies.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "园区内下游企业：", bold: true }),
            new TextRun({ text: data.parkAnalysis.downstreamCompanies.join("、") }),
          ],
        })
      );
    }

    if (data.parkAnalysis.recommendations.length > 0) {
      paragraphs.push(
        new Paragraph({
          text: "招商建议：",
          spacing: { before: 200 },
          children: [new TextRun({ text: "招商建议：", bold: true })],
        })
      );
      for (const rec of data.parkAnalysis.recommendations) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "• " + rec })],
            indent: { left: 720 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `${data.companyName} 企业分析报告`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: `生成日期：${new Date().toLocaleDateString("zh-CN")}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          ...paragraphs,
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
        body { font-family: "Microsoft YaHei", "SimSun", sans-serif; line-height: 1.8; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 10px; margin-top: 30px; }
        h2 { color: #2c5282; margin-top: 25px; }
        h3 { color: #2b6cb0; margin-top: 20px; }
        p { text-align: justify; margin: 10px 0; }
        ul, ol { margin: 10px 0; padding-left: 30px; }
        li { margin: 5px 0; }
        .title { text-align: center; font-size: 24px; color: #1a365d; margin-bottom: 10px; }
        .date { text-align: center; color: #718096; margin-bottom: 40px; }
        strong { color: #2d3748; }
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

  // 使用html-pdf-node生成PDF
  const htmlPdf = await import("html-pdf-node");
  const options = { format: "A4" as const };
  const file = { content: fullHtml };
  
  const pdfBuffer = await htmlPdf.default.generatePdf(file, options);
  const fileKey = `reports/${nanoid()}-${data.companyName}.pdf`;
  const result = await storagePut(fileKey, pdfBuffer, "application/pdf");
  
  return { url: result.url, key: fileKey };
}

// 简单的Markdown转HTML
function markdownToHtml(markdown: string): string {
  let html = markdown
    // 转义HTML特殊字符
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // 标题
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // 加粗
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // 斜体
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // 列表项
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // 数字列表
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // 段落
    .replace(/\n\n/g, "</p><p>")
    // 换行
    .replace(/\n/g, "<br>");

  // 包装列表
  html = html.replace(new RegExp('(<li>.*?<\\/li>)+', 'g'), (match) => `<ul>${match}</ul>`);
  
  return `<p>${html}</p>`;
}
