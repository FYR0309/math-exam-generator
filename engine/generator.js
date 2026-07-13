/**
 * generator.js — 出卷引擎
 *
 * 输入：题库数据 + 出卷参数
 * 输出：完整试卷（题目列表 + 答案）
 *
 * 用法:
 *   const gen = new Generator({ filler: new Filler() })
 *   const paper = gen.generate({
 *     meta: metaJson,
 *     staticQuestions: staticJson,
 *     templates: templatesJson,
 *     totalQuestions: 20,
 *     templateRatio: 0.5,
 *     knowledgePoints: ['multi-digit-multiplication'],
 *   })
 */

const { Filler } = require('./filler');

class Generator {
  constructor(options = {}) {
    this.filler = options.filler || new Filler();
  }

  /**
   * 主入口：生成一张试卷
   *
   * @param {Object} opts
   * @param {Object} opts.meta            - meta.json 内容
   * @param {Array}  opts.staticQuestions  - static.json 内容
   * @param {Array}  opts.templates        - templates.json 内容
   * @param {number} opts.totalQuestions   - 总题数
   * @param {number} opts.templateRatio    - 模板题占比 0~1
   * @param {string[]} opts.knowledgePoints - 知识点ID列表（空=全部）
   * @param {number[]} [opts.difficultyRange] - 难度范围 [min, max]（可选）
   * @param {string} [opts.title]           - 试卷标题（可选，默认用meta生成）
   * @returns {Object} 试卷对象
   */
  generate(opts) {
    const {
      meta,
      staticQuestions,
      templates,
      totalQuestions = 20,
      templateRatio = 0.5,
      knowledgePoints = [],
      difficultyRange = [1, 5],
      title,
    } = opts;

    // ── 1. 按知识点筛选 ─────────────────────
    let filteredStatic = staticQuestions || [];
    let filteredTemplates = templates || [];

    if (knowledgePoints.length > 0) {
      filteredStatic = filteredStatic.filter((q) =>
        q.knowledgePoints.some((kp) => knowledgePoints.includes(kp))
      );
      filteredTemplates = filteredTemplates.filter((t) =>
        t.knowledgePoints.some((kp) => knowledgePoints.includes(kp))
      );
    }

    // ── 2. 按难度筛选 ─────────────────────
    const [dMin, dMax] = difficultyRange;
    filteredStatic = filteredStatic.filter(
      (q) => q.difficulty >= dMin && q.difficulty <= dMax
    );
    filteredTemplates = filteredTemplates.filter(
      (t) => t.difficulty >= dMin && t.difficulty <= dMax
    );

    // ── 3. 计算动静分配 ─────────────────────
    let templateCount = Math.round(totalQuestions * templateRatio);
    let staticCount = totalQuestions - templateCount;

    // 如果某一方不够，用另一方补
    if (templateCount > filteredTemplates.length) {
      const shortfall = templateCount - filteredTemplates.length;
      templateCount = filteredTemplates.length;
      staticCount = Math.min(
        totalQuestions - templateCount,
        filteredStatic.length
      );
      // 仍然不够：total 缩减
    }
    if (staticCount > filteredStatic.length) {
      const shortfall = staticCount - filteredStatic.length;
      staticCount = filteredStatic.length;
      templateCount = Math.min(
        totalQuestions - staticCount,
        filteredTemplates.length
      );
    }

    const actualTotal = templateCount + staticCount;
    if (actualTotal < totalQuestions) {
      console.warn(
        `题目不足: 需要 ${totalQuestions} 道，实际可用 ${actualTotal} 道 ` +
        `(模板池 ${filteredTemplates.length}, 静态池 ${filteredStatic.length})`
      );
    }

    // ── 4. 抽取静态题 ─────────────────────
    const pickedStatic = this._pickRandom(filteredStatic, staticCount);

    // ── 5. 抽取模板 → 调用Filler填题 ──────────
    const pickedTemplates = this._pickRandom(filteredTemplates, templateCount);
    const filledTemplates = [];
    for (const tpl of pickedTemplates) {
      try {
        const filled = this.filler.fill(tpl);
        filledTemplates.push({
          index: 0, // 待排序后赋值
          type: filled.type,
          question: filled.question,
          answer: filled.answer,
          difficulty: filled.difficulty,
          knowledgePoints: filled.knowledgePoints,
          source: 'template',
          templateId: filled.id,
        });
      } catch (e) {
        console.warn(`模板 ${tpl.id} 填充失败: ${e.message}`);
      }
    }

    // ── 6. 组装题目列表 ─────────────────────
    let questions = [
      ...pickedStatic.map((q) => ({
        index: 0,
        type: q.type,
        question: q.question,
        options: q.options || [],
        answer: this._formatStaticAnswer(q),
        difficulty: q.difficulty,
        knowledgePoints: q.knowledgePoints,
        source: 'static',
        staticId: q.id,
      })),
      ...filledTemplates,
    ];

    // ── 7. 洗牌 + 按难度排序 ──────────────────
    questions = this._shuffle(questions);
    questions = this._sortByDifficulty(questions);

    // 分配题号
    questions.forEach((q, i) => {
      q.index = i + 1;
    });

    // ── 8. 生成试卷标题 ─────────────────────
    const paperTitle =
      title ||
      `${meta.subjectName || '数学'}练习题`;
    const subtitle = [
      meta.gradeLabel,
      meta.semester,
      meta.textbook,
    ]
      .filter(Boolean)
      .join(' · ');

    // ── 9. 组装结果 ─────────────────────────
    const kpNames = this._getKpNames(meta, knowledgePoints);

    return {
      title: paperTitle,
      subtitle: subtitle,
      generatedAt: new Date().toISOString(),
      config: {
        totalQuestions: questions.length,
        requestedTotal: totalQuestions,
        templateRatio: templateRatio,
        templateCount: filledTemplates.length,
        staticCount: pickedStatic.length,
        knowledgePoints: kpNames,
        difficultyRange: [dMin, dMax],
      },
      questions: questions,
      // 附加：答案汇总
      answerKey: questions.map((q) => ({
        index: q.index,
        answer: q.answer.finalAnswer || q.answer,
        steps: q.answer.steps || [],
      })),
    };
  }

