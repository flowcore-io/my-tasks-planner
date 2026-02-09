import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, options, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2 rounded-lg border',
            'border-gray-300 dark:border-gray-500',
            'bg-white dark:bg-gray-700',
            'text-gray-900 dark:text-gray-50',
            'focus:border-primary-500 dark:focus:border-primary-400',
            'focus:ring-2 focus:ring-primary-500/20',
            'focus:outline-none transition-colors',
            className
          )}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }
)
Select.displayName = 'Select'
