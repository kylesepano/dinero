import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { dateLabel, today } from "../utils/finance";
import {
  presets,
  presetRange,
  validateRange,
  type AnalyticsRange,
  type Preset,
} from "../utils/analytics";

export default function DateRangeFilter({
  range,
  onChange,
}: {
  range: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}) {
  const [preset, setPreset] = useState<Preset>(range.preset);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [error, setError] = useState("");
  return (
    <section
      className="analytics-filter card"
      aria-label="Analytics date filter"
    >
      <div className="analytics-filter-row">
        <label>
          Period
          <select
            aria-label="Analytics period"
            value={preset}
            onChange={(event) => {
              const next = event.target.value as Preset;
              setPreset(next);
              setError("");
              if (next !== "custom") onChange(presetRange(next));
            }}
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="active-range">
          <CalendarDays size={18} />
          <span>
            <strong>
              {dateLabel(range.start)} – {dateLabel(range.end)}
            </strong>
            <small>
              Inclusive dates · weeks start Monday · current periods end today
            </small>
          </span>
        </p>
      </div>
      {preset === "custom" && (
        <form
          className="custom-range"
          onSubmit={(event) => {
            event.preventDefault();
            const next = { start, end, preset: "custom" as const };
            const problem = validateRange(next);
            setError(problem);
            if (!problem) onChange(next);
          }}
        >
          <label>
            Start date
            <input
              aria-label="Start date"
              type="date"
              value={start}
              required
              min="0100-01-01"
              max={today()}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            End date
            <input
              aria-label="End date"
              type="date"
              value={end}
              required
              min="0100-01-01"
              max={today()}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button className="button secondary">Apply range</button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
