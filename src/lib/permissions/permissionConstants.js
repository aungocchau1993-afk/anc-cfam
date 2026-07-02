/**
 * permissionConstants.js — DUY NHẤT nơi định nghĩa chuỗi permission của toàn
 * ANC-CFAM. Không ai được viết permission string rải rác trong component —
 * luôn import từ đây (import { PERMISSIONS } from '.../permissionConstants').
 *
 * Định dạng: "domain.action" — action chuẩn hoá: view/create/update/delete/
 * import/export/approve (không phải domain nào cũng có đủ 7 action).
 */

export const PERMISSIONS = Object.freeze({
  // ── Dashboard / Tổng quan ─────────────────────────────────────────────
  DASHBOARD_VIEW: 'dashboard.view',

  // ── POS / Bán hàng ────────────────────────────────────────────────────
  POS_VIEW:    'pos.view',
  POS_SELL:    'pos.sell',
  POS_REFUND:  'pos.refund',

  // ── Inventory / Hàng hoá + Kiểm kho ───────────────────────────────────
  INVENTORY_VIEW:       'inventory.view',
  INVENTORY_CREATE:     'inventory.create',
  INVENTORY_UPDATE:     'inventory.update',
  INVENTORY_DELETE:     'inventory.delete',
  INVENTORY_IMPORT:     'inventory.import',
  INVENTORY_EXPORT:     'inventory.export',
  INVENTORY_VIEW_COST:  'inventory.view_cost',   // Giá vốn — riêng theo yêu cầu spec
  STOCKTAKE_VIEW:       'stocktake.view',
  STOCKTAKE_CREATE:     'stocktake.create',
  STOCKTAKE_COMPLETE:   'stocktake.complete',

  // ── Order / Đơn hàng ──────────────────────────────────────────────────
  ORDER_VIEW:    'order.view',
  ORDER_CREATE:  'order.create',
  ORDER_UPDATE:  'order.update',
  ORDER_DELETE:  'order.delete',
  ORDER_CANCEL:  'order.cancel',
  ORDER_APPROVE: 'order.approve',
  ORDER_RETURN:  'order.return',
  ORDER_EXPORT:  'order.export',

  // ── CRM / Khách hàng + Nhà cung cấp + Đa kênh ─────────────────────────
  CRM_VIEW:    'crm.view',
  CRM_CREATE:  'crm.create',
  CRM_UPDATE:  'crm.update',
  CRM_DELETE:  'crm.delete',
  CRM_EXPORT:  'crm.export',
  CHANNEL_VIEW:   'channel.view',
  CHANNEL_UPDATE: 'channel.update',

  // ── Cashbook / Sổ quỹ ─────────────────────────────────────────────────
  CASHBOOK_VIEW:   'cashbook.view',
  CASHBOOK_CREATE: 'cashbook.create',
  CASHBOOK_DELETE: 'cashbook.delete',

  // ── Report / Báo cáo ──────────────────────────────────────────────────
  REPORT_VIEW:   'report.view',
  REPORT_EXPORT: 'report.export',

  // ── HRM / Nhân sự ─────────────────────────────────────────────────────
  HRM_VIEW:   'hrm.view',
  HRM_UPDATE: 'hrm.update',

  // ── User Management / Người dùng ─────────────────────────────────────
  USER_VIEW:   'user.view',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  // ── System / Hệ thống ─────────────────────────────────────────────────
  SYSTEM_SETTING:     'system.setting',
  SYSTEM_ACTIVITYLOG: 'system.activitylog',
  SYSTEM_DATA_ADMIN:  'system.data_admin',   // trang "Xoá Dữ Liệu"

  // ── Developer ─────────────────────────────────────────────────────────
  DEVELOPER_VIEW: 'developer.view',
})

/** Mảng phẳng tất cả permission — dùng cho SUPER_ADMIN/DEVELOPER (full quyền). */
export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS))
