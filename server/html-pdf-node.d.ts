declare module 'html-pdf-node' {
  interface Options {
    format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A5' | 'A6';
    path?: string;
    scale?: number;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    printBackground?: boolean;
    landscape?: boolean;
    pageRanges?: string;
    width?: string | number;
    height?: string | number;
    margin?: {
      top?: string | number;
      right?: string | number;
      bottom?: string | number;
      left?: string | number;
    };
    preferCSSPageSize?: boolean;
  }

  interface File {
    url?: string;
    content?: string;
  }

  function generatePdf(file: File, options?: Options): Promise<Buffer>;
  function generatePdfs(files: File[], options?: Options): Promise<Buffer[]>;

  export default { generatePdf, generatePdfs };
}
