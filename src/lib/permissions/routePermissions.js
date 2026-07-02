/**
 * routePermissions.js — DUY NHẤT nơi ánh xạ tab/page id (điều hướng hiện có
 * của ANC-CFAM: BusinessModule 'tab' + App.jsx 'page') → permission yêu cầu
 * để truy cập. Sidebar Guard và Route Guard (AppRoute) đều đọc từ đây — không
 * định nghĩa lại permission ở Sidebar.jsx/BusinessModule.jsx/App.jsx.
 */

import { PERMISSIONS } from './permissionConstants'

const {
  DASHBOARD_VIEW, POS_VIEW, INVENTORY_VIEW, STOCKTAKE_VIEW,
  ORDER_VIEW, CRM_VIEW, CHANNEL_VIEW, CASHBOOK_VIEW, REPORT_VIEW,
  HRM_VIEW, USER_VIEW, SYSTEM_SETTING, SYSTEM_ACTIVITYLOG, SYSTEM_DATA_ADMIN,
} = PERMISSIONS

export const ROUTE_PERMISSIONS = Object.freeze({
  // ── Business tabs (BusinessModule.jsx) ────────────────────────────────
  analytics:   DASHBOARD_VIEW,
  pos:         POS_VIEW,
  products:    INVENTORY_VIEW,
  customers:   CRM_VIEW,
  suppliers:   CRM_VIEW,
  channels:    CHANNEL_VIEW,
  cashbook:    CASHBOOK_VIEW,
  orders:      ORDER_VIEW,
  stocktake:   STOCKTAKE_VIEW,
  report:      REPORT_VIEW,
  hrm:         HRM_VIEW,
  users:       USER_VIEW,
  activitylog: SYSTEM_ACTIVITYLOG,
  settings:    SYSTEM_SETTING,
  admin:       SYSTEM_DATA_ADMIN,

  // ── Top-level pages (App.jsx — module Quản Trị Dòng Tiền) ─────────────
  dashboard:   REPORT_VIEW,
  assumptions: SYSTEM_SETTING,
  quarterly:   REPORT_VIEW,
  annual:      REPORT_VIEW,
  monthly:     CASHBOOK_VIEW,
  portfolio:   REPORT_VIEW,
  creditcards: CASHBOOK_VIEW,
  config:      SYSTEM_SETTING,
})

/** Trả về permission yêu cầu cho 1 id — không có trong map = coi như public (không khoá). */
export function getRoutePermission(id) {
  return ROUTE_PERMISSIONS[id]
}
