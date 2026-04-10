import { useEffect } from "react";
import {
  CUSTOM_METER_READING_CHOICE_KEY,
  type MeterReadingChoice,
  type MeterReadingChoiceKey,
} from "../../services/meter-reading-options";
import type { DataRow } from "../../types";

interface QuickMeterReadModalProps {
  catalogHelp: string | null;
  catalogLoading: boolean;
  catalogOptions: Array<{ label: string; value: string }>;
  feedback: string | null;
  onChoiceChange: (value: MeterReadingChoiceKey | typeof CUSTOM_METER_READING_CHOICE_KEY) => void;
  onCustomValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  placeholder: string;
  readingChoices: MeterReadingChoice[];
  selectedChoiceKey: MeterReadingChoiceKey | typeof CUSTOM_METER_READING_CHOICE_KEY;
  selectedTarget: DataRow;
  submitting: boolean;
  value: string;
}

export function QuickMeterReadModal({
  catalogHelp,
  catalogLoading,
  catalogOptions,
  feedback,
  onChoiceChange,
  onCustomValueChange,
  onClose,
  onSubmit,
  placeholder,
  readingChoices,
  selectedChoiceKey,
  selectedTarget,
  submitting,
  value,
}: QuickMeterReadModalProps) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const meterId = String(selectedTarget.meterId ?? "--");
  const customerName = String(selectedTarget.customerName ?? "Unknown customer");
  const stationId = String(selectedTarget.stationId ?? "No station");
  const protocolVersion = String(selectedTarget.protocolVersion ?? "Protocol not available");
  const selectedChoice =
    readingChoices.find((choice) => choice.key === selectedChoiceKey) ?? readingChoices[0] ?? null;
  const isCustomChoice = selectedChoiceKey === CUSTOM_METER_READING_CHOICE_KEY;
  const helpText = isCustomChoice
    ? catalogHelp ?? "Only use this if you know the exact technical reading code."
    : catalogLoading
      ? "Loading meter-specific reading options..."
      : selectedChoice?.helpText ?? "Choose the reading you want from the meter.";

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card modal-card--compact quick-meter-read-modal">
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-eyebrow">Quick Read</span>
            <h3 className="modal-title">Read meter {meterId}</h3>
            <p className="quick-meter-read-intro">Pick what to read, then tap Read Meter.</p>
          </div>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
            <svg fill="none" height="18" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body quick-meter-read-body">
          <div className="quick-meter-read-summary">
            <span className="quick-meter-read-summary__label">Selected meter</span>
            <strong>{meterId}</strong>
            <span>{customerName}</span>
            <div className="quick-meter-read-summary__meta">
              <span>{stationId}</span>
              <span>{protocolVersion}</span>
            </div>
          </div>

          <label className="modal-field" htmlFor="quick-meter-read-choice">
            <span className="modal-field-label">What do you want to read?</span>
            <select
              className="modal-input"
              id="quick-meter-read-choice"
              onChange={(event) =>
                onChoiceChange(
                  event.target.value === CUSTOM_METER_READING_CHOICE_KEY
                    ? CUSTOM_METER_READING_CHOICE_KEY
                    : (event.target.value as MeterReadingChoiceKey),
                )
              }
              value={selectedChoiceKey}
            >
              {readingChoices.map((choice) => (
                <option key={choice.key} value={choice.key}>
                  {choice.label}
                </option>
              ))}
              <option value={CUSTOM_METER_READING_CHOICE_KEY}>Other technical reading</option>
            </select>
            <span className="modal-field-help">{helpText}</span>
          </label>

          {isCustomChoice ? (
            <label className="modal-field" htmlFor="quick-meter-read-input">
              <span className="modal-field-label">Technical code</span>
              <input
                className="modal-input"
                id="quick-meter-read-input"
                list={catalogOptions.length > 0 ? "quick-meter-read-options" : undefined}
                onChange={(event) => onCustomValueChange(event.target.value)}
                placeholder={placeholder}
                value={value}
              />
              {catalogOptions.length > 0 ? (
                <datalist id="quick-meter-read-options">
                  {catalogOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
              ) : null}
              <span className="modal-field-help">
                Type the exact register, OBIS code, or item code only if the simple list does not have what you need.
              </span>
            </label>
          ) : null}

          {feedback ? <p className="status-banner quick-meter-read-status">{feedback}</p> : null}
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn--ghost" onClick={onClose} type="button">
            Close
          </button>
          <button
            className="modal-btn modal-btn--primary"
            disabled={submitting || (isCustomChoice && value.trim().length === 0)}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "Reading..." : "Read Meter"}
          </button>
        </div>
      </div>
    </div>
  );
}
