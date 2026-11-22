import clsx from 'clsx'

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={clsx('grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-white shadow-[0_2px_6px_rgb(55_120_194/0.3)]', className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
        <path d="M12 3.5c-2.9 3.7-5 6.6-5 9.1a5 5 0 0 0 10 0c0-2.5-2.1-5.4-5-9.1Z" fill="currentColor" />
        <path d="M9.6 13.6c.4 1.2 1.3 1.9 2.4 2" stroke="#3778C2" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}
