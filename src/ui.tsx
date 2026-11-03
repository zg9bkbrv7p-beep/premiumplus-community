import React, { useEffect, useRef } from "react";
import { X, ArrowUpRight, Plus } from "lucide-react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className={"brand " + (dark ? "brand-light" : "")}>
      <span className="brand-symbol">
        P<span>+</span>
      </span>
      <div>
        PREMIUM<span className="brand-plus">+</span>
        <small>COMMERCIAL</small>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">MAKE ROOM FOR SOMETHING GREAT</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Plus />
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}
export function Arrow() {
  return <ArrowUpRight size={17} />;
}
export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
