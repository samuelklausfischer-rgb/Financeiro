import { useEffect, useState } from 'react'

export function AnimatedBackground() {
  const [particles, setParticles] = useState<
    { id: number; left: string; dur: string; del: string; size: string }[]
  >([])

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        dur: `${3 + Math.random() * 2}s`,
        del: `${Math.random() * 2}s`,
        size: `2px`,
      })),
    )
  }, [])

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[oklch(0.145_0_0)] pointer-events-none">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #80808012 1px, transparent 1px),
            linear-gradient(to bottom, #80808012 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Moving Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#6F42C1]/40 rounded-full mix-blend-screen filter blur-3xl animate-orb-1" />
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-[#0066CC]/40 rounded-full mix-blend-screen filter blur-3xl animate-orb-2" />
      <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-[#28A745]/30 rounded-full mix-blend-screen filter blur-3xl animate-orb-3" />

      {/* Radial Darkening Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,oklch(0.145_0_0)_100%)] opacity-80" />

      {/* Floating Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-[-20px] bg-white/40 rounded-full animate-particle-float shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: p.dur,
            animationDelay: p.del,
          }}
        />
      ))}
    </div>
  )
}
