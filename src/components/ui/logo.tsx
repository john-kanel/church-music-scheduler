import Image from 'next/image'

// Simple className utility function
function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showText?: boolean
  textClassName?: string
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8', 
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
  '2xl': 'h-16 w-16'
}

export function Logo({ 
  className, 
  size = 'md', 
  showText = true, 
  textClassName 
}: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/logo.png"
        alt="Church Music Scheduler Logo"
        width={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : size === 'xl' ? 48 : 64}
        height={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : size === 'xl' ? 48 : 64}
        className={cn(sizeClasses[size], "object-contain")}
      />
      {showText && (
        <span className={cn(
          "ml-2 font-bold text-gray-900",
          size === 'sm' ? "text-sm" : 
          size === 'md' ? "text-lg" : 
          size === 'lg' ? "text-xl" : 
          size === 'xl' ? "text-2xl" : "text-3xl",
          textClassName
        )}>
          Church Music Scheduler
        </span>
      )}
    </div>
  )
} 