import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Modal built on the native <dialog>: focus trap, Esc and inert backdrop come for free. */
export function Modal({ title, onClose, children }: Props) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-body">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
