// Gộp className có điều kiện — thay thế clsx tối giản, không thêm dependency.
export function cn(...args) {
  return args.filter(Boolean).join(' ')
}
