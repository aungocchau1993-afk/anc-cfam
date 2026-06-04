import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { DEFAULT_ASSUMPTIONS, ALLOCATIONS } from '../lib/constants'
import {
  loadAssumptions,
  loadMonthlyData,
  loadPortfolioHoldings,
  loadRiskConfig,
  saveAssumptions,
  saveMonthRow,
  insertHolding,
  deleteHolding,
  saveRiskConfig,
  loadCreditCards,
  insertCreditCard,
  updateCreditCard,
  deleteCreditCard,
  isSupabaseConfigured,
} from '../lib/supabase'

function makeMonthRows() {
  return Array.from({ length: 12 }, () => ({
    income:0, incomeKd:0, incomeTmdt:0, incomeAff:0,
    living:0, housing:0, debtRepay:0,
  }))
}

function makeMonthData(year = DEFAULT_ASSUMPTIONS.startYear) {
  return { [year]: makeMonthRows() }
}

function computePortfolioValues(portfolioDetails) {
  return Object.entries(portfolioDetails).reduce((values, [category, items]) => {
    values[category] = (items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    return values
  }, { stocks:0, realestate:0, gold:0, crypto:0, cash:0 })
}

const defaultState = {
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  monthData: makeMonthData(),
  portfolioValues: { stocks:0, realestate:0, gold:0, crypto:0, cash:0 },
  portfolioDetails: { stocks:[], realestate:[], gold:[], crypto:[], cash:[] },
  riskProfile: 'Cân bằng',
  customAllocation: { stocks:35, realestate:25, gold:10, crypto:10, cash:20 },
  deviationThreshold: 5,
  creditCards: [],
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload }

    case 'SET_ASSUMPTION':
      return { ...state, assumptions: { ...state.assumptions, [action.key]: action.value } }

    case 'SET_MONTH': {
      const { year, mi, key, value } = action
      const yData = [...(state.monthData[year] || makeMonthRows())]
      yData[mi] = { ...yData[mi], [key]: value }
      return { ...state, monthData: { ...state.monthData, [year]: yData } }
    }

    case 'ADD_YEAR': {
      if (!action.year || state.monthData[action.year]) return state
      return { ...state, monthData: { ...state.monthData, [action.year]: makeMonthRows() } }
    }

    case 'SET_PORTFOLIO_VALUE':
      return { ...state, portfolioValues: { ...state.portfolioValues, [action.key]: action.value } }

    case 'ADD_HOLDING': {
      const items = [...(state.portfolioDetails[action.category] || []), action.item]
      const total = items.reduce((s, h) => s + (Number(h.amount) || 0), 0)
      return {
        ...state,
        portfolioDetails: { ...state.portfolioDetails, [action.category]: items },
        portfolioValues: { ...state.portfolioValues, [action.category]: total },
      }
    }

    case 'REMOVE_HOLDING': {
      const items = (state.portfolioDetails[action.category] || []).filter(h => h.id !== action.id)
      const total = items.reduce((s, h) => s + (Number(h.amount) || 0), 0)
      return {
        ...state,
        portfolioDetails: { ...state.portfolioDetails, [action.category]: items },
        portfolioValues: { ...state.portfolioValues, [action.category]: total },
      }
    }

    case 'SET_RISK_PROFILE':
      return { ...state, riskProfile: action.value }

    case 'SET_CUSTOM_ALLOC':
      return { ...state, customAllocation: { ...state.customAllocation, [action.key]: action.value } }

    case 'SET_DEVIATION':
      return { ...state, deviationThreshold: action.value }

    case 'LOAD_CREDIT_CARDS':
      return { ...state, creditCards: action.payload }

    case 'ADD_CREDIT_CARD':
      return { ...state, creditCards: [...state.creditCards, action.card] }

    case 'UPDATE_CREDIT_CARD':
      return {
        ...state,
        creditCards: state.creditCards.map(c => c.id === action.id ? { ...c, ...action.patch } : c),
      }

    case 'REMOVE_CREDIT_CARD':
      return { ...state, creditCards: state.creditCards.filter(c => c.id !== action.id) }

    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false

    async function loadRemoteState() {
      try {
        const [remoteAssumptions, remoteMonthData, remotePortfolioDetails, remoteRiskConfig, remoteCreditCards] = await Promise.all([
          loadAssumptions(),
          loadMonthlyData(),
          loadPortfolioHoldings(),
          loadRiskConfig(),
          loadCreditCards(),
        ])

        if (cancelled) return

        const assumptions = remoteAssumptions
          ? { ...defaultState.assumptions, ...remoteAssumptions }
          : defaultState.assumptions

        const monthData = remoteMonthData && Object.keys(remoteMonthData).length
          ? remoteMonthData
          : makeMonthData(assumptions.startYear)

        const payload = { assumptions, monthData }

        if (remotePortfolioDetails) {
          const portfolioDetails = { ...defaultState.portfolioDetails, ...remotePortfolioDetails }
          payload.portfolioDetails = portfolioDetails
          payload.portfolioValues = computePortfolioValues(portfolioDetails)
        }

        if (remoteRiskConfig) {
          if (remoteRiskConfig.riskProfile !== undefined) payload.riskProfile = remoteRiskConfig.riskProfile
          if (remoteRiskConfig.deviationThreshold !== undefined) payload.deviationThreshold = remoteRiskConfig.deviationThreshold
          if (remoteRiskConfig.customAllocation) {
            payload.customAllocation = { ...defaultState.customAllocation, ...remoteRiskConfig.customAllocation }
          }
        }

        if (Array.isArray(remoteCreditCards) && remoteCreditCards.length) {
          payload.creditCards = remoteCreditCards
        }

        dispatch({ type:'LOAD', payload })
      } catch (error) {
        console.error('Failed to load Supabase state', error)
      }
    }

    loadRemoteState()

    return () => { cancelled = true }
  }, [])

  const getAlloc = useCallback(() => {
    if (state.riskProfile === 'Tùy chỉnh') return state.customAllocation
    return ALLOCATIONS[state.riskProfile] || ALLOCATIONS['Cân bằng']
  }, [state.riskProfile, state.customAllocation])

  const actions = {
    setAssumption: (key, value) => {
      const assumptions = { ...state.assumptions, [key]: value }
      dispatch({ type:'SET_ASSUMPTION', key, value })
      if (isSupabaseConfigured) saveAssumptions(assumptions).catch(error => console.error('Failed to save assumptions', error))
    },

    setMonth: async (year, mi, key, value) => {
      dispatch({ type:'SET_MONTH', year, mi, key, value })

      const SUB_INCOME_KEYS = ['incomeKd', 'incomeTmdt', 'incomeAff']
      const yData  = state.monthData[year] || []
      const curRow = { ...(yData[mi] || {}), [key]: value }

      // Nếu là sub-income → tự cộng lại tổng income
      if (SUB_INCOME_KEYS.includes(key)) {
        const total = (curRow.incomeKd||0) + (curRow.incomeTmdt||0) + (curRow.incomeAff||0)
        dispatch({ type:'SET_MONTH', year, mi, key:'income', value: total })
        curRow.income = total
      }

      if (isSupabaseConfigured) {
        const { error } = await saveMonthRow(year, mi, curRow)
        if (error) throw new Error(error.message || 'Lỗi Supabase')
      }
    },

    addYear: year => {
      dispatch({ type:'ADD_YEAR', year })
      if (isSupabaseConfigured && year) {
        Promise.all(makeMonthRows().map((row, mi) => saveMonthRow(year, mi, row)))
          .catch(error => console.error('Failed to save year rows', error))
      }
    },

    addHolding: async (category, item) => {
      const saved = isSupabaseConfigured ? await insertHolding(category, item) : { ...item, id: Date.now() }
      dispatch({ type:'ADD_HOLDING', category, item: saved || { ...item, id: Date.now() } })
    },

    removeHolding: async (category, id) => {
      if (isSupabaseConfigured) await deleteHolding(id)
      dispatch({ type:'REMOVE_HOLDING', category, id })
    },

    setRiskProfile: value => {
      dispatch({ type:'SET_RISK_PROFILE', value })
      if (isSupabaseConfigured) saveRiskConfig({ riskProfile: value }).catch(error => console.error('Failed to save risk profile', error))
    },

    setCustomAlloc: (key, value) => {
      const customAllocation = { ...state.customAllocation, [key]: value }
      dispatch({ type:'SET_CUSTOM_ALLOC', key, value })
      if (isSupabaseConfigured) saveRiskConfig({ customAllocation }).catch(error => console.error('Failed to save custom allocation', error))
    },

    setDeviation: value => {
      dispatch({ type:'SET_DEVIATION', value })
      if (isSupabaseConfigured) saveRiskConfig({ deviationThreshold: value }).catch(error => console.error('Failed to save deviation threshold', error))
    },

    addCreditCard: async (card) => {
      const saved = await insertCreditCard(card)
      dispatch({ type:'ADD_CREDIT_CARD', card: saved })
      return saved
    },

    updateCreditCard: async (id, patch) => {
      await updateCreditCard(id, patch)
      dispatch({ type:'UPDATE_CREDIT_CARD', id, patch })
    },

    removeCreditCard: async (id) => {
      await deleteCreditCard(id)
      dispatch({ type:'REMOVE_CREDIT_CARD', id })
    },
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions, getAlloc }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
