# Lógica de Presupuestos, Informes y Categorización ML — Portada a Node.js

> Extraído desde [rcarcamoc/PersonalFinanceApp](https://github.com/rcarcamoc/PersonalFinanceApp) (Android/Kotlin)  
> Traducido para implementación en **Node.js** (Express + Sequelize / Prisma)

---

## Modelos de Datos

Los tres modelos centrales del repositorio original son `Category`, `Budget` y `Expense`. La relación es: una categoría puede tener muchos presupuestos (uno por mes/año) y muchos gastos.

```js
// models/Category.js  (Sequelize example)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Category', {
    id:   { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
  }, { tableName: 'categories', timestamps: false });
};
```

```js
// models/Budget.js
module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  return sequelize.define('Budget', {
    id:         { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    categoryId: { type: DataTypes.BIGINT, allowNull: false },
    amount:     { type: DataTypes.DOUBLE, allowNull: false },
    month:      { type: DataTypes.INTEGER, allowNull: false }, // 1-12
    year:       { type: DataTypes.INTEGER, allowNull: false },
  }, { tableName: 'budgets', timestamps: false });
};
```

```js
// models/Expense.js
module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  return sequelize.define('Expense', {
    id:              { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    amount:          { type: DataTypes.DOUBLE, allowNull: false },
    date:            { type: DataTypes.DATEONLY, allowNull: false }, // 'YYYY-MM-DD'
    time:            { type: DataTypes.STRING(8) },                   // 'HH:MM'
    merchant:        { type: DataTypes.STRING(255) },
    categoryId:      { type: DataTypes.BIGINT, allowNull: true },
    installments:    { type: DataTypes.INTEGER, allowNull: true },
    lastCardDigits:  { type: DataTypes.STRING(4), allowNull: true },
    description:     { type: DataTypes.STRING(500), allowNull: true },
  }, { tableName: 'expenses', timestamps: false });
};
```

---

## Lógica de Presupuestos (Budget)

### Casos de uso (Use Cases)

El repositorio original usa el patrón **Use Case** de Clean Architecture. En Node.js se mapea directamente como clases o funciones de servicio.

```js
// services/budgetService.js
const { Budget } = require('../models');
const { Op } = require('sequelize');

/** Obtener todos los presupuestos */
async function getAllBudgets() {
  return Budget.findAll();
}

/** Obtener presupuesto de una categoría para un mes/año específico */
async function getBudgetForCategoryAndMonth(categoryId, month, year) {
  return Budget.findOne({ where: { categoryId, month, year } });
}

/** Obtener todos los presupuestos de un mes/año */
async function getBudgetsForMonth(month, year) {
  return Budget.findAll({ where: { month, year } });
}

/** Insertar o actualizar presupuesto (upsert) */
async function upsertBudget({ categoryId, amount, month, year }) {
  const [budget, created] = await Budget.findOrCreate({
    where: { categoryId, month, year },
    defaults: { amount },
  });
  if (!created) await budget.update({ amount });
  return budget;
}

/** Eliminar presupuesto */
async function deleteBudget(id) {
  return Budget.destroy({ where: { id } });
}

module.exports = { getAllBudgets, getBudgetForCategoryAndMonth, getBudgetsForMonth, upsertBudget, deleteBudget };
```

---

## Lógica de Gastos (Expense)

```js
// services/expenseService.js
const { Expense } = require('../models');
const { Op } = require('sequelize');

async function getAllExpenses() {
  return Expense.findAll({ order: [['date', 'DESC'], ['time', 'DESC']] });
}

async function getExpenseById(id) {
  return Expense.findByPk(id);
}

async function getExpensesByCategory(categoryId) {
  return Expense.findAll({ where: { categoryId }, order: [['date', 'DESC']] });
}

async function getExpensesBetweenDates(startDate, endDate) {
  return Expense.findAll({
    where: { date: { [Op.between]: [startDate, endDate] } },
    order: [['date', 'DESC'], ['time', 'DESC']],
  });
}

async function insertExpense(data) {
  return Expense.create(data);
}

async function updateExpense(id, data) {
  return Expense.update(data, { where: { id } });
}

async function deleteExpense(id) {
  return Expense.destroy({ where: { id } });
}

module.exports = { getAllExpenses, getExpenseById, getExpensesByCategory, getExpensesBetweenDates, insertExpense, updateExpense, deleteExpense };
```

---

## Lógica de Informes (Reports)

Esta es la lógica central del `ReportsViewModel.kt`, portada íntegramente a Node.js. Calcula gastos por categoría, comparación presupuesto vs. real, alertas e insights para el **mes actual**.

```js
// services/reportsService.js
const { Expense, Budget, Category } = require('../models');

/**
 * Genera el reporte completo del mes actual.
 * Equivale a processReportData() del ReportsViewModel.
 */
async function generateMonthlyReport(month = null, year = null) {
  const now    = new Date();
  const targetMonth = month ?? (now.getMonth() + 1); // JS: getMonth() es 0-indexado
  const targetYear  = year  ?? now.getFullYear();

  // Cargar datos en paralelo
  const [expenses, categories, budgets] = await Promise.all([
    Expense.findAll({ order: [['date', 'DESC']] }),
    Category.findAll(),
    Budget.findAll({ where: { month: targetMonth, year: targetYear } }),
  ]);

  // Mapa id -> categoría
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  // 1. Filtrar gastos del mes actual (formato fecha 'YYYY-MM-DD')
  const expensesThisMonth = expenses.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === targetYear && m === targetMonth;
  });

  // 2. Gastos por categoría
  const expensesPerCategory = {};
  for (const expense of expensesThisMonth) {
    const catName = categoryMap[expense.categoryId]?.name ?? 'Sin Categoría';
    expensesPerCategory[catName] = (expensesPerCategory[catName] ?? 0) + expense.amount;
  }

  // 3. Comparación Gasto vs Presupuesto
  const budgetVsActual = [];
  let totalExpenses = 0;
  let totalBudget   = 0;

  for (const category of categories) {
    const actualAmount   = expensesPerCategory[category.name] ?? 0;
    const budgetRecord   = budgets.find(b => b.categoryId === category.id);
    const budgetedAmount = budgetRecord?.amount ?? 0;

    totalExpenses += actualAmount;
    totalBudget   += budgetedAmount;

    if (budgetedAmount > 0 || actualAmount > 0) {
      budgetVsActual.push({
        categoryName:   category.name,
        budgetedAmount,
        actualAmount,
        difference:     budgetedAmount - actualAmount,
        isOverBudget:   actualAmount > budgetedAmount,
        percentUsed:    budgetedAmount > 0
          ? Math.round((actualAmount / budgetedAmount) * 100)
          : null,
      });
    }
  }

  // 4. Gastos recientes (últimos 10)
  const recentExpenses = [...expenses]
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 10);

  // 5. Alertas e insights
  const alerts   = [];
  const insights = [];

  // Alertas de categorías que superaron presupuesto
  for (const item of budgetVsActual) {
    if (item.isOverBudget && item.budgetedAmount > 0) {
      const excess = (item.actualAmount - item.budgetedAmount).toFixed(2);
      alerts.push(`Alerta: Superaste el presupuesto de '${item.categoryName}' en $${excess}.`);
    }
  }

  // Insight global
  if (totalExpenses > totalBudget && totalBudget > 0) {
    const overspendPct = Math.round(((totalExpenses - totalBudget) / totalBudget) * 100);
    insights.push(`Gastaste un ${overspendPct}% más de tu presupuesto total este mes.`);
  } else if (totalBudget > 0) {
    const savedPct = Math.round(((totalBudget - totalExpenses) / totalBudget) * 100);
    if (savedPct > 10) {
      insights.push(`¡Buen trabajo! Ahorraste un ${savedPct}% de tu presupuesto total este mes.`);
    }
  }

  // Categoría con mayor gasto
  if (Object.keys(expensesPerCategory).length > 0) {
    const topCat = Object.entries(expensesPerCategory).sort((a, b) => b[1] - a[1])[0];
    insights.push(`Tu mayor gasto este mes fue en '${topCat[0]}' con $${topCat[1].toFixed(2)}.`);
  }

  return {
    month: targetMonth,
    year:  targetYear,
    expensesPerCategory,
    budgetVsActual,
    recentExpenses,
    totalExpenses,
    totalBudget,
    alerts,
    insights,
  };
}

module.exports = { generateMonthlyReport };
```

---

## Lógica de Categorización ML (Machine Learning)

El repositorio original deja el `categoryId` como `null` al importar gastos desde correos y asume que se categoriza después. La lógica de ML para **auto-categorización** se basa en el merchant name usando un clasificador de texto simple o embeddings.

A continuación se proponen **dos niveles de implementación** para Node.js:

### Nivel 1 — Reglas + similitud de texto (sin dependencias externas)

Implementación ligera usando coincidencia de keywords por categoría. Adecuada para un MVP.

```js
// services/categorizerService.js

/**
 * Categoriza un gasto según el nombre del merchant usando reglas de keywords.
 * Retorna el categoryId que corresponde, o null si no se puede clasificar.
 *
 * @param {string} merchant  - Nombre del comercio
 * @param {Array}  categories - Array de { id, name } desde la BD
 * @returns {number|null}
 */
function categorizeByKeywords(merchant, categories) {
  if (!merchant) return null;

  // Mapa de palabras clave por nombre de categoría (personalizable)
  const KEYWORD_RULES = {
    'Alimentación':  ['supermercado', 'jumbo', 'lider', 'unimarc', 'smu', 'walmart', 'santa isabel', 'tottus', 'restaurant', 'mcdonalds', 'burger', 'pizza', 'subway', 'sodexo', 'casino', 'cafeteria'],
    'Transporte':    ['copec', 'shell', 'petrobras', 'bip', 'transantiago', 'uber', 'cabify', 'beat', 'peaje', 'autopista', 'parking', 'estacionamiento'],
    'Salud':         ['farmacia', 'cruz verde', 'salcobrand', 'ahumada', 'clinica', 'hospital', 'isapre', 'laboratorio', 'dentista', 'optica'],
    'Entretenimiento': ['netflix', 'spotify', 'amazon', 'steam', 'playstation', 'cinema', 'cine', 'feria', 'teatro', 'concert'],
    'Ropa':          ['falabella', 'ripley', 'paris', 'zara', 'h&m', 'corona', 'forus', 'la polar'],
    'Educación':     ['universidad', 'colegio', 'instituto', 'duoc', 'udp', 'uc', 'uchile', 'udla', 'curso', 'capacitación'],
    'Servicios':     ['entel', 'claro', 'movistar', 'wom', 'vtr', 'gtd', 'enel', 'aguas', 'metrogas', 'cfe'],
    'Viajes':        ['latam', 'sky', 'jetsmart', 'hotel', 'airbnb', 'booking', 'despegar'],
  };

  const merchantLower = merchant.toLowerCase();

  for (const category of categories) {
    const keywords = KEYWORD_RULES[category.name];
    if (!keywords) continue;
    if (keywords.some(kw => merchantLower.includes(kw))) {
      return category.id;
    }
  }

  return null; // No se pudo categorizar
}

/**
 * Similitud por distancia de Levenshtein entre dos strings.
 * Útil para detectar merchants con typos o variaciones menores.
 */
function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

module.exports = { categorizeByKeywords, levenshteinDistance };
```

### Nivel 2 — Modelo ML con historial de gastos (aprendizaje por ejemplos)

Usa el historial de gastos ya categorizados por el usuario como conjunto de entrenamiento para predecir la categoría de nuevos gastos.

```js
// services/mlCategorizerService.js

/**
 * Entrena un clasificador Naive Bayes simple sobre el historial de gastos.
 * Solo requiere gastos que ya tienen categoryId asignado.
 *
 * @param {Array} expenses   - [ { merchant, categoryId }, ... ]
 * @param {Array} categories - [ { id, name }, ... ]
 * @returns {Object} modelo entrenado { predict(merchant) -> categoryId|null }
 */
function trainNaiveBayes(expenses, categories) {
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  // Contadores: { [categoryId]: { [token]: count, __total: count } }
  const freq    = {};
  const catCount = {};

  for (const { merchant, categoryId } of expenses) {
    if (!merchant || !categoryId) continue;
    const tokens = tokenize(merchant);
    if (!freq[categoryId])     freq[categoryId]     = { __total: 0 };
    if (!catCount[categoryId]) catCount[categoryId] = 0;
    catCount[categoryId]++;
    for (const token of tokens) {
      freq[categoryId][token] = (freq[categoryId][token] ?? 0) + 1;
      freq[categoryId].__total++;
    }
  }

  const totalDocs  = expenses.filter(e => e.categoryId).length;
  const vocabulary = new Set(expenses.flatMap(e => tokenize(e.merchant ?? '')));
  const V          = vocabulary.size;

  function predict(merchant) {
    if (!merchant) return null;
    const tokens = tokenize(merchant);
    let bestCat   = null;
    let bestScore = -Infinity;

    for (const [catId, counts] of Object.entries(freq)) {
      const prior = Math.log((catCount[catId] ?? 1) / (totalDocs || 1));
      let likelihood = 0;
      for (const token of tokens) {
        const tokenCount = counts[token] ?? 0;
        // Suavizado de Laplace
        likelihood += Math.log((tokenCount + 1) / (counts.__total + V));
      }
      const score = prior + likelihood;
      if (score > bestScore) { bestScore = score; bestCat = Number(catId); }
    }

    return bestCat;
  }

  return { predict, categoryMap };
}

/**
 * Tokeniza un string en palabras lowercase sin stopwords comunes.
 */
function tokenize(text) {
  const stopwords = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'del', 'con', 'por', 'los', 'las', 'un', 'una', 'ltda', 's.a', 'spa']);
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñü0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopwords.has(t));
}

module.exports = { trainNaiveBayes, tokenize };
```

### Integración del ML en el flujo de importación

```js
// services/importService.js
const { trainNaiveBayes } = require('./mlCategorizerService');
const { categorizeByKeywords } = require('./categorizerService');
const expenseService = require('./expenseService');
const { Category, Expense } = require('../models');

/**
 * Categoriza automáticamente los gastos sin categoría usando:
 * 1. Reglas de keywords (rápido)
 * 2. Naive Bayes entrenado con historial (si el paso 1 falla)
 */
async function categorizePendingExpenses() {
  const [uncategorized, categorized, categories] = await Promise.all([
    Expense.findAll({ where: { categoryId: null } }),
    Expense.findAll({ where: { categoryId: { [require('sequelize').Op.ne]: null } } }),
    Category.findAll(),
  ]);

  // Entrenar modelo con historial
  const model = trainNaiveBayes(
    categorized.map(e => ({ merchant: e.merchant, categoryId: e.categoryId })),
    categories
  );

  const results = { categorized: 0, notFound: 0 };

  for (const expense of uncategorized) {
    // Paso 1: keywords
    let categoryId = categorizeByKeywords(expense.merchant, categories);

    // Paso 2: ML si keywords no encontró nada
    if (!categoryId) categoryId = model.predict(expense.merchant);

    if (categoryId) {
      await expense.update({ categoryId });
      results.categorized++;
    } else {
      results.notFound++;
    }
  }

  return results;
}

module.exports = { categorizePendingExpenses };
```

---

## Parseo de Correos Bancarios (GmailSyncWorker equivalente)

La lógica del `GmailSyncWorker.kt` parsea el HTML del correo de notificación del banco (BCI en el ejemplo) para extraer el gasto. En Node.js se usa `cheerio` (equivalente a Jsoup).

```js
// services/emailParserService.js
const cheerio = require('cheerio'); // npm install cheerio

/**
 * Parsea el body HTML de un correo de notificación bancaria (BCI como ejemplo)
 * y retorna los datos del gasto, o null si no se puede parsear.
 *
 * NOTA: Los selectores CSS deben ajustarse al HTML real del banco.
 *
 * @param {Object} emailData - { id, subject, date, bodyHtml, bodyText }
 * @returns {Object|null}
 */
function parseExpenseFromEmail(emailData) {
  const body = emailData.bodyHtml || emailData.bodyText;
  if (!body) return null;

  try {
    const $ = cheerio.load(body);

    // SELECTORES PLACEHOLDER — ajustar al HTML real del correo bancario
    const amountRaw  = $('td:contains("Monto:")').next().first().text().trim();
    const merchant   = $('td:contains("Comercio:")').next().first().text().trim();
    const dateTime   = $('td:contains("Fecha y Hora:")').next().first().text().trim(); // 'DD/MM/YYYY HH:MM'
    const last4Raw   = $('td:contains("Tarjeta:")').next().first().text().trim();
    const quotasRaw  = $('td:contains("Cuotas:")').next().first().text().trim();

    if (!amountRaw || !merchant || !dateTime) return null;

    // Parsear monto (formato chileno: $1.234,56 → 1234.56)
    const amount = parseFloat(amountRaw.replace(/[^0-9,]/g, '').replace(',', '.'));
    if (isNaN(amount)) return null;

    // Parsear fecha 'DD/MM/YYYY HH:MM'
    const [datePart, timePart] = dateTime.split(' ');
    const [day, month, year]   = (datePart || '').split('/');
    const transactionDate = year && month && day
      ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      : null;

    // Parsear cuotas
    const installments = quotasRaw && !['−', '-', '0', 'Sin Cuotas'].includes(quotasRaw)
      ? parseInt(quotasRaw, 10) || null
      : null;

    // Últimos 4 dígitos tarjeta
    const lastCardDigits = last4Raw ? last4Raw.replace(/\D/g, '').slice(-4) || null : null;

    return {
      amount,
      date:          transactionDate || new Date().toISOString().slice(0, 10),
      time:          timePart || '00:00',
      merchant,
      categoryId:    null,   // Se categoriza después con el ML
      installments,
      lastCardDigits,
      description:   `Importado: ${(emailData.subject || '').slice(0, 50)}`,
    };

  } catch (err) {
    console.error(`Error parseando correo ${emailData.id}:`, err.message);
    return null;
  }
}

module.exports = { parseExpenseFromEmail };
```

---

## Estructura de Carpetas Recomendada para Node.js

```
src/
├── models/
│   ├── Category.js
│   ├── Budget.js
│   ├── Expense.js
│   └── index.js          ← inicializa Sequelize y asociaciones
├── services/
│   ├── budgetService.js       ← CRUD + filtros de presupuestos
│   ├── expenseService.js      ← CRUD + filtros de gastos
│   ├── reportsService.js      ← generateMonthlyReport()
│   ├── categorizerService.js  ← reglas de keywords
│   ├── mlCategorizerService.js ← Naive Bayes sobre historial
│   ├── importService.js       ← categorizePendingExpenses()
│   └── emailParserService.js  ← parseExpenseFromEmail()
├── routes/
│   ├── budgets.js
│   ├── expenses.js
│   └── reports.js
└── app.js
```

---

## Dependencias NPM Necesarias

| Paquete | Uso |
|---------|-----|
| `sequelize` | ORM para MySQL/PostgreSQL/SQLite |
| `mysql2` o `pg` | Driver de base de datos |
| `cheerio` | Parseo HTML de correos (equivalente a Jsoup) |
| `googleapis` | Cliente oficial Google para Gmail API |
| `node-cron` | Scheduling de sincronización (equivalente a WorkManager) |

```bash
npm install sequelize mysql2 cheerio googleapis node-cron
```

---

## Ejemplo de Endpoint Express para el Reporte

```js
// routes/reports.js
const express = require('express');
const router  = express.Router();
const { generateMonthlyReport } = require('../services/reportsService');

// GET /api/reports/monthly?month=5&year=2026
router.get('/monthly', async (req, res) => {
  try {
    const month = req.query.month ? parseInt(req.query.month) : null;
    const year  = req.query.year  ? parseInt(req.query.year)  : null;
    const report = await generateMonthlyReport(month, year);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