  /**
   * 套卷模式：按考试配置生成完整试卷
   *
   * @param {Object} opts
   * @param {Object} opts.exam    - exam.json 内容
   * @param {Object} opts.meta    - meta.json 内容
   * @param {Array}  opts.staticQuestions
   * @param {Array}  opts.templates
   * @returns {Object} 试卷对象
   */
  generateExam(opts) {
    const { exam, meta, staticQuestions, templates } = opts;
    const questions = [];
    let qIndex = 0;

    const sections = [];

    for (const sec of exam.sections) {
      const secQuestions = [];
      const renderedSubs = [];

      if (sec.subSections) {
        // 含子章节（如计算题）— 每个子章节存自己的题
        for (const sub of sec.subSections) {
          const subQuestions = [];
          for (const item of (sub.items || [])) {
            const picked = this._pickExamQuestions(
              item, staticQuestions, templates, qIndex
            );
            picked.forEach(q => { qIndex++; q.index = qIndex; subQuestions.push(q); secQuestions.push(q); });
          }
          renderedSubs.push({
            name: sub.name,
            instruction: sub.instruction || '',
            questions: subQuestions,
          });
        }
      } else {
        // 普通章节
        for (const item of (sec.items || [])) {
          const picked = this._pickExamQuestions(
            item, staticQuestions, templates, qIndex
          );
          picked.forEach(q => { qIndex++; q.index = qIndex; secQuestions.push(q); });
        }
      }

      questions.push(...secQuestions);
      sections.push({
        name: sec.name,
        instruction: sec.instruction || '',
        totalPoints: sec.totalPoints || 0,
        subSections: renderedSubs.length > 0 ? renderedSubs : null,
        questions: renderedSubs.length > 0 ? [] : secQuestions,
      });
    }

    return {
      title: exam.title || (meta.subjectName + '期末测试卷'),
      subtitle: [meta.gradeLabel, meta.semester, meta.textbook].filter(Boolean).join(' · '),
      totalScore: exam.totalScore || 100,
      duration: exam.duration || 60,
      headerFields: exam.headerFields || ['班级____', '姓名____', '得分____'],
      generatedAt: new Date().toISOString(),
      mode: 'exam',
      sections,
      questions,
      answerKey: questions.map(q => ({
        index: q.index,
        points: q.points,
        answer: q.answer.finalAnswer,
        steps: q.answer.steps || [],
      })),
    };
  }

