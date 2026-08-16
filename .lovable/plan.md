# Fix: aim handle keeps rotating the first waypoint you dragged

## What's happening

Confirmed in `src/components/map/site-map.tsx` (lines 300-352). The drag handler for the round aim handle is created **once**, at the moment the handle marker is first added to the map, and it closes over the waypoint list and selected key from that render. Selecting a different waypoint moves the handle to the new waypoint, but the handler still resolves the *original* waypoint, so every drag writes the heading back to that first waypoint.

```text
select WP 01  ->  handle created, handler captures key = WP 01
select WP 03  ->  handle repositioned over WP 03
drag handle   ->  handler still emits heading for WP 01   <-- bug
```

## The fix

Follow the pattern already used elsewhere in the same file (`aimRef`, `poiRef`, `headingChangeRef`): store the current selection in a ref that is refreshed on every render, and have the drag handler read from that ref instead of from its closure.

- Add a ref holding the currently selected waypoint's key and its origin latitude/longitude, updated each render.
- Rewrite the handle's `drag` / `dragend` handler to compute the bearing from that ref's origin to the handle position, and emit against the ref's key.
- Keep the handler attached once (no listener churn), so dragging stays smooth.

## Also corrected in the same pass

- While the handle is being dragged, skip the effect's `setLngLat` reposition so the handle doesn't fight the pointer if a heading round-trip lands mid-drag.
- Clear the aim handle when selection changes to a waypoint whose heading mode is derived (Face center / Follow path / Lock to POI) is already handled upstream; no change needed there.

## Verification

Drive the planner in a browser: select waypoint 01, drag the handle, confirm 01's bearing changes; then select waypoint 03, drag, and confirm 03 changes while 01 keeps its value. Repeat once more with a third waypoint to prove the handler is no longer sticky.
