import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const isSupabaseConfigured = url.startsWith('https://') && key.length > 10

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null

const ASSUMPTION_FIELDS = {
  initialCash: 'initial_cash',
  startYear: 'start_year',
  numQuarters: 'num_quarters',
  monthlyProfit: 'monthly_profit',
  profitGrowthPerYear: 'profit_growth_per_year',
  monthlyLiving: 'monthly_living',
  monthlyHousing: 'monthly_housing',
  expenseInflation: 'expense_inflation',
  bankDebt: 'bank_debt',
  bankRate: 'bank_rate',
  debtRepayPerQuarter: 'debt_repay_per_quarter',
  investRatio: 'invest_ratio',
  investYieldPerYear: 'invest_yield_per_year',
  minCashReserve: 'min_cash_reserve',
}

const RISK_FIELDS = {
  riskProfile: 'risk_profile',
  deviationThreshold: 'deviation_threshold',
}

const CUSTOM_ALLOC_FIELDS = {
  stocks: 'custom_stocks',
  realestate: 'custom_realestate',
  gold: 'custom_gold',
  crypto: 'custom_crypto',
  cash: 'custom_cash',
}

function toSnakeRow(camelData, fieldMap) {
  return Object.entries(fieldMap).reduce((row, [camelKey, snakeKey]) => {
    if (camelData?.[camelKey] !== undefined) row[snakeKey] = camelData[camelKey]
    return row
  }, {})
}

function toCamelRow(snakeData, fieldMap) {
  return Object.entries(fieldMap).reduce((row, [camelKey, snakeKey]) => {
    if (snakeData?.[snakeKey] !== undefined && snakeData?.[snakeKey] !== null) row[camelKey] = snakeData[snakeKey]
    return row
  }, {})
}

function assumptionsToSnake(assumptions) {
  return toSnakeRow(assumptions, ASSUMPTION_FIELDS)
}

function assumptionsToCamel(row) {
  if (!row) return null
  return toCamelRow(row, ASSUMPTION_FIELDS)
}

function riskConfigToSnake(config) {
  const row = toSnakeRow(config, RISK_FIELDS)
  if (config?.customAllocation) {
    Object.assign(row, toSnakeRow(config.customAllocation, CUSTOM_ALLOC_FIELDS))
  }
  return row
}

function riskConfigToCamel(row) {
  if (!row) return null
  const base = toCamelRow(row, RISK_FIELDS)
  const customAllocation = toCamelRow(row, CUSTOM_ALLOC_FIELDS)
  return Object.keys(customAllocation).length
    ? { ...base, customAllocation }
    : base
}

export async function loadAssumptions() {
  if (!supabase) return null
  const { data, error } = await supabase.from('assumptions').select('*').limit(1).maybeSingle()
  if (error) throw error
  return assumptionsToCamel(data)
}

export async function saveAssumptions(assumptions) {
  if (!supabase) return
  const { error } = await supabase.from('assumptions').upsert({
    id: 1,
    ...assumptionsToSnake(assumptions),
    updated_at: new Date(),
  })
  if (error) throw error
}

export async function loadMonthlyData() {
  if (!supabase) return null
  const { data, error } = await supabase.from('monthly_data').select('*')
  if (error) throw error
  if (!data) return null

  const result = {}
  for (const row of data) {
    if (!result[row.year]) {
      result[row.year] = Array(12).fill(null).map(() => ({
        income:0, incomeKd:0, incomeTmdt:0, incomeAff:0,
        living:0, housing:0, debtRepay:0,
      }))
    }
    const incomeKd   = row.income_kd   ?? 0
    const incomeTmdt = row.income_tmdt ?? 0
    const incomeAff  = row.income_aff  ?? 0
    // income = sum của sub nếu sub > 0, fallback về cột income cũ
    const subTotal = incomeKd + incomeTmdt + incomeAff
    result[row.year][row.month_index] = {
      income:     subTotal > 0 ? subTotal : (row.income ?? 0),
      incomeKd,
      incomeTmdt,
      incomeAff,
      living:     row.living    ?? 0,
      housing:    row.housing   ?? 0,
      debtRepay:  row.debt_repay ?? 0,
    }
  }
  return result
}