  /**
   * 按单条 item 规则抽取题目
   */
  _pickExamQuestions(item, staticQuestions, templates, startIndex) {
    const { count, type, pointsEach, knowledgePoints, sourceType } = item;
    const results = [];

    let pool = [];
    if (sourceType === 'static') {
      pool = (staticQuestions || []).filter(q => q.type === type);
    } else if (sourceType === 'template') {
      pool = (templates || []).filter(t => t.type === type);
    } else {
      // 'any' or 'mix'
      const sp = (staticQuestions || []).filter(q => q.type === type);
      const tp = (templates || []).filter(t => t.type === type);
      pool = [...sp, ...tp];
    }

    // 按知识点筛选
    if (knowledgePoints && knowledgePoints.length > 0) {
      pool = pool.filter(q =>
        q.knowledgePoints.some(kp => knowledgePoints.includes(kp))
      );
    }

    // 随机抽取
    const picked = this._pick(pool, count);

    for (const q of picked) {
      let question;
      if (q.template !== undefined) {
        // 是模板，用 filler 填充
        try {
          const filled = this.filler.fill(q);
          question = {
            type: filled.type,
            question: filled.question,
            options: q.options || [],
            answer: filled.answer,
            difficulty: filled.difficulty,
            points: pointsEach,
            source: 'template',
          };
        } catch (e) {
          continue; // 跳过填充失败的模板
        }
      } else {
        // 是静态题
        question = {
          type: q.type,
          question: q.question,
          options: q.options || [],
          answer: typeof q.answer === 'string'
            ? { finalAnswer: q.answer, steps: [] }
            : (q.answer || { finalAnswer: '', steps: [] }),
          difficulty: q.difficulty,
          points: pointsEach,
          source: 'static',
        };
      }
      results.push(question);
    }

    return results;
  }

  // ─── 私有方法 ──────────────────────────────

  /**
   * 从数组中随机抽 n 个不重复元素
   */
  _pickRandom(arr, n) {
    if (n <= 0) return [];
    if (n >= arr.length) return [...arr];
    const shuffled = [...arr];
    // Fisher-Yates 部分洗牌
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (shuffled.length - i));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  }

  /**
   * Fisher-Yates 完整洗牌
   */
  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * 按难度排序（容易→难），同难度随机
   */
  _sortByDifficulty(questions) {
    return questions.sort((a, b) => {
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty;
      }
      // 同难度保持随机性
      return Math.random() - 0.5;
    });
  }

  /**
   * 格式化静态题的答案（统一输出格式）
   */
  _formatStaticAnswer(question) {
    // 静态题的 answer 是字符串，包装成统一格式
    if (typeof question.answer === 'string') {
      return {
        finalAnswer: question.answer,
        steps: [],
      };
    }
    // 如果已经是对象格式，直接返回
    if (question.answer && question.answer.finalAnswer !== undefined) {
      return question.answer;
    }
    return { finalAnswer: String(question.answer), steps: [] };
  }

  /**
   * 获取知识点中文名列表
   */
  _getKpNames(meta, kpIds) {
    if (!meta || !meta.knowledgePoints) return [];
    const map = {};
    for (const kp of meta.knowledgePoints) {
      map[kp.id] = kp.name;
    }
    if (kpIds.length === 0) {
      return Object.values(map);
    }
    return kpIds.map((id) => map[id] || id);
  }
}

// ─── 导出 ───────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Generator };
}
if (typeof window !== 'undefined') {
  window.Generator = Generator;
}
