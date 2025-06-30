declare module 'xlsx-populate' {
  interface Cell {
    value(): any;
    value(value: any): Cell;
    style(): any;
    style(style: any): Cell;
    clear(): Cell;
  }

  interface Range {
    startCell(): Cell;
    endCell(): Cell & { rowNumber(): number };
  }

  interface Sheet {
    cell(row: number, column: number): Cell;
    usedRange(): Range | undefined;
  }

  interface Workbook {
    sheet(nameOrIndex: string | number): Sheet;
    toFileAsync(path: string): Promise<void>;
  }

  namespace XlsxPopulate {
    function fromFileAsync(path: string): Promise<Workbook>;
  }

  export = XlsxPopulate;
}