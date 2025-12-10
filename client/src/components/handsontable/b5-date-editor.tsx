import { useEffect, useRef, useState } from "react";
import { BaseEditor } from "handsontable/editors/baseEditor";
import type Handsontable from "handsontable";
import { DayPicker } from "react-day-picker";
import { createRoot, type Root } from "react-dom/client";
import { format, parse } from "date-fns";
import { enUS } from "date-fns/locale";

type EditorValue = string | null | undefined;

export const DATE_FORMAT = "dd-MMM-yyyy";

const FALLBACK_TODAY = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const PARSE_PATTERNS = [
  DATE_FORMAT,
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "d-MMM-yyyy",
];

export function tryParseToDate(value: EditorValue): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  for (const pattern of PARSE_PATTERNS) {
    const parsed = parse(trimmed, pattern, FALLBACK_TODAY());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function tryFormatToB5(value: EditorValue): string | null {
  const parsed = tryParseToDate(value);
  if (!parsed) return null;
  // Force local date, strip time
  const normalized = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return format(normalized, DATE_FORMAT);
}

// Handsontable custom editor for cell B5 (row 4, col 1)
export class B5DateEditor extends BaseEditor {
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;
  private selectedDate: Date = FALLBACK_TODAY();
  private currentValue: string = format(FALLBACK_TODAY(), DATE_FORMAT);
  private manualText: string = format(FALLBACK_TODAY(), DATE_FORMAT);
  private handleKeydown?: (e: KeyboardEvent) => void;

  init(): void {
    super.init();
    // Don't create DOM here - wait until open() to avoid interfering with Handsontable
  }

  getValue(): string {
    return this.currentValue;
  }

  setValue(value?: EditorValue): void {
    const parsed = tryParseToDate(value) || FALLBACK_TODAY();
    this.selectedDate = parsed;
    this.currentValue = format(parsed, DATE_FORMAT);
    this.manualText = this.currentValue;
  }

  open(): void {
    // Create container only when opening to avoid interfering with Handsontable rendering
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "b5-date-editor-overlay";
      document.body.appendChild(this.container);
    }
    
    if (!this.root) {
      this.root = createRoot(this.container);
    }

    // Position overlay aligned to the cell
    // Only use TD - don't access instance to avoid destroyed instance errors
    let td: HTMLElement | null = null;
    if (this.TD) {
      td = this.TD as HTMLElement;
    }

    if (!td) {
      // Fallback positioning - center of viewport if we can't find the cell
      this.container.style.display = "block";
      this.container.style.position = "fixed";
      this.container.style.top = "50%";
      this.container.style.left = "50%";
      this.container.style.transform = "translate(-50%, -50%)";
      this.container.style.zIndex = "10000";
    } else {
      const rect = td.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const viewportW = window.innerWidth || 360;
      const viewportH = window.innerHeight || 640;
      const padding = 12;
      const estimatedHeight = 360; // approximate DayPicker height
      const containerWidth = Math.min(Math.max(rect.width, 280), 380, viewportW - padding * 2);
      
      // Prefer placing below; if not enough space, place above.
      let top = rect.bottom + scrollY + 8;
      if (top + estimatedHeight > scrollY + viewportH && rect.top > estimatedHeight + 16) {
        top = rect.top + scrollY - estimatedHeight - 8;
      }
      
      // Clamp horizontally within viewport
      const left = Math.max(
        scrollX + padding,
        Math.min(rect.left + scrollX, scrollX + viewportW - containerWidth - padding)
      );

      this.container.style.display = "block";
      this.container.style.position = "absolute";
      this.container.style.top = `${top}px`;
      this.container.style.left = `${left}px`;
      this.container.style.width = `${containerWidth}px`;
      this.container.style.maxWidth = `calc(100vw - ${padding * 2}px)`;
      this.container.style.zIndex = "10000";
    }

    const close = () => {
      // Finish editing and commit currentValue via getValue()
      try {
        this.finishEditing(false);
      } catch (e) {
        // Ignore if instance is destroyed
        console.warn('B5DateEditor: Error finishing edit', e);
      }
    };

    const commitDate = (date: Date) => {
      this.selectedDate = date;
      this.currentValue = format(date, DATE_FORMAT);
      this.manualText = this.currentValue;
      try {
        this.finishEditing(false);
      } catch (e) {
        // Ignore if instance is destroyed
        console.warn('B5DateEditor: Error committing date', e);
      }
    };

    // Keyboard handling for accessibility
    this.handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        try {
          this.finishEditing(false);
        } catch (e) {
          // Ignore if instance is destroyed
        }
      }
    };
    document.addEventListener("keydown", this.handleKeydown, true);

    this.root.render(
      <OverlayContent
        selectedDate={this.selectedDate}
        manualText={this.manualText}
        onManualChange={(next) => {
          this.manualText = next;
        }}
        onCommit={commitDate}
        onToday={() => commitDate(FALLBACK_TODAY())}
        onClose={close}
      />
    );
  }

  close(): void {
    // Clean up keyboard listener
    if (this.handleKeydown) {
      document.removeEventListener("keydown", this.handleKeydown, true);
      this.handleKeydown = undefined;
    }
    
    // Hide container
    if (this.container) {
      try {
        this.container.style.display = "none";
      } catch (e) {
        // Ignore if container is already removed
      }
    }
    
    // Clear React content
    if (this.root) {
      try {
        this.root.render(null);
      } catch (e) {
        // Ignore render errors
      }
    }
  }

  focus(): void {
    // Focus is managed within overlay; optional focus trap can be handled by the overlay component
  }

  destroy(): void {
    // Clean up event listeners FIRST before any DOM manipulation
    if (this.handleKeydown) {
      document.removeEventListener("keydown", this.handleKeydown, true);
      this.handleKeydown = undefined;
    }
    
    // Clean up React root - unmount BEFORE removing from DOM
    if (this.root) {
      try {
        this.root.unmount();
      } catch (e) {
        // Silently ignore - React root may already be unmounted
      }
      this.root = null;
    }
    
    // Remove container from DOM LAST
    if (this.container) {
      if (this.container.parentNode) {
        try {
          this.container.parentNode.removeChild(this.container);
        } catch (e) {
          // Silently ignore - container may already be removed
        }
      }
      this.container = null;
    }
    
    // Call super destroy - this is critical for Handsontable cleanup
    // DO NOT wrap in try-catch - if this fails, we need to know
    super.destroy();
  }
}

