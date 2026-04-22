import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const AuroraBackground = ({ className, children, ...props }: AuroraBackgroundProps) => {
  return (
    <div
      className={cn('relative min-h-screen w-full bg-black text-gray-300', className)}
      {...props}
    >
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-black/80 z-10 backdrop-blur-[2px]"></div>

        <div className="absolute -inset-[10px] opacity-40 animate-aurora-1 bg-gradient-to-tr from-blue-600 to-transparent blur-3xl rounded-full w-[80%] h-[80%] -top-[20%] -left-[10%] mix-blend-screen"></div>

        <div className="absolute -inset-[10px] opacity-40 animate-aurora-2 bg-gradient-to-bl from-purple-600 to-transparent blur-3xl rounded-full w-[70%] h-[90%] top-[10%] right-[0%] mix-blend-screen"></div>

        <div className="absolute -inset-[10px] opacity-30 animate-aurora-3 bg-gradient-to-tl from-pink-500 to-transparent blur-3xl rounded-full w-[90%] h-[70%] bottom-[0%] -right-[20%] mix-blend-screen"></div>

        <div className="absolute -inset-[10px] opacity-30 animate-aurora-4 bg-gradient-to-br from-green-500 to-transparent blur-3xl rounded-full w-[60%] h-[60%] -bottom-[20%] left-[20%] mix-blend-screen"></div>
      </div>
      <div className="relative z-10 w-full min-h-screen flex flex-col">{children}</div>
    </div>
  )
}
