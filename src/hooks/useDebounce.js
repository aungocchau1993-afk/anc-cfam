import { useState, useEffect } from 'react'

/**
 * Trả về giá trị debounced — chỉ cập nhật sau khi `value` ngừng thay đổi
 * trong `delay` milliseconds.
 *
 * @param {*}      value  Giá trị cần debounce (string, number, …)
 * @param {number} delay  Thời gian trễ (ms), mặc định 300
 * @returns debouncedValue
 *
 * Cách dùng:
 *   const debouncedSearch = useDebounce(search, 400)
 *   useEffect(() => { fetchData(debouncedSearch) }, [debouncedSearch])
 */
export default function useDebounce(value, delay = 300) {
  // Khởi tạo bằng chính value → lần đầu render KHÔNG có delay
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    // Cleanup: huỷ timer cũ mỗi khi value thay đổi trước khi hết delay
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
