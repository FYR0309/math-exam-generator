# 题库 JSON 格式规范

> 版本：v1.0 | 2026-07-13
>
> 引擎只认 JSON 结构，不认年级/学科。加年级 = 加文件夹，加学科 = 加文件夹。

---

## 一、目录结构

```
bank/
└── {subject}/          ← 学科（math / chinese / english ...）
    └── {grade}/        ← 年级（grade1 / grade3 / grade5 ...）
        ├── meta.json         ← 年级元数据
        ├── static.json       ← 静态题库（写死的题）
        └── templates.json    ← 模板题库（参数化生成）
```

引擎扫描 `bank/` 自动发现所有学科和年级，界面下拉选项自动生成。

---

## 二、meta.json — 年级元数据

### 完整结构

```jsonc
{
  "subject": "math",                    // 学科标识（小写英文）
  "subjectName": "数学",                // 学科中文名（界面展示用）
  "grade": 3,                           // 年级数字
  "gradeLabel": "三年级",               // 年级中文标签
  "textbook": "冀教版2024新版",          // 教材版本
  "schoolYear": "2025-2026",            // 学年

  "questionTypes": [                    // 本年级支持的题型
    "calculation",                      // 计算题
    "fill_blank",                       // 填空题
    "true_false",                       // 判断题
    "choice",                           // 选择题
    "application"                       // 应用题
  ],

  "defaultTemplateRatio": 0.5,          // 默认模板/静态比例（界面初始值）

  "knowledgePoints": [                  // 知识点清单
    {
      "id": "multiply-2digit",          // 唯一标识（kebab-case）
      "name": "两位数乘两位数",          // 中文名
      "category": "计算",               // 分类：计算/几何/应用/统计
      "difficulty": 3,                  // 基础难度 1-5
      "canComboWith": [                 // 🔑 可以和哪些知识点组合出题
        "add-sub-10000",
        "divide-1digit"
      ],
      "prerequisites": [               // 前置知识点（可选）
        "multiply-1digit"
      ]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `subject` | string | ✅ | 学科标识，小写英文 |
| `grade` | number | ✅ | 年级数字 |
| `textbook` | string | ✅ | 教材版本 |
| `knowledgePoints` | array | ✅ | 知识点清单 |
| `knowledgePoints[].id` | string | ✅ | 全局唯一，引擎用这个匹配 |
| `knowledgePoints[].canComboWith` | array | ✅ | 即使不能组合也写空数组 `[]` |
| `defaultTemplateRatio` | number | ✅ | 0-1，界面初始滑块位置 |

---

## 三、static.json — 静态题库

### 完整结构

```jsonc
[
  {
    "id": "g1-s-001",                   // 唯一ID：g{年级}-s-{序号}
    "type": "calculation",              // 题型（对应 meta.questionTypes）
    "question": "23 + 45 = ？",         // 题目文本
    "options": [],                      // 选择题的选项（非选择题为空数组）
    "answer": "68",                     // 答案（与模板答案格式一致）
    "knowledgePoints": ["add-sub-100-nocarry"],
    "difficulty": 1,                    // 本题具体难度 1-5
    "errorProne": [],                   // 易错点标签
    "source": "梅学堂"                   // 题源（可选）
  }
]
```

### 各题型的 question 格式约定

| type | question 格式 | 示例 |
|---|---|---|
| `calculation` | `算式 = ？` | `345 + 278 = ？` |
| `fill_blank` | `题干，____` 处填答案 | `1米 = ____ 厘米` |
| `true_false` | `陈述句（ ）` | `正方形有4条边。（ ）` |
| `choice` | `题干` + options | `下面哪个是锐角？` |
| `application` | `完整应用题题干` | `小明有8个苹果...` |

### 选择题补充

```jsonc
{
  "type": "choice",
  "question": "下面哪个数是偶数？",
  "options": ["A. 7", "B. 13", "C. 18", "D. 21"],
  "answer": "C"
}
```

---

## 四、templates.json — 模板题库

这是整个系统的核心。每道模板 = 题干骨架 + 参数槽位 + 约束条件 + 答案公式。

### 完整结构

```jsonc
[
  {
    "id": "g3-t-001",                   // 唯一ID：g{年级}-t-{序号}

    // ── 题干模板 ──
    "template": "{person}买了{a}千克{stuff}，每千克{b}元，又买了{c}千克{fruit}，每千克{d}元。{person}一共花了多少钱？",

    // ── 题型 ──
    "type": "application",

    // ── 知识点 ──
    "knowledgePoints": ["multiply-2digit", "add-sub-10000"],

    // ── 难度 ──
    "difficulty": 3,

    // ── 易错点 ──
    "errorProne": ["单位遗漏", "两步混淆"],

    // ── 参数槽位 ──
    "slots": {
      "person": {
        "type": "pick",                 // 从列表随机选
        "values": ["小明", "小红", "小刚", "小丽"]
      },
      "stuff": {
        "type": "pick",
        "values": ["苹果", "梨", "香蕉"]
      },
      "fruit": {
        "type": "pick",
        "values": ["橘子", "西瓜", "桃子", "葡萄"]
      },
      "a": {
        "type": "range",                // 整数范围随机取
        "min": 2,
        "max": 9,
        "step": 1                       // 步长（可选，默认1）
      },
      "b": {
        "type": "range",
        "min": 3,
        "max": 8
      },
      "c": {
        "type": "range",
        "min": 1,
        "max": 7
      },
      "d": {
        "type": "range",
        "min": 3,
        "max": 8
      }
    },

    // ── 约束条件 ──
    // 填好槽位后逐条检查，不满足则重新随机填
    "constraints": [
      { "check": "a !== c || b !== d",       "msg": "两组数据应不同，增加区分度" },
      { "check": "a * b > c * d",             "msg": "第一组总价应大于第二组（方便后续比较）" },
      { "check": "a * b + c * d <= 100",      "msg": "总价不超过100，符合三年级范围" }
    ],

    // ── 答案 ──
    "answer": {
      "type": "steps",
      "unit": "元",
      "steps": [
        { "label": "{stuff}总价",     "expr": "a * b",         "unit": "元" },
        { "label": "{fruit}总价",     "expr": "c * d",         "unit": "元" },
        { "label": "一共花的钱",       "expr": "a * b + c * d", "unit": "元" }
      ]
    },

    // ── 题源 ──
    "source": "梅学堂·三年级·两位数乘法应用"
  }
]
```

### 槽位类型详解

#### range — 数值范围

```jsonc
{
  "a": {
    "type": "range",
    "min": 2,
    "max": 9,
    "step": 1          // 可选，默认1。step=5 → 5,10,15...
  }
}
```

#### pick — 随机选择

```jsonc
{
  "person": {
    "type": "pick",
    "values": ["小明", "小红", "小刚"]
  }
}
```

`values` 可以是字符串数组，也可以是数字数组（如 `[10, 20, 50, 100]`）。

#### computed — 计算得出（高级）

某些槽位的值不应该随机，而是由其他槽位算出来。比如「总页数 = 每天看的页数 × 天数」。

```jsonc
{
  "totalPages": {
    "type": "computed",
    "expr": "pagesPerDay * days"
  }
}
```

computed 槽位不参与随机填充，在约束检查前自动计算。

### 约束条件写法

`check` 字段是一个 JavaScript 表达式，引擎用 `eval()` 安全执行（变量只来自槽位值，无外部访问）。

支持的运算符：`+` `-` `*` `/` `%` `>` `<` `>=` `<=` `===` `!==` `&&` `||` `!`

白名单函数：`Math.ceil` `Math.floor` `Math.round` `Math.abs` `Math.max` `Math.min`（进一法/去尾法/四舍五入等必需）

不支持的：其他函数调用、位运算、赋值。引擎在 `eval` 前会做安全检查。

```jsonc
"constraints": [
  { "check": "a > b",                    "msg": "被减数应大于减数" },
  { "check": "a * b >= 10",             "msg": "乘积至少为10" },
  { "check": "total < 100",             "msg": "结果不超过100" },
  { "check": "a !== b && c !== d",      "msg": "参数应有差异" }
]
```

### 答案类型

#### expression — 单表达式

答案就一个值：

```jsonc
"answer": {
  "type": "expression",
  "expr": "a - b",
  "unit": "只"         // 可选
}
```

#### steps — 分步答案

多步计算，每步有标签和表达式：

```jsonc
"answer": {
  "type": "steps",
  "unit": "元",        // 最终答案单位（可选）
  "steps": [
    { "label": "苹果总价",   "expr": "a * b",         "unit": "元" },
    { "label": "橘子总价",   "expr": "c * d",         "unit": "元" },
    { "label": "一共",       "expr": "a * b + c * d", "unit": "元" }
  ]
}
```

最后一步的 `expr` 结果 = 最终答案。

---

## 五、ID 命名约定

| 文件 | ID 格式 | 示例 |
|---|---|---|
| 一年级静态 | `g1-s-{序号}` | `g1-s-001` |
| 一年级模板 | `g1-t-{序号}` | `g1-t-001` |
| 三年级静态 | `g3-s-{序号}` | `g3-s-001` |
| 三年级模板 | `g3-t-{序号}` | `g3-t-001` |
| 知识点 | kebab-case 英文 | `multiply-2digit` |

---

## 六、验证规则

引擎加载题库时自动执行：

1. **meta.json**：`knowledgePoints` 中每个 `id` 唯一；`canComboWith` 中的 ID 必须存在于同一 `meta.json`
2. **static.json**：每条题的 `knowledgePoints` 中的 ID 必须在 `meta.json` 中存在
3. **templates.json**：同上；所有 slot 名在 `template` 文本中出现；`constraints` 中引用的变量仅为 slot 名；`answer` 中引用的变量仅为 slot 名
4. **template 填充后**：实际生成的题必须满足所有约束；答案表达式可正确求值

---

## 七、扩展指南

### 加一个年级

```
bank/math/grade5/
├── meta.json
├── static.json
└── templates.json
```

引擎和界面自动识别，零代码改动。

### 加一个学科

```
bank/chinese/grade3/
├── meta.json
├── static.json
└── templates.json
```

`meta.subject` 写 `"chinese"`，界面下拉自动多出「语文」选项。

### 加一种题型

在 `meta.questionTypes` 数组中加一个字符串即可。引擎不做题型校验，只透传。
