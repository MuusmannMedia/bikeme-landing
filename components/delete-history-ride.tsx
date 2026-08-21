"use client";

import { useId, useRef, useState, type FormEvent, type RefObject, type SyntheticEvent } from "react";
import { useFormStatus } from "react-dom";

type DeleteHistoryRideProps = {
  action: (formData: FormData) => Promise<void>;
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  historyId: string;
  locale: string;
  pendingLabel: string;
  returnTo: string;
  title: string;
  triggerLabel: string;
};

function DeleteDialogActions({
  cancelLabel,
  confirmLabel,
  pendingLabel,
  submitting,
  cancelButtonRef,
  onCancel
}: {
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  submitting: boolean;
  cancelButtonRef: RefObject<HTMLButtonElement>;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  const isPending = pending || submitting;

  return (
    <div className="bike-app-delete-dialog-actions">
      <button
        ref={cancelButtonRef}
        className="bike-app-button bike-app-button-secondary"
        type="button"
        disabled={isPending}
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        className="bike-app-button bike-app-button-danger"
        type="submit"
        disabled={isPending}
        aria-disabled={isPending}
      >
        {isPending ? pendingLabel : confirmLabel}
      </button>
    </div>
  );
}

export function DeleteHistoryRide({
  action,
  cancelLabel,
  confirmLabel,
  description,
  historyId,
  locale,
  pendingLabel,
  returnTo,
  title,
  triggerLabel
}: DeleteHistoryRideProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [submitting, setSubmitting] = useState(false);

  const closeDialog = () => {
    if (submittingRef.current) return;
    dialogRef.current?.close();
  };

  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closeDialog();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
  };

  return (
    <>
      <button
        ref={triggerButtonRef}
        className="bike-app-button bike-app-button-danger"
        type="button"
        onClick={openDialog}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="bike-app-delete-dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={handleCancel}
        onClose={() => triggerButtonRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <form action={action} onSubmit={handleSubmit} aria-busy={submitting}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="historyId" value={historyId} />
          <div className="bike-app-delete-dialog-icon" aria-hidden="true">!</div>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          <DeleteDialogActions
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            pendingLabel={pendingLabel}
            submitting={submitting}
            cancelButtonRef={cancelButtonRef}
            onCancel={closeDialog}
          />
        </form>
      </dialog>
    </>
  );
}
