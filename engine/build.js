/**
 * build.js — 构建单文件HTML应用
 *
 * 读取：app/template.html + bank/ 下所有题库JSON
 * 输出：app.html（双击即用）
 *
 * 运行: node engine/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BANK_DIR = path.join(ROOT, 'bank', 'math');
const TEMPLATE_FILE = path.join(ROOT, 'app', 'template.html');
const OUTPUT_FILE = path.join(ROOT, 'app.html');

// ── 1. 读取所有题库 ─────────────────────────────

const bank = {};
const dirs = fs.readdirSync(BANK_DIR);

for (const dir of dirs) {
  const dirPath = path.join(BANK_DIR, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;

  const metaFile = path.join(dirPath, 'meta.json');
  const staticFile = path.join(dirPath, 'static.json');
  const templateFile = path.join(dirPath, 'templates.json');

  if (!fs.existsSync(metaFile)) {
    console.warn(`跳过 ${dir}: 缺少 meta.json`);
    continue;
  }

  bank[dir] = {
    meta: JSON.parse(fs.readFileSync(metaFile, 'utf8')),
    staticQuestions: fs.existsSync(staticFile)
      ? JSON.parse(fs.readFileSync(staticFile, 'utf8'))
      : [],
    templates: fs.existsSync(templateFile)
      ? JSON.parse(fs.readFileSync(templateFile, 'utf8'))
      : [],
    exam: fs.existsSync(path.join(dirPath, 'exam.json'))
      ? JSON.parse(fs.readFileSync(path.join(dirPath, 'exam.json'), 'utf8'))
      : null,
  };

  const examTag = bank[dir].exam ? ' 📋套卷' : '';
  console.log(
    `✓ ${dir}: ${bank[dir].meta.knowledgePoints.length}知识点, ` +
    `${bank[dir].staticQuestions.length}静, ${bank[dir].templates.length}模${examTag}`
  );
}

// ── 2. 读取模板HTML ─────────────────────────────

let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');

// ── 3. 注入题库数据 ─────────────────────────────

const bankJSON = JSON.stringify(bank, null, 2);
html = html.replace('{{BANK_DATA}}', bankJSON);

// ── 4. 写入输出 ─────────────────────────────────

fs.writeFileSync(OUTPUT_FILE, html, 'utf8');

const stats = fs.statSync(OUTPUT_FILE);
const sizeKB = (stats.size / 1024).toFixed(1);

console.log(`\n✅ 构建完成: app.html (${sizeKB} KB)`);
console.log(`   双击 app.html 即可使用`);
