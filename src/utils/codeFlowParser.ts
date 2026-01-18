/**
 * Code Flow Parser
 * Analyzes Arduino/C++ code and generates flowchart nodes and edges
 */

export interface FlowNode {
    id: string;
    label: string;
    type: 'start' | 'process' | 'decision' | 'end' | 'loop';
    x: number;
    y: number;
}

export interface FlowEdge {
    id: string;
    from: string;
    to: string;
    label?: string;
}

export interface FlowData {
    nodes: FlowNode[];
    edges: FlowEdge[];
}

interface ParsedBlock {
    type: 'function' | 'if' | 'else' | 'for' | 'while' | 'statement';
    name?: string;
    condition?: string;
    content: string;
    startLine: number;
    endLine: number;
}

/**
 * Parse Arduino/C++ code and generate flowchart data
 */
export function parseCodeToFlow(code: string): FlowData {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    if (!code || code.trim() === '') {
        return { nodes, edges };
    }

    let nodeId = 1;
    let yPosition = 50;
    const xCenter = 200;
    const ySpacing = 100;

    // Helper to add a node
    const addNode = (label: string, type: FlowNode['type']): FlowNode => {
        const node: FlowNode = {
            id: String(nodeId++),
            label,
            type,
            x: xCenter,
            y: yPosition
        };
        nodes.push(node);
        yPosition += ySpacing;
        return node;
    };

    // Helper to add an edge
    const addEdge = (from: string, to: string, label?: string) => {
        edges.push({
            id: `e${from}-${to}`,
            from,
            to,
            label
        });
    };

    // Find function definitions
    const functionRegex = /\b(void|int|float|double|char|bool|String)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    const functions: { name: string; index: number }[] = [];
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
        functions.push({ name: match[2], index: match.index });
    }

    // If no functions found, treat entire code as a block
    if (functions.length === 0) {
        const startNode = addNode('Start', 'start');
        const processNode = addNode('Code Block', 'process');
        const endNode = addNode('End', 'end');

        addEdge(startNode.id, processNode.id);
        addEdge(processNode.id, endNode.id);

        return { nodes, edges };
    }

    // Parse each function
    functions.forEach((func) => {
        // Get function body
        const startIdx = code.indexOf('{', func.index);
        let braceCount = 1;
        let endIdx = startIdx + 1;

        while (braceCount > 0 && endIdx < code.length) {
            if (code[endIdx] === '{') braceCount++;
            if (code[endIdx] === '}') braceCount--;
            endIdx++;
        }

        const functionBody = code.substring(startIdx + 1, endIdx - 1);

        // Add function start node
        const funcStartNode = addNode(`${func.name}()`, 'start');
        let lastNodeId = funcStartNode.id;

        // Parse control structures in function body
        const controlFlowParsed = parseControlFlow(functionBody);

        controlFlowParsed.forEach(block => {
            let currentNode: FlowNode;

            switch (block.type) {
                case 'if':
                    currentNode = addNode(block.condition || 'condition?', 'decision');
                    addEdge(lastNodeId, currentNode.id);

                    // True branch (process block)
                    const trueNode = addNode(block.name || 'Process', 'process');
                    trueNode.x = xCenter - 80;
                    addEdge(currentNode.id, trueNode.id, 'Yes');

                    // For now, both branches continue to next
                    lastNodeId = currentNode.id;

                    // Create a merge point after if
                    const mergeNode = addNode('Continue', 'process');
                    addEdge(trueNode.id, mergeNode.id);
                    addEdge(currentNode.id, mergeNode.id, 'No');
                    lastNodeId = mergeNode.id;
                    break;

                case 'for':
                case 'while':
                    currentNode = addNode(block.condition || `${block.type} loop`, 'loop');
                    addEdge(lastNodeId, currentNode.id);

                    // Loop body
                    const loopBody = addNode('Loop Body', 'process');
                    addEdge(currentNode.id, loopBody.id, 'True');
                    addEdge(loopBody.id, currentNode.id); // Loop back

                    lastNodeId = currentNode.id;
                    break;

                case 'statement':
                default:
                    if (block.content.trim()) {
                        // Extract meaningful label from statement
                        const label = extractStatementLabel(block.content);
                        if (label) {
                            currentNode = addNode(label, 'process');
                            addEdge(lastNodeId, currentNode.id);
                            lastNodeId = currentNode.id;
                        }
                    }
                    break;
            }
        });

        // Add function end node
        const funcEndNode = addNode(`End ${func.name}`, 'end');
        addEdge(lastNodeId, funcEndNode.id);

        // Add spacing between functions
        yPosition += 50;
    });

    return { nodes, edges };
}

