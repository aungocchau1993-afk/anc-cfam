import CustomerPanel from './CustomerPanel'
import CartPanel from './CartPanel'

// Nội dung mặc định của cột Bill trong chế độ "Bán hàng nhanh": chỉ Khách hàng
// + Giỏ hàng — không có trường giao hàng/VAT/nhân viên/kênh bán (Order Mode).
export default function SaleModePanel({
  customers, customer, onSelectCustomer, onAddCustomer, onOpenRedeem,
  cart, cartCount, onQty, onRemove, onPriceEdit, onClearCart,
}) {
  return (
    <>
      <CustomerPanel
        customers={customers}
        customer={customer}
        onSelect={onSelectCustomer}
        onAddNew={onAddCustomer}
        onOpenRedeem={onOpenRedeem}
      />
      <CartPanel
        cart={cart}
        cartCount={cartCount}
        onQty={onQty}
        onRemove={onRemove}
        onPriceEdit={onPriceEdit}
        onClear={onClearCart}
      />
    </>
  )
}
