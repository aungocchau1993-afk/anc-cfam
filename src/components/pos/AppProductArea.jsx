import { AnimatePresence, motion } from 'framer-motion'
import OrderTabs from './OrderTabs'
import SearchBar from './SearchBar'
import FilterBar from './FilterBar'
import ViewSwitcher from './ViewSwitcher'
import ProductGridView from './ProductGridView'
import ProductListView from './ProductListView'
import ProductCompactView from './ProductCompactView'

const VIEWS = {
  grid:    ProductGridView,
  list:    ProductListView,
  compact: ProductCompactView,
}

// Cột trái (Product Area) — danh mục sản phẩm. Không đổi theo Sale/Order Mode,
// chỉ đổi theo View Mode (grid/list/compact) do ViewSwitcher điều khiển.
export default function AppProductArea({
  tabs, activeTabId, onSelectTab, onAddTab, onCloseTab,
  search, onSearchChange, searchWrapRef, dropdownOpen, onFocusSearch,
  dropdownResults, cart, onPickResult, onScanOcr, onShowHistory,
  totalCount, filteredCount, onClearSearch,
  viewMode, onViewModeChange,
  loading, products, onAdd,
}) {
  const ActiveView = VIEWS[viewMode] || ProductGridView

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white rounded-2xl border border-slate-800 shadow-sm overflow-hidden transition-all duration-200">

      <OrderTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={onSelectTab}
        onAdd={onAddTab}
        onClose={onCloseTab}
      />

      <SearchBar
        search={search}
        onSearchChange={onSearchChange}
        searchWrapRef={searchWrapRef}
        dropdownOpen={dropdownOpen}
        onFocus={onFocusSearch}
        dropdownResults={dropdownResults}
        cart={cart}
        onPickResult={onPickResult}
        onScanOcr={onScanOcr}
        onShowHistory={onShowHistory}
        totalCount={totalCount}
        filteredCount={filteredCount}
        onClearSearch={onClearSearch}
      />

      <FilterBar right={<ViewSwitcher mode={viewMode} onChange={onViewModeChange} />} />

      <div className="overflow-y-auto px-6 pb-6 max-h-[50vh] md:max-h-none md:flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <ActiveView loading={loading} products={products} cart={cart} search={search} onAdd={onAdd} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
