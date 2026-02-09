import { useState, useEffect } from 'react'

export function useApiReady() {
  const [isReady, setIsReady] = useState(() => !!window.api)

  useEffect(() => {
    if (isReady) return
    const interval = setInterval(() => {
      if (window.api) {
        setIsReady(true)
        clearInterval(interval)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [isReady])

  return isReady
}
