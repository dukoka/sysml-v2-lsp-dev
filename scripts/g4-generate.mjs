#!/usr/bin/env node
/**
 * 从 src/grammar/g4 的 G4 文件生成 ANTLR 解析器（TypeScript）。
 * 需要系统已安装 Java 与 ANTLR4（antlr4 在 PATH）。
 * 若未安装，请从 https://www.antlr.org/download.html 获取并配置 PATH。
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const g4Dir = join(root, 'src', 'grammar', 'g4');
const cmd = 'antlr4 -Dlanguage=TypeScript -o generated -no-listener -no-visitor SysMLv2Parser.g4 SysMLv2Lexer.g4';

console.log('Running ANTLR4 from', g4Dir, '...');
try {
  execSync(cmd, { cwd: g4Dir, stdio: 'inherit' });
  console.log('G4 parser generated in src/grammar/g4/generated');
} catch (e) {
  console.error('ANTLR4 not found or failed. Ensure Java and ANTLR4 are on PATH.');
  console.error('Manual: cd src/grammar/g4 &&', cmd);
  process.exit(1);
}
