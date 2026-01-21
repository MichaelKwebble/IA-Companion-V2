# Implementation Plan - Flowchart Visual Enhancements

## Rephrased Objective
Enhance the flowchart visualization to more accurately represent code structure and improve clarity. This involves implementing visual indentation for nested blocks, replacing curved paths with professional 90-degree orthogonal arrows, and fixing the visibility and positioning of loop-back connectors.

## Proposed Changes

### 1. Data Structure Updates (`src/utils/codeFlowParser.ts`)
- Add a `depth` property to `FlowNode` to track nesting levels.
- Update the recursive `processBlocks` function to increment/decrement depth.
- Implement horizontal offset logic based on `depth` (e.g., `x = xCenter + depth * indentationLevel`).

### 2. Layout & Connectivity Logic (`src/pages/Projects/IDE/components/FlowMap.tsx`)
- **Indentation Implementation**: Update node positioning to use the `depth` property for horizontal spacing.
- **Orthogonal Connector Function**: Create a helper to generate "L-shaped" or "U-shaped" paths (M -> H -> V) instead of simple straight or curved lines. 
- **Loop-back Connector Refinement**:
    - Specifically handle edges going back to a higher Y-coordinate.
    - Route these edges horizontally out from the node, then vertically up, then horizontally back in (90-degree turns).
- **Arrowhead Alignment**: Ensure SVG markers align correctly with horizontal and vertical terminal segments of the orthogonal paths.

### 3. Visual Styling (`src/pages/Projects/IDE/components/FlowMap.css`)
- Adjust transition timings for professional "snapping" of orthogonal lines.
- Refine node padding and spacing constants to accommodate indentation.

## Success Criteria
- [ ] Nodes inside `for`/`if` are visibly shifted to the right.
- [ ] All connecting lines use only 90-degree turns.
- [ ] The loop-back arrow from the end of a loop body to the header is clearly visible and avoids crossing over other nodes.
