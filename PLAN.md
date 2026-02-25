# Timeline Enhancement Plan

## Summary

After deep analysis of react-datasheet-grid (DSG) and our custom grid, I recommend a **hybrid approach**: fix the multi-select bug in our custom hook rather than adopting DSG wholesale, because:

- **DSG has no frozen/sticky LEFT column** (only `stickyRightColumn`) — our core layout requirement
- Our specialized features (schedule overlays, fill-all buttons, drag-reorderable groups, mixed editable/computed rows) would need extensive rework inside DSG's data model
- DSG's collapsible groups work but require flattening all our data into a different shape + custom onChange handler — ~400+ lines of transformation code to replace ~280 lines of hook code

**Root cause analysis of the multi-select bug** (from extensive code review):
1. **State race condition**: `anchor` and `focusedCell` use separate `useState` hooks — even with React 18 batching, the updater function `setAnchor(a => a ?? focusedCellRef.current)` reads a ref that may lag behind
2. **Lost keyboard focus**: after clicking a cell, the container `div[tabIndex=0]` may lose focus, preventing Shift+Arrow keyboard events from firing
3. **CSS override**: Tailwind's `hover:bg-slate-100` has higher specificity than `bg-blue-100`, masking selection visuals when the mouse is over selected cells

---

## Phase 1: Fix Multi-Select (rewrite useGridNavigation)

### 1A. Consolidate state into single object
Replace four separate `useState` calls with one atomic state:
```ts
const [grid, setGrid] = useState<{
  focused: CellCoord | null;
  anchor: CellCoord | null;
  editing: boolean;
  initialKey: string | null;
}>({ focused: null, anchor: null, editing: false, initialKey: null });
```
This guarantees anchor + focused update atomically — no inconsistent intermediate renders.

### 1B. Ensure container focus after cell clicks
After every `handleCellClick`, call:
```ts
requestAnimationFrame(() => tableRef.current?.focus());
```
This ensures Shift+Arrow keyboard events fire on the container div.

### 1C. Fix selection CSS specificity
Change selection class from `bg-blue-100` to `!bg-blue-100/80` (Tailwind `!important` modifier) so it can't be overridden by hover or banding backgrounds. Also add a subtle border to selected cells for extra visibility.

### 1D. Simplify `buildSelectedSet`
Include the anchor cell itself in the selection set (currently it's excluded when anchor === focus, which is correct, but add the focused cell to the set when there IS a range).

### Files modified:
- `src/hooks/useGridNavigation.ts` — full rewrite with consolidated state
- `src/components/LeftPanel/TimelineTable/TimelineCell.tsx` — update selection CSS classes

---

## Phase 2: Sticky Column Shadow + Distinct Background

### Changes:
- Label column `<td>` background: `bg-white` → `bg-slate-50` (distinct from data area)
- Header `<th>` for "Row": match `bg-slate-100`
- Add right shadow when scrolling: `shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]` on sticky `<td>` elements
- Add a subtle right border: `border-r-2 border-slate-200` instead of `border-r border-slate-100`

### Files modified:
- `src/pages/TimelinePage.tsx` — update `labelCell()`, `renderComputedRow()`, `renderOverrideRow()`, header `<th>`, and all group content renderers that have sticky `<td>` elements

---

## Phase 3: Inline Computed Sub-Rows

Add light-gray computed hint rows directly beneath each editable group section, showing remaining room / key values:

| Group | Sub-rows to add |
|-------|----------------|
| RRSP | `→ Room Remaining`, `→ EOY Balance` |
| TFSA | `→ Room Remaining`, `→ EOY Balance` |
| FHSA | `→ Room Remaining`, `→ Lifetime Contrib`, `→ EOY Balance` |
| Non-Reg & Savings | `→ Non-Reg EOY`, `→ Savings EOY` |
| Income | (already has Total Gross Income — add `→ Net Taxable Income`) |
| Capital Loss | (already has Loss C/F Balance) |

### Styling:
- Italic, `text-[9px]`, `text-slate-400`, indent with `pl-5`
- Light dashed top border to separate from editable rows above
- Not focusable/selectable in the grid (skip in ROW_REGISTRY or mark as non-nav)

### Files modified:
- `src/pages/TimelinePage.tsx` — add sub-rows in `renderGroupContent()` for each group
- `src/hooks/useGridNavigation.ts` — add hint rows to ROW_REGISTRY as non-editable

---

## Phase 4: Register New Computed Rows in ROW_REGISTRY

Update the static `ROW_REGISTRY` in TimelinePage to include the new inline computed sub-rows so they participate in keyboard navigation (as read-only cells you can arrow through and copy from).

---

## Implementation Order

1. **Phase 1** (multi-select fix) — highest priority, unblocks everything
2. **Phase 2** (sticky column styling) — quick visual win, independent
3. **Phase 3 + 4** (inline sub-rows) — adds the computed hints the user requested

## Verification

After each phase:
- Phase 1: Click cell A, Shift+click cell B → blue highlight rectangle appears. Shift+Arrow extends selection. Ctrl+C copies selected range. Delete clears selected cells.
- Phase 2: Scroll horizontally → label column stays fixed with visible shadow separating it from data
- Phase 3: Open RRSP group → see "Room Remaining: $XX,XXX" sub-row below the editable fields
