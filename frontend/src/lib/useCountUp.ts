import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (target === from) return
    const start = Date.now()
    const timer = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * ease)
      if (t >= 1) clearInterval(timer)
    }, 16)
    return () => {
      clearInterval(timer)
      fromRef.current = target
      setValue(target)
    }
  }, [target, duration])

  return value
}
