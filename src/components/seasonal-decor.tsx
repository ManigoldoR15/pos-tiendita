'use client'

// Decoraciones ambientales para temas estacionales.
// pointer-events: none — nunca bloquean clicks en la UI.
// globals.css ya tiene @media(prefers-reduced-motion) que desactiva animaciones.

const CSS = `
@keyframes sd-bat {
  0%   { transform: translateX(-100px) translateY(0px)   scaleX(1);  opacity:0; }
  6%   { opacity:.9; }
  25%  { transform: translateX(25vw)  translateY(-45px)  scaleX(1); }
  50%  { transform: translateX(50vw)  translateY(20px)   scaleX(-1); }
  75%  { transform: translateX(75vw)  translateY(-35px)  scaleX(-1); }
  94%  { opacity:.9; }
  100% { transform: translateX(calc(100vw + 100px)) translateY(0px) scaleX(-1); opacity:0; }
}
@keyframes sd-bob {
  0%,100% { transform: translateY(0px) rotate(-2deg); }
  50%      { transform: translateY(-12px) rotate(2deg); }
}
@keyframes sd-bob-fast {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-8px); }
}
@keyframes sd-float-up {
  0%   { transform: translateY(110vh) translateX(0px)  rotate(0deg);   opacity:0; }
  8%   { opacity:.85; }
  50%  { transform: translateY(50vh)  translateX(18px)  rotate(180deg); }
  92%  { opacity:.85; }
  100% { transform: translateY(-60px) translateX(-12px) rotate(360deg); opacity:0; }
}
@keyframes sd-snow {
  0%   { transform: translateY(-30px) translateX(0px)   rotate(0deg);   opacity:0; }
  8%   { opacity:.9; }
  50%  { transform: translateY(50vh)  translateX(22px)  rotate(180deg); }
  92%  { opacity:.9; }
  100% { transform: translateY(110vh) translateX(-16px) rotate(360deg); opacity:0; }
}
@keyframes sd-twinkle {
  0%,100% { opacity:.15; transform:scale(.8); }
  50%      { opacity:1;   transform:scale(1.3); }
}
@keyframes sd-drift {
  0%,100% { transform: translateY(0px)  rotate(0deg); }
  33%      { transform: translateY(-18px) rotate(6deg); }
  66%      { transform: translateY(10px)  rotate(-6deg); }
}
@keyframes sd-swing {
  0%,100% { transform: rotate(-8deg); }
  50%      { transform: rotate(8deg); }
}
`

type El = {
  e: string           // emoji
  top?: string; left?: string; right?: string; bottom?: string
  sz?: string         // font-size
  op?: number         // opacity
  anim: string        // animation name
  dur?: string; del?: string
}

// ─── Decoraciones por tema ────────────────────────────────────────────────────

function halloween(): El[] {
  const bats: El[] = [
    { e:'🦇', top:'6%',  anim:'sd-bat', dur:'9s',  del:'0s',   sz:'22px' },
    { e:'🦇', top:'19%', anim:'sd-bat', dur:'7s',  del:'3.5s', sz:'16px' },
    { e:'🦇', top:'34%', anim:'sd-bat', dur:'11s', del:'6s',   sz:'26px' },
    { e:'🦇', top:'12%', anim:'sd-bat', dur:'8s',  del:'10s',  sz:'14px' },
    { e:'🦇', top:'48%', anim:'sd-bat', dur:'10s', del:'14s',  sz:'20px' },
    { e:'🦇', top:'3%',  anim:'sd-bat', dur:'6s',  del:'18s',  sz:'12px' },
  ]
  const decor: El[] = [
    { e:'🎃', bottom:'28px', left:'14px',  sz:'56px', op:.70, anim:'sd-bob',      dur:'3.2s' },
    { e:'🎃', bottom:'16px', right:'20px', sz:'42px', op:.60, anim:'sd-bob',      dur:'4.1s', del:'1.2s' },
    { e:'🎃', bottom:'72px', left:'70px',  sz:'32px', op:.40, anim:'sd-bob-fast', dur:'2.8s', del:'0.6s' },
    { e:'🕷️', top:'56px',   right:'36px', sz:'28px', op:.55, anim:'sd-drift',    dur:'5s',   del:'0.5s' },
    { e:'👻', bottom:'100px',right:'80px', sz:'38px', op:.38, anim:'sd-drift',    dur:'6.5s', del:'2s'   },
    { e:'🌙', top:'24px',   right:'54px', sz:'32px', op:.42, anim:'sd-bob',      dur:'8s',   del:'1s'   },
    { e:'🕸️', top:'10px',   left:'10px',  sz:'40px', op:.30, anim:'sd-swing',    dur:'7s'               },
  ]
  return [...bats, ...decor]
}

function navidad(): El[] {
  const flakes: El[] = Array.from({ length: 20 }, (_, i) => ({
    e: i % 5 === 0 ? '✦' : i % 5 === 1 ? '❅' : i % 5 === 2 ? '❆' : '❄️',
    top: '-30px',
    left: `${(i * 4.9) % 100}%`,
    sz: `${10 + (i % 4) * 5}px`,
    op: .45 + (i % 4) * .12,
    anim: 'sd-snow',
    del: `${(i * .85) % 13}s`,
    dur: `${7 + (i % 5)}s`,
  }))
  return [
    ...flakes,
    { e:'⭐', top:'14px',  right:'70px',  sz:'30px', op:.80, anim:'sd-twinkle', dur:'1.8s' },
    { e:'⭐', top:'36px',  right:'120px', sz:'18px', op:.60, anim:'sd-twinkle', dur:'2.4s', del:'0.8s' },
    { e:'⭐', top:'22px',  right:'180px', sz:'12px', op:.40, anim:'sd-twinkle', dur:'3.2s', del:'1.6s' },
    { e:'🎄', bottom:'20px', left:'12px',  sz:'48px', op:.55, anim:'sd-bob',      dur:'5s' },
    { e:'🎁', bottom:'20px', right:'16px', sz:'36px', op:.55, anim:'sd-bob-fast', dur:'4s', del:'1s' },
  ]
}

