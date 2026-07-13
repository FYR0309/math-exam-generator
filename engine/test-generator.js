/**
 * test-generator.js — generator.js 闭环测试
 *
 * 加载真实题库 → 出卷 → 打印试卷 → 验证完整性
 *
 * 运行: node engine/test-generator.js
 */

const fs = require('fs');
const path = require('path');
const { Generator } = require('./generator');
const { Filler } = require('./filler');

const BANK_DIR = path.join(__dirname, '..', 'bank', 'math');

function loadGrade(dirName) {
  const dir = path.join(BANK_DIR, dirName);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const staticQ = JSON.parse(fs.readFileSync(path.join(dir, 'static.json'), 'utf8'));
  const templates = JSON.parse(fs.readFileSync(path.join(dir, 'templates.json'), 'utf8'));
  return { meta, staticQuestions: staticQ, templates, dirName };
}

const generator = new Generator({ filler: new Filler() });

// ═══════════════════════════════════════════
//  测试1：三年级下册 — 知识点筛选出卷
// ═══════════════════════════════════════════

console.log('═══════════════════════════════════════════');
console.log('  测试1: 三年级下册 — 乘法+小数 知识点');
console.log('═══════════════════════════════════════════\n');

const g3 = loadGrade('grade3');
const paper1 = generator.generate({
  meta: g3.meta,
  staticQuestions: g3.staticQuestions,
  templates: g3.templates,
  totalQuestions: 10,
  templateRatio: 0.5,
  knowledgePoints: ['multi-digit-multiplication', 'decimal-life'],
  difficultyRange: [1, 4],
});

console.log(`标题: ${paper1.title}`);
console.log(`副标题: ${paper1.subtitle}`);
console.log(`配置: ${paper1.config.templateCount}道模板 + ${paper1.config.staticCount}道静态 = ${paper1.config.totalQuestions}道`);
console.log(`知识点: ${paper1.config.knowledgePoints.join('、')}`);
console.log('');

console.log('─── 试题 ───\n');
for (const q of paper1.questions) {
  const typeLabel = { calculation: '计算', fill_blank: '填空', true_false: '判断', choice: '选择', application: '应用' }[q.type] || q.type;
  console.log(`${q.index}. [${typeLabel}][难度${q.difficulty}] ${q.question}`);
  if (q.options && q.options.length > 0) {
    console.log(`   ${q.options.join('  ')}`);
  }
  if (q.answer.steps && q.answer.steps.length > 0) {
    console.log(`   解: ${q.answer.steps.map(s => `${s.label}=${s.value}`).join(' → ')}`);
  }
  console.log(`   答: ${q.answer.finalAnswer}`);
  console.log('');
}

console.log('─── 答案速查 ───');
for (const a of paper1.answerKey) {
  console.log(`  ${a.index}. ${a.answer}`);
}

// ═══════════════════════════════════════════
//  测试2：一年级下册 — 全部知识点
// ═══════════════════════════════════════════

console.log('\n═══════════════════════════════════════════');
console.log('  测试2: 一年级下册 — 全部知识点');
console.log('═══════════════════════════════════════════\n');

const g1x = loadGrade('grade1-xia');
const paper2 = generator.generate({
  meta: g1x.meta,
  staticQuestions: g1x.staticQuestions,
  templates: g1x.templates,
  totalQuestions: 8,
  templateRatio: 0.4,
  knowledgePoints: [],
  difficultyRange: [1, 3],
});

console.log(`标题: ${paper2.title}`);
console.log(`配置: ${paper2.config.templateCount}道模板 + ${paper2.config.staticCount}道静态`);
console.log('');

for (const q of paper2.questions) {
  const typeLabel = { calculation: '计算', fill_blank: '填空', true_false: '判断', choice: '选择', application: '应用' }[q.type] || q.type;
  console.log(`${q.index}. [${typeLabel}] ${q.question}`);
  console.log(`   答: ${q.answer.finalAnswer}`);
  console.log('');
}

// ═══════════════════════════════════════════
//  测试3：边界情况
// ═══════════════════════════════════════════

console.log('═══════════════════════════════════════════');
console.log('  测试3: 边界情况');
console.log('═══════════════════════════════════════════\n');

let allPass = true;

// 3a. 题库不足
console.log('3a. 请求100道题（题库不足）...');
const paper3a = generator.generate({
  meta: g1x.meta,
  staticQuestions: g1x.staticQuestions,
  templates: g1x.templates,
  totalQuestions: 100,
  templateRatio: 0.5,
  knowledgePoints: [],
});
const ok3a = paper3a.questions.length < 100 && paper3a.questions.length > 0;
console.log(`  结果: ${paper3a.questions.length}道 → ${ok3a ? '✓ 合理降级' : '✗ 异常'}`);
allPass = allPass && ok3a;

// 3b. 纯静态 (templateRatio=0)
console.log('3b. 纯静态 (ratio=0)...');
const paper3b = generator.generate({
  meta: g3.meta,
  staticQuestions: g3.staticQuestions,
  templates: g3.templates,
  totalQuestions: 5,
  templateRatio: 0,
  knowledgePoints: [],
});
const ok3b = paper3b.config.templateCount === 0;
console.log(`  模板题: ${paper3b.config.templateCount}, 静态题: ${paper3b.config.staticCount} → ${ok3b ? '✓' : '✗'}`);
allPass = allPass && ok3b;

// 3c. 纯模板 (templateRatio=1)
console.log('3c. 纯模板 (ratio=1)...');
const paper3c = generator.generate({
  meta: g1x.meta,
  staticQuestions: g1x.staticQuestions,
  templates: g1x.templates,
  totalQuestions: 3,
  templateRatio: 1,
  knowledgePoints: [],
});
const ok3c = paper3c.config.staticCount === 0;
console.log(`  模板题: ${paper3c.config.templateCount}, 静态题: ${paper3c.config.staticCount} → ${ok3c ? '✓' : '✗'}`);
allPass = allPass && ok3c;

// 3d. 不存在的知识点
console.log('3d. 不匹配的知识点...');
const paper3d = generator.generate({
  meta: g3.meta,
  staticQuestions: g3.staticQuestions,
  templates: g3.templates,
  totalQuestions: 5,
  templateRatio: 0.5,
  knowledgePoints: ['nonexistent-kp'],
});
const ok3d = paper3d.questions.length === 0;
console.log(`  题目数: ${paper3d.questions.length} → ${ok3d ? '✓ 正确返回空' : '✗'}`);
allPass = allPass && ok3d;

// 3e. 题号连续
console.log('3e. 题号连续性...');
const indices = paper1.questions.map(q => q.index);
const ok3e = indices.join(',') === '1,2,3,4,5,6,7,8,9,10';
console.log(`  题号: ${indices.join(',')} → ${ok3e ? '✓' : '✗ 题号不连续'}`);
allPass = allPass && ok3e;

// ─── 汇总 ─────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(`  结论: ${allPass ? '✅ 全部通过' : '❌ 存在问题'}`);
console.log('═══════════════════════════════════════════\n');

process.exit(allPass ? 0 : 1);
