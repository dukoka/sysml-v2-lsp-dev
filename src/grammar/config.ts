/**
 * 解析/校验配置（阶段 C 集中）。
 * 配置项名与可选值见 docs/grammar-config.md。
 */
export interface GrammarConfig {
  /**
   * 解析/校验语法来源。当前仅支持 'langium'；后续可扩展 'g4'。
   * 可选值：'langium' | 'g4'
   */
  grammarSource: 'langium' | 'g4';
  /**
   * 为 true 时启用 G4 独立严格模式：G4 解析错误单独展示，不合并进主诊断。
   * 仅当 grammarSource 为 'langium' 时，G4 作为独立通道可选开启。
   */
  g4Validation: boolean;
}

const defaultConfig: GrammarConfig = {
  grammarSource: 'langium',
  g4Validation: false,
};

let currentConfig: GrammarConfig = { ...defaultConfig };

export function getGrammarConfig(): GrammarConfig {
  return { ...currentConfig };
}

export function setGrammarConfig(config: Partial<GrammarConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function isG4ValidationEnabled(): boolean {
  return currentConfig.g4Validation;
}
