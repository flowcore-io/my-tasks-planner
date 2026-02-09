import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/Button'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const labels = { light: 'Light', dark: 'Dark', system: 'System' }
  const icons = { light: <Sun size={14} />, dark: <Moon size={14} />, system: <Monitor size={14} /> }

  return (
    <Button variant="ghost" size="sm" onClick={() => setTheme(next)} className="text-xs w-full justify-start gap-2">
      {icons[theme]} {labels[theme]}
    </Button>
  )
}
