import { useState } from "react";
import type { AppData } from "../types";
import { fingerprint, prepareImport, readLegacy } from "../services/mapping";
import Modal from "./Modal";
export default function LocalMigration({
  email,
  cloud,
  imports,
  onImport,
}: {
  email: string;
  cloud: AppData;
  imports: string[];
  onImport: (next: AppData, hash: string) => Promise<boolean>;
}) {
  const [legacy] = useState(readLegacy);
  const [review, setReview] = useState<{ hash: string; data: AppData } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  async function inspect() {
    if (!legacy.data) return;
    try {
      const hash = await fingerprint(legacy.data);
      if (imports.includes(hash)) {
        setMessage(
          "This local backup has already been imported into this account. The original is still preserved.",
        );
        return;
      }
      setReview({ hash, data: legacy.data });
    } catch {
      setMessage(
        "Could not inspect the local backup. It has not been changed.",
      );
    }
  }
  return (
    <section className="card settings-card">
      <div>
        <h2>Existing local backup</h2>
        <p>
          {legacy.error ||
            (legacy.data
              ? `This browser still has ${legacy.data.transactions.length} transactions, ${legacy.data.categories.length} categories, and ${legacy.data.budgets.length} budgets from the ${legacy.data.demo ? "demo" : "previous local"} workspace. Nothing is imported automatically.`
              : "No previous local workspace was found in this browser.")}
        </p>
        <p>
          Import only if these records belong to you. Importing replaces this
          account's financial data after confirmation. The original local backup
          stays untouched.
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      {legacy.data && (
        <button
          className="button secondary"
          onClick={() => {
            void inspect();
          }}
        >
          Review local import
        </button>
      )}
      {review && (
        <Modal
          title="Import local data into this account?"
          onClose={() => setReview(null)}
        >
          <p className="modal-description">
            Account: <strong>{email}</strong>
          </p>
          <p className="modal-description">
            Import {review.data.transactions.length} transactions,{" "}
            {review.data.categories.length} categories,{" "}
            {review.data.budgets.length} monthly budgets, and{" "}
            {review.data.settings.currency} currency settings.{" "}
            {review.data.demo ? "This is DEMO data, not personal records." : ""}
          </p>
          <p className="modal-description">
            This will replace the {cloud.transactions.length} transactions,{" "}
            {cloud.categories.length} categories, budgets, and settings
            currently in this cloud account. Export a cloud backup first if you
            want to keep them. Your original local backup will remain in this
            browser.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setReview(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={async () => {
                if (await onImport(prepareImport(review.data), review.hash)) {
                  setReview(null);
                  setMessage(
                    "Local import verified in the cloud. The original local backup has been preserved.",
                  );
                }
              }}
            >
              Replace cloud data
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
