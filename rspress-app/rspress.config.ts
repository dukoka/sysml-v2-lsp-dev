import { defineConfig } from '@rspress/core';
import path from 'path';
import { fileURLToPath } from 'url';
import { pluginLess } from '@rsbuild/plugin-less';
import mermaid from 'rspress-plugin-mermaid';
import pluginReadingTime from 'rspress-plugin-reading-time';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(__dirname, '..', 'docs'),
  title: 'SysML v2 LSP 文档',
  description: 'SysML v2 语言与 LSP 相关文档',
  plugins: [
    mermaid(),
    pluginReadingTime(),
  ],
  builderConfig: {
    plugins: [pluginLess()],
  },
});