type OverlayProps = {
  selectedDate: Date;
  manualText: string;
  onManualChange: (value: string) => void;
  onCommit: (date: Date) => void;
  onToday: () => void;
  onClose: () => void;
};

function OverlayContent({
  selectedDate,
  manualText,
  onManualChange,
  onCommit,
  onToday,
  onClose,
}: OverlayProps) {
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setError(null);
    // Focus the input for quick keyboard entry
    inputRef.current?.focus();
  }, []);

  const onManualBlur = () => {
    if (!manualText) return;
    const parsed = tryParseToDate(manualText);
    if (!parsed) {
      setError("Enter a valid date (e.g., 07-Jan-2025)");
      return;
    }
    setError(null);
  };

  const handleApply = () => {
    const parsed = tryParseToDate(manualText);
    if (!parsed) {
      setError("Enter a valid date (e.g., 07-Jan-2025)");
      return;
    }
    setError(null);
    onCommit(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  };

  return (
    <div
      className="b5-date-editor-panel"
      role="dialog"
      aria-label="Dispatch date picker"
      ref={panelRef}
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="b5-date-editor-input-row">
        <label htmlFor="b5-date-input" className="sr-only">
          Dispatch date
        </label>
        <input
          id="b5-date-input"
          ref={inputRef}
          className="b5-date-editor-input"
          type="text"
          value={manualText}
          onChange={(e) => {
            onManualChange(e.target.value);
            if (error) {
              setError(null);
            }
          }}
          onBlur={onManualBlur}
          placeholder="dd-MMM-yyyy"
          aria-invalid={!!error}
          aria-describedby={error ? "b5-date-error" : undefined}
        />
        <button type="button" className="b5-date-editor-apply" onClick={handleApply}>
          Apply
        </button>
      </div>
      {error && (
        <div id="b5-date-error" className="b5-date-editor-error" role="alert">
          {error}
        </div>
      )}
      <DayPicker
        mode="single"
        captionLayout="dropdown"
        fromYear={1900}
        toYear={2100}
        defaultMonth={selectedDate}
        selected={selectedDate}
        onSelect={(date) => {
          if (date) {
            onCommit(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
          }
        }}
        showOutsideDays
        weekStartsOn={1}
        locale={enUS}
      />
      <div className="b5-date-editor-footer">
        <button type="button" className="b5-date-editor-clear" onClick={onToday}>
          Today
        </button>
        <button type="button" className="b5-date-editor-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default B5DateEditor;

