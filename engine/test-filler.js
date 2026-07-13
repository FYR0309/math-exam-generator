/**
 * test-filler.js — filler.js 闭环测试
 *
 * 加载全部模板 → 逐个填充 → 验证约束/答案/生成质量
 *
 * 运行: node engine/test-filler.js
 */

const fs = require('fs');
const path = require('path');
const { Filler } = require('./filler');

// ─── 加载所有模板 ──────────────────────────────

const BANK_DIR = path.join(__dirname, '..', 'bank', 'math');

function loadAllTemplates() {
  const templates = [];
  const dirs = fs.readdirSync(BANK_DIR);

  for (const dir of dirs) {
    const templateFile = path.join(BANK_DIR, dir, 'templates.json');
    if (fs.existsSync(templateFile)) {
      const list = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
      for (const t of list) {
        templates.push({ ...t, _sourceDir: dir });
      }
    }
  }
  return templates;
}

// ─── 运行测试 ──────────────────────────────────

const filler = new Filler({ verbose: false });
const templates = loadAllTemplates();

console.log('═══════════════════════════════════════════');
console.log(`  模板填充测试 — 共 ${templates.length} 道模板`);
console.log('═══════════════════════════════════════════\n');

let totalPass = 0;
let totalFail = 0;
const failures = [];

for (const tpl of templates) {
  const batchSize = 5;
  process.stdout.write(`[${tpl.id}] ${tpl._sourceDir} — 生成 ${batchSize} 道... `);

  try {
    const results = filler.fillBatch(tpl, batchSize);

    if (results.length < batchSize) {
      console.log(`⚠ 仅 ${results.length}/${batchSize} (去重后)`);
    } else {
      console.log(`✓ ${results.length}/${batchSize}`);
    }

    // 打印第一道样例
    const sample = results[0];
    console.log(`  题: ${sample.question}`);
    if (sample.answer.steps.length > 0) {
      console.log(`  解: ${sample.answer.steps.map(s => `${s.label}=${s.value}`).join(' → ')}`);
    }
    console.log(`  答: ${sample.answer.finalAnswer}`);
    console.log(`  槽: ${JSON.stringify(sample.slots)}`);
    console.log('');

    totalPass += results.length;
  } catch (e) {
    console.log(`✗ 失败: ${e.message}`);
    failures.push({ id: tpl.id, error: e.message });
    totalFail++;
  }
}

// ─── 附加：验证答案合理性 ──────────────────────

console.log('───────────────────────────────────────────');
console.log('  答案合理性抽查');
console.log('───────────────────────────────────────────\n');

let answerIssues = 0;

for (const tpl of templates) {
  try {
    const results = filler.fillBatch(tpl, 3);
    for (const r of results) {
      const ans = r.answer.finalAnswer;
      // 检查：答案不能为空
      if (!ans || ans === 'undefined' || ans === 'NaN' || ans.includes('NaN')) {
        console.log(`✗ [${tpl.id}] 答案异常: "${ans}"  → 题: ${r.question}`);
        answerIssues++;
      }
    }
  } catch (e) {
    // 已在上面报告
  }
}

if (answerIssues === 0) {
  console.log('✓ 全部答案有效 (无 NaN/undefined/空值)\n');
}

// ─── 汇总 ─────────────────────────────────────

console.log('═══════════════════════════════════════════');
console.log(`  测试结果汇总`);
console.log('═══════════════════════════════════════════');
console.log(`  模板总数:    ${templates.length}`);
console.log(`  成功生成:    ${totalPass} 道题`);
console.log(`  失败模板:    ${totalFail}`);
console.log(`  答案异常:    ${answerIssues}`);

if (failures.length > 0) {
  console.log(`\n  失败详情:`);
  for (const f of failures) {
    console.log(`    - ${f.id}: ${f.error}`);
  }
}

const allPass = totalFail === 0 && answerIssues === 0;
console.log(`\n  结论: ${allPass ? '✅ 全部通过' : '❌ 存在问题'}`);
console.log('═══════════════════════════════════════════\n');

process.exit(allPass ? 0 : 1);
