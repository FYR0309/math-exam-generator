/**
 * filler.js — 参数填充引擎
 *
 * 读模板 → 随机填槽位 → 约束检查 → 计算答案 → 输出成品题
 *
 * 用法:
 *   const filler = new Filler()
 *   const question = filler.fill(template)
 *   // question.question → "小明去超市买了5千克苹果，每千克6元..."
 *   // question.answer.finalAnswer → "44元"
 *
 * 安全: 表达式求值使用沙箱 new Function()，
 *       只允许 slot 变量 + Math 函数 + parseInt/parseFloat
 */

class Filler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 200;
    this.verbose = options.verbose || false;
  }

  /**
   * 主入口：填一个模板，返回完整题目
   * @param {Object} template - 模板对象
   * @returns {Object} 成品题目
   */
  fill(template) {
    // 如果有自定义处理器，走自定义逻辑
    if (template.customHandler) {
      return this._customFill(template);
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const slots = this._fillSlots(template.slots);
      if (this._checkConstraints(template.constraints, slots)) {
        const questionText = this._render(template.template, slots);
        const answer = this._computeAnswer(template.answer, slots);
        return {
          id: template.id,
          type: template.type,
          question: questionText,
          knowledgePoints: template.knowledgePoints,
          difficulty: template.difficulty,
          errorProne: template.errorProne,
          slots: slots,
          answer: answer,
          source: template.source || '',
        };
      }
    }
    throw new Error(
      `模板 ${template.id}: ${this.maxRetries} 次重试均失败，请检查约束条件是否矛盾。`
    );
  }

  /**
   * 批量填充同一模板多次
   * @param {Object} template
   * @param {number} count
   * @returns {Object[]}
   */
  fillBatch(template, count) {
    const results = [];
    const seen = new Set(); // 去重
    let attempts = 0;
    const maxAttempts = count * 50;

    while (results.length < count && attempts < maxAttempts) {
      attempts++;
      try {
        const q = this.fill(template);
        const key = q.question;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(q);
        }
      } catch (e) {
        // 跳过失败的尝试
      }
    }

    if (results.length < count) {
      console.warn(
        `模板 ${template.id}: 仅生成 ${results.length}/${count} 道不重复题目（${attempts} 次尝试）`
      );
    }
    return results;
  }

  // ─── 私有方法 ───────────────────────────────────

  /**
   * 填充所有槽位：先 range/pick，再 computed
   */
  _fillSlots(slotDefs) {
    const slots = {};

    // 第一轮：range 和 pick
    for (const [name, def] of Object.entries(slotDefs)) {
      if (def.type === 'range') {
        slots[name] = this._randomRange(def);
      } else if (def.type === 'pick') {
        slots[name] = this._randomPick(def);
      }
    }

    // 第二轮：computed（依赖其他槽位）
    for (const [name, def] of Object.entries(slotDefs)) {
      if (def.type === 'computed') {
        slots[name] = this._eval(def.expr, slots);
      }
    }

    return slots;
  }

  /**
   * range 类型：在 [min, max] 区间内按 step 随机取值
   */
  _randomRange(def) {
    const { min, max } = def;
    const step = def.step || 1;
    const steps = Math.floor((max - min) / step);
    const value = min + Math.floor(Math.random() * (steps + 1)) * step;

    // 浮点步长时保留正确小数位数
    if (step < 1) {
      const decimals = String(step).split('.')[1]?.length || 0;
      return parseFloat(value.toFixed(decimals));
    }
    return value;
  }

  /**
   * pick 类型：从数组中随机选一个
   */
  _randomPick(def) {
    const arr = def.values;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * 逐条检查约束条件，全部通过才返回 true
   */
  _checkConstraints(constraints, slots) {
    if (!constraints || constraints.length === 0) return true;
    for (const c of constraints) {
      try {
        const result = this._eval(c.check, slots);
        if (!result) {
          if (this.verbose) {
            console.log(`  约束失败: ${c.check}  (${c.msg || ''})`);
          }
          return false;
        }
      } catch (e) {
        // 表达式求值失败（如使用了不支持的函数）
        if (this.verbose) {
          console.log(`  约束求值异常: ${c.check}  (${e.message})`);
        }
        return false;
      }
    }
    return true;
  }

  /**
   * 安全求值表达式
   *
   * 允许:
   *   - 运算符: + - * / % > < >= <= === !== && || !
   *   - 函数: Math.ceil/floor/round/abs/max/min, parseInt, parseFloat
   *   - 三元: condition ? a : b
   *
   * 不允许:
   *   - 访问全局对象 (window/document/global)
   *   - 位运算、赋值、函数调用（白名单外）
   */
  _eval(expr, slots) {
    const slotNames = Object.keys(slots);
    const slotValues = Object.values(slots);

    // 用 new Function 创建沙箱函数
    // 只暴露 slot 变量 + Math + parseInt + parseFloat
    const fn = new Function(
      ...slotNames,
      '_Math',
      '_parseInt',
      '_parseFloat',
      `return (${expr});`
    );

    try {
      const result = fn(...slotValues, Math, parseInt, parseFloat);
      // 修复浮点数精度问题（如 9.8 - 3 = 6.800000000000001）
      if (typeof result === 'number' && !Number.isInteger(result)) {
        return parseFloat(result.toFixed(10));
      }
      return result;
    } catch (e) {
      throw new Error(`表达式求值失败 "${expr}": ${e.message}`);
    }
  }

  /**
   * 把模板字符串里的 {slot名} 替换成实际值
   */
  _render(template, slots) {
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      return slots[name] !== undefined ? String(slots[name]) : match;
    });
  }

  /**
   * 根据 answer 定义计算答案
   * 支持 expression 和 steps 两种类型
   */
  _computeAnswer(answerDef, slots) {
    if (!answerDef) {
      return { finalAnswer: '', steps: [] };
    }

    if (answerDef.type === 'expression') {
      const value = this._eval(answerDef.expr, slots);
      const formatted = answerDef.unit
        ? `${value}${answerDef.unit}`
        : String(value);
      return { finalAnswer: formatted, steps: [] };
    }

    if (answerDef.type === 'steps') {
      const steps = answerDef.steps.map((step) => {
        const label = this._render(step.label, slots);
        const value = this._eval(step.expr, slots);
        const formatted = step.unit ? `${value}${step.unit}` : String(value);
        return { label, value: formatted };
      });

      const finalStep = steps[steps.length - 1];
      return {
        finalAnswer: finalStep ? finalStep.value : '',
        steps: steps,
      };
    }

    throw new Error(`未知的答案类型: ${answerDef.type}`);
  }

  /**
   * 自定义模板处理器（跳过标准流程，由模板自带逻辑处理）
   */
  _customFill(template) {
    if (typeof template.customHandler === 'function') {
      return template.customHandler(this);
    }
    throw new Error(`模板 ${template.id} 的 customHandler 不可调用`);
  }
}

// ─── 导出 ───────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Filler };
}

// 浏览器环境
if (typeof window !== 'undefined') {
  window.Filler = Filler;
}