function diaMuertos(): El[] {
  const petals: El[] = Array.from({ length: 14 }, (_, i) => ({
    e: i % 3 === 0 ? '🌼' : i % 3 === 1 ? '🌸' : '🪷',
    bottom: '-30px',
    left: `${(i * 7.1) % 100}%`,
    sz: `${12 + (i % 4) * 7}px`,
    op: .55 + (i % 3) * .12,
    anim: 'sd-float-up',
    del: `${(i * 1.3) % 15}s`,
    dur: `${10 + (i % 4)}s`,
  }))
  return [
    ...petals,
    { e:'💀', bottom:'28px', left:'16px',  sz:'44px', op:.60, anim:'sd-bob',      dur:'3.8s' },
    { e:'💀', bottom:'20px', right:'18px', sz:'34px', op:.50, anim:'sd-bob-fast', dur:'4.5s', del:'1s' },
    { e:'🕯️', bottom:'30px', left:'76px',  sz:'36px', op:.55, anim:'sd-drift',    dur:'4s',   del:'0.5s' },
    { e:'🕯️', bottom:'30px', right:'70px', sz:'28px', op:.45, anim:'sd-drift',    dur:'5s',   del:'1.5s' },
  ]
}

function sanValentin(): El[] {
  return Array.from({ length: 16 }, (_, i) => ({
    e: i % 3 === 0 ? '💗' : i % 3 === 1 ? '💕' : '❤️',
    bottom: '-30px',
    left: `${(i * 6.25) % 100}%`,
    sz: `${10 + (i % 5) * 7}px`,
    op: .5 + (i % 3) * .15,
    anim: 'sd-float-up',
    del: `${(i * 1.0) % 13}s`,
    dur: `${8 + (i % 4)}s`,
  }))
}

function anoNuevo(): El[] {
  const stars: El[] = Array.from({ length: 22 }, (_, i) => ({
    e: i % 3 === 0 ? '✨' : i % 3 === 1 ? '⭐' : '🌟',
    top: `${(i * 4.2) % 88}%`,
    left: `${(i * 4.55) % 97}%`,
    sz: `${10 + (i % 4) * 7}px`,
    op: .15 + (i % 5) * .1,
    anim: 'sd-twinkle',
    del: `${(i * .6) % 4}s`,
    dur: `${2 + (i % 3)}s`,
  }))
  return [
    ...stars,
    { e:'🎆', bottom:'20px', left:'10px',  sz:'48px', op:.55, anim:'sd-bob',      dur:'5s' },
    { e:'🎇', bottom:'20px', right:'14px', sz:'44px', op:.55, anim:'sd-bob-fast', dur:'4s', del:'1s' },
    { e:'🥂', bottom:'28px', left:'56%',   sz:'36px', op:.45, anim:'sd-bob',      dur:'6s', del:'0.5s' },
  ]
}

function buenFin(): El[] {
  const bits: El[] = Array.from({ length: 14 }, (_, i) => ({
    e: i % 3 === 0 ? '💸' : i % 3 === 1 ? '🎊' : '🏷️',
    bottom: '-30px',
    left: `${(i * 7.2) % 100}%`,
    sz: `${12 + (i % 3) * 8}px`,
    op: .5 + (i % 3) * .15,
    anim: 'sd-float-up',
    del: `${(i * 1.3) % 14}s`,
    dur: `${8 + (i % 4)}s`,
  }))
  return [
    ...bits,
    { e:'🛍️', bottom:'22px', left:'14px',  sz:'48px', op:.60, anim:'sd-bob',      dur:'4s' },
    { e:'🛒', bottom:'20px', right:'16px', sz:'40px', op:.55, anim:'sd-bob-fast', dur:'5s', del:'1s' },
  ]
}

function diaMadres(): El[] {
  return Array.from({ length: 16 }, (_, i) => ({
    e: i % 4 === 0 ? '🌸' : i % 4 === 1 ? '🌺' : i % 4 === 2 ? '🌹' : '🌷',
    bottom: '-30px',
    left: `${(i * 6.25) % 100}%`,
    sz: `${10 + (i % 4) * 7}px`,
    op: .5 + (i % 3) * .15,
    anim: 'sd-float-up',
    del: `${(i * 1.0) % 13}s`,
    dur: `${8 + (i % 5)}s`,
  }))
}

// ─── Render ───────────────────────────────────────────────────────────────────

const FN: Record<string, () => El[]> = {
  halloween:    halloween,
  navidad:      navidad,
  'dia-muertos': diaMuertos,
  'san-valentin': sanValentin,
  'ano-nuevo':  anoNuevo,
  'buen-fin':   buenFin,
  'dia-madres': diaMadres,
}

export default function SeasonalDecor({ slug }: { slug: string | null }) {
  if (!slug || slug === 'default') return null
  const fn = FN[slug]
  if (!fn) return null
  const els = fn()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 5 }}
      >
        {els.map((el, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: el.top, left: el.left, right: el.right, bottom: el.bottom,
              fontSize: el.sz ?? '20px',
              opacity: el.op ?? 0.7,
              animation: `${el.anim} ${el.dur ?? '8s'} ${el.del ?? '0s'} infinite linear`,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {el.e}
          </span>
        ))}
      </div>
    </>
  )
}
