export function getQuarterlyYield(yearlyPct) {
  return Math.pow(1 + yearlyPct / 100, 1 / 4) - 1
}

export function computeQuarters(assumptions) {
  const a = assumptions
  const qy = getQuarterlyYield(a.investYieldPerYear)
  const quarters = []
  let cash = a.initialCash
  let debt = a.bankDebt
  let portfolio = 0

  for (let q = 0; q < a.numQuarters; q++) {
    const yi = Math.floor(q / 4)
    const profitGrowth  = Math.pow(1 + a.profitGrowthPerYear / 100, yi)
    const expenseGrowth = Math.pow(1 + a.expenseInflation / 100, yi)
    const profit   = a.monthlyProfit * 3 * profitGrowth
    const living   = a.monthlyLiving * 3 * expenseGrowth
    const housing  = a.monthlyHousing * 3 * expenseGrowth
    const interest = debt * (a.bankRate / 100) / 4
    const repay    = Math.min(a.debtRepayPerQuarter, debt)
    const netCF    = profit - living - housing - interest - repay
    const available = cash + netCF - a.minCashReserve
    const invest    = Math.max(0, available * (a.investRatio / 100))
    const closingCash = cash + netCF - invest
    portfolio = portfolio * (1 + qy) + invest
    debt = Math.max(0, debt - repay)

    quarters.push({
      q: q + 1,
      year: a.startYear + yi,
      yearIdx: yi,
      openingCash: cash,
      profit, living, housing, interest, repay, netCF,
      invest, closingCash, portfolio, debt,
      totalAssets: closingCash + portfolio,
    })
    cash = closingCash
  }
  return quarters
}

export function computeAnnual(quarters) {
  const byYear = {}
  for (const q of quarters) {
    if (!byYear[q.year]) byYear[q.year] = { profit:0, living:0, housing:0, interest:0, repay:0, netCF:0, invest:0 }
    byYear[q.year].profit   += q.profit
    byYear[q.year].living   += q.living
    byYear[q.year].housing  += q.housing
    byYear[q.year].interest += q.interest
    byYear[q.year].repay    += q.repay
    byYear[q.year].netCF    += q.netCF
    byYear[q.year].invest   += q.invest
  }
  return Object.entries(byYear).map(([year, d]) => {
    const lastQ = quarters.filter(q => q.year == year).at(-1)
    return { year: Number(year), ...d, endCash: lastQ.closingCash, endDebt: lastQ.debt, endPortfolio: lastQ.portfolio, totalAssets: lastQ.totalAssets }
  })
}

export function computeMonthly(monthData, assumptions, alloc) {
  const a = assumptions
  const rows = []
  let cash = a.initialCash

  for (let y = 0; y < 5; y++) {
    const yr = a.startYear + y
    const yData = monthData[yr] || Array.from({ length: 12 }, () => ({ income:0, living:0, housing:0, debtRepay:0 }))
    for (let mi = 0; mi < 12; mi++) {
      const m = yData[mi] || {}
      const surplus = (m.income||0) - (m.living||0) - (m.housing||0) - (m.debtRepay||0)
      const invest  = Math.max(0, surplus * (a.investRatio / 100))
      const cashAmt = invest * (alloc.cash||0) / 100
      cash += surplus - invest + cashAmt
      rows.push({ year: yr, month: mi + 1, surplus, invest, cumCash: cash })
    }
  }
  return rows
}

export function computePortfolioSignals(portfolioValues, alloc, deviationThreshold) {
  const total = Object.values(portfolioValues).reduce((s, v) => s + v, 0)
  return Object.keys(portfolioValues).map(key => {
    const actual    = total > 0 ? portfolioValues[key] / total * 100 : 0
    const target    = alloc[key] || 0
    const diff      = actual - target
    const signal    = diff > deviationThreshold ? 'GIẢM' : diff < -deviationThreshold ? 'TĂNG' : 'OK'
    const adjustAmt = (target / 100 - actual / 100) * total
    return { key, actual, target, diff, signal, adjustAmt, value: portfolioValues[key] }
  })
}