/**
 * Parse control flow structures from code block
 */
function parseControlFlow(code: string): ParsedBlock[] {
    const blocks: ParsedBlock[] = [];
    const lines = code.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        if (!line || line.startsWith('//')) {
            i++;
            continue;
        }

        // Check for if statement
        const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?/);
        if (ifMatch) {
            blocks.push({
                type: 'if',
                condition: ifMatch[1].trim(),
                content: line,
                startLine: i,
                endLine: i
            });
            i++;
            continue;
        }

        // Check for for loop
        const forMatch = line.match(/^for\s*\((.+)\)\s*\{?/);
        if (forMatch) {
            blocks.push({
                type: 'for',
                condition: forMatch[1].trim(),
                content: line,
                startLine: i,
                endLine: i
            });
            i++;
            continue;
        }

        // Check for while loop
        const whileMatch = line.match(/^while\s*\((.+)\)\s*\{?/);
        if (whileMatch) {
            blocks.push({
                type: 'while',
                condition: whileMatch[1].trim(),
                content: line,
                startLine: i,
                endLine: i
            });
            i++;
            continue;
        }

        // Regular statement
        if (line && !line.match(/^[{}]$/)) {
            blocks.push({
                type: 'statement',
                content: line,
                startLine: i,
                endLine: i
            });
        }

        i++;
    }

    return blocks;
}

/**
 * Extract a meaningful label from a code statement
 */
function extractStatementLabel(statement: string): string | null {
    const trimmed = statement.trim();

    // Skip braces and empty
    if (!trimmed || trimmed === '{' || trimmed === '}') {
        return null;
    }

    // Function call: functionName(...)
    const funcCallMatch = trimmed.match(/^(\w+)\s*\(/);
    if (funcCallMatch) {
        return `${funcCallMatch[1]}()`;
    }

    // Variable assignment: var = value
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+);?$/);
    if (assignMatch) {
        const varName = assignMatch[1];
        const value = assignMatch[2].substring(0, 15);
        return `${varName} = ${value}${assignMatch[2].length > 15 ? '...' : ''}`;
    }

    // pinMode, digitalWrite, analogRead etc
    const arduinoFuncMatch = trimmed.match(/^(pinMode|digitalWrite|digitalRead|analogWrite|analogRead|Serial\.\w+)\s*\(/);
    if (arduinoFuncMatch) {
        // Extract the full call but truncate if too long
        const endParen = trimmed.indexOf(')');
        if (endParen > 0) {
            const call = trimmed.substring(0, Math.min(endParen + 1, 25));
            return call + (endParen > 24 ? '...' : '');
        }
    }

    // Declaration: type var = value
    const declMatch = trimmed.match(/^(int|float|double|char|bool|String|long|unsigned)\s+(\w+)/);
    if (declMatch) {
        return `Declare ${declMatch[2]}`;
    }

    // Return statement
    if (trimmed.startsWith('return')) {
        return 'Return';
    }

    // delay()
    const delayMatch = trimmed.match(/delay\((\d+)\)/);
    if (delayMatch) {
        return `Delay ${delayMatch[1]}ms`;
    }

    // Truncate long statements
    if (trimmed.length > 20) {
        return trimmed.substring(0, 17) + '...';
    }

    return trimmed.replace(';', '');
}
