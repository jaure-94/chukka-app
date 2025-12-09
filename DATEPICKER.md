1. Confirm Sheet Context  
   - Identify the grid tech powering the in-browser dispatch sheet (e.g., Handsontable, Luckysheet, AG Grid, custom).  
   - Verify cell addressing for B5 (zero- vs one-based indices) and any existing validation/formatting on that cell.

2. Choose Date Picker Library  
   - Select a lightweight, accessible picker with keyboard support and custom formatting (e.g., Flatpickr/Pikaday or a styled native `<input type="date">` with polyfill).  
   - Ensure it supports default-to-today, dd-MMM-yyyy output, and individual day/month/year selection in addition to a grid calendar layout.

3. Define UX/UI Behavior  
   - Trigger: focusing/clicking B5 opens the picker; Enter/Space also opens for accessibility.  
   - Default: picker opens with today preselected; if B5 already has a valid date, preselect that.  
   - Selection controls: allow picking day, month, and year individually (dropdowns or segmented controls) alongside the traditional grid calendar layout.  
   - Commit: on selection, write back in dd-MMM-yyyy (e.g., 07-Jan-2025); clear allowed via Backspace/Delete.  
   - Manual entry: if typed/pasted, attempt lenient parse (dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd); normalize to dd-MMM-yyyy or show inline error and keep picker open.  
   - Keyboard: arrow keys to navigate picker, Enter to commit, Esc to close; focus returns to B5.  
   - Positioning: anchor below/over B5 using cell bounds; destroy the picker on blur/commit to avoid stray DOM.  
   - Styling: match dispatch sheet theme (font, borders, radius, colors); ensure WCAG AA contrast; set aria-labels and announce selected date.

4. Wire Into Grid Events  
   - Hook `afterSelection`/`onCellFocus` to detect B5 and open the custom editor; suppress the default editor for this cell.  
   - On picker select: format and commit dd-MMM-yyyy to B5.  
   - On blur/close: remove picker DOM and restore normal focus handling.  
   - On paste into B5: intercept, parse, normalize, or reject with feedback.  
   - Ensure other cells retain default editors.

5. Date Parsing and Formatting  
   - Use a fixed-locale formatter (e.g., date-fns `format(date, 'dd-MMM-yyyy')`) to guarantee English month abbreviations.  
   - Handle timezone by using local date only (no UTC conversion).  
   - Optionally enforce business rules (e.g., disallow future dates) via min/max in the picker.

6. Accessibility  
   - Ensure picker is focusable, with clear `aria-label` (e.g., "Dispatch date").  
   - Keep focus within the picker while open; Esc closes and returns focus to B5.  
   - Provide visible focus states and announce selected/invalid states.

7. Styling Implementation  
   - Add scoped styles (CSS module or equivalent) for the picker container, grid, and day/month/year controls to match the sheet’s UI.  
   - Align picker to cell B5 with absolute positioning based on cell rect.

8. Testing Plan  
   - Manual: click-to-open, keyboard-only open/close/select, today default, selecting another date, clearing then reopening, paste with normalization, invalid input handling.  
   - Cross-browser: Chrome, Safari (incl. iOS), Firefox; confirm no viewport jumps on iOS and consistent formatting.  
   - Regression: tab navigation across cells, ensure only B5 uses the custom picker, verify no stray DOM nodes after closing.

9. Deployment/Readiness  
   - Guard behind a feature flag/config for B5.  
   - Check bundle impact (tree-shake picker; avoid heavy deps).  
   - Document for ops: B5 uses a date picker; defaults to today; output is dd-MMM-yyyy; paste is normalized; invalid entries rejected.


