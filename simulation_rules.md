# Educator Simulation Rules for Flowchart Logic

To ensure students and basic engineers are not misled by the visualization, the following "Standard Engineering Rules" are enforced during playback:

### 1. The Arduino Lifecycle Principle
*   **SETUP Node**: Always runs first and exactly **once**.
*   **LOOP Node**: Runs infinitely. As soon as the "End loop" node is reached, the flow jumps back to the "loop()" starting node instantly.

### 2. Strict Loop Termination
*   **Condition Check**: A loop doesn't just "feel" when it's done. The simulation must show the final state where the condition evaluates to **False**.
*   **Example**: `for(int x=0; x<9; x++)` will show `x` incrementing up to `9`. The flow will then enter the loop node with `x=9`, evaluate the failure, and follow the **False/Exit** edge.

### 3. Scope & Memory Reset
*   **Variable Lifetime**: Any variable declared inside a block (e.g., `int x` inside a `for` loop) is reset to its initial value every time the loop or function is re-entered. 
*   **Persistence**: Variables defined at the top of `loop()` (if they are reassigned) should reflect their last known state until the function restarts.

### 4. Deterministic Decision Paths
*   **Logic Evaluation**: Where possible (e.g., `x % 2 == 0`), the simulation will calculate the actual boolean result based on the tracked variable's current value instead of just toggling between Yes/No.

### 5. The "Safety Valve" (Anti-Freeze)
*   **Demo Cap**: For educational clarity and browser performance, the simulation runs a maximum of **10 iterations** for any specific loop before forcing an exit or a reset, unless the termination condition is met naturally.

### 6. Visual Consistency
*   **Sync**: The code editor highlight and the flowchart "Running" dot must never be more than one step out of sync.