export async function saveMonthRow(year, monthIndex, data) {
  if (!supabase) return { error: null }
  const incomeKd   = data.incomeKd   ?? 0
  const incomeTmdt = data.incomeTmdt ?? 0
  const incomeAff  = data.incomeAff  ?? 0
  const subTotal   = incomeKd + incomeTmdt + incomeAff
  const income     = subTotal > 0 ? subTotal : (data.income ?? 0)
  const { error } = await supabase.from('monthly_data').upsert({
    year,
    month_index:   monthIndex,
    income,
    income_kd:     incomeKd,
    income_tmdt:   incomeTmdt,
    income_aff:    incomeAff,
    living:        data.living    ?? 0,
    housing:       data.housing   ?? 0,
    debt_repay:    data.debtRepay ?? 0,
    updated_at:    new Date(),
  }, { onConflict: 'year,month_index' })
  return { error }
}

export async function loadPortfolioHoldings() {
  if (!supabase) return null
  const { data, error } = await supabase.from('portfolio_holdings').select('*').order('created_at')
  if (error) throw error
  if (!data) return null

  const result = { stocks:[], realestate:[], gold:[], crypto:[], cash:[] }
  for (const row of data) {
    if (result[row.category]) result[row.category].push({ id: row.id, ...row })
  }
  return result
}

export async function insertHolding(category, item) {
  if (!supabase) return item
  const { data, error } = await supabase.from('portfolio_holdings').insert({ category, ...item }).select().single()
  if (error) throw error
  return data
}

export async function deleteHolding(id) {
  if (!supabase) return
  const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id)
  if (error) throw error
}

export async function loadRiskConfig() {
  if (!supabase) return null
  const { data, error } = await supabase.from('risk_config').select('*').limit(1).maybeSingle()
  if (error) throw error
  return riskConfigToCamel(data)
}

export async function saveRiskConfig(config) {
  if (!supabase) return
  const { error } = await supabase.from('risk_config').upsert({
    id: 1,
    ...riskConfigToSnake(config),
    updated_at: new Date(),
  })
  if (error) throw error
}

// ── Credit Cards ───────────────────────────────────────────────────────────

function ccToSnake(card) {
  return {
    bank_name:          card.bankName,
    card_holder:        card.cardHolder,
    card_number_last4:  card.cardNumberLast4,
    credit_limit:       card.creditLimit ?? 0,
    used_amount:        card.usedAmount ?? 0,
    statement_date:     card.statementDate,
    due_date:           card.dueDate,
  }
}

function ccToCamel(row) {
  if (!row) return null
  return {
    id:               row.id,
    userId:           row.user_id,
    bankName:         row.bank_name,
    cardHolder:       row.card_holder,
    cardNumberLast4:  row.card_number_last4,
    creditLimit:      row.credit_limit,
    usedAmount:       row.used_amount,
    statementDate:    row.statement_date,
    dueDate:          row.due_date,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

export async function loadCreditCards() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .order('created_at')
  if (error) throw error
  return (data || []).map(ccToCamel)
}

export async function insertCreditCard(card) {
  if (!supabase) return { ...card, id: crypto.randomUUID() }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({ user_id: user.id, ...ccToSnake(card) })
    .select()
    .single()
  if (error) throw error
  return ccToCamel(data)
}

export async function updateCreditCard(id, patch) {
  if (!supabase) return
  const { error } = await supabase
    .from('credit_cards')
    .update(ccToSnake(patch))
    .eq('id', id)
  if (error) throw error
}

export async function deleteCreditCard(id) {
  if (!supabase) return
  const { error } = await supabase
    .from('credit_cards')
    .delete()
    .eq('id', id)
  if (error) throw error
}
