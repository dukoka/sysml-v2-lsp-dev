/**
 * G4 独立严格模式：对文档运行 G4 解析器，返回仅 G4 产生的诊断（不合并进主诊断）。
 * 当未生成 G4 解析器时返回空数组或一条说明性诊断。
 */
export interface G4Diagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  severity?: number;
}

/** 对文本运行 G4 解析，返回 G4 解析错误列表。不合并进主诊断。 */
export function runG4Parse(text: string): G4Diagnostic[] {
  // 当存在生成的解析器时，可在此动态 import 并调用，将解析错误转为 G4Diagnostic[]。
  // 当前未接入 ANTLR 生成产物，返回空数组；生成脚本就绪后在此接入。
  void text;
  return [];
}
