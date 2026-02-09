import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    danger: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
