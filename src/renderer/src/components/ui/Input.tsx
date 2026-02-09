import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2 rounded-lg border',
            'border-gray-300 dark:border-gray-500',
            'bg-white dark:bg-gray-700',
            'text-gray-900 dark:text-gray-50',
            'placeholder:text-gray-400 dark:placeholder:text-gray-400',
            'focus:border-primary-500 dark:focus:border-primary-400',
            'focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20',
            'focus:outline-none transition-colors',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = 'Input'
