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
    depth: number;
    parentLoopId?: string;
    lineNumbers?: number[];
    loopInfo?: {
        variable: string;
        start: number;
        end: number;
        step: number;
        type: 'for' | 'while';
    };
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
    arrays?: Record<string, any[]>;
}

interface ParsedBlock {
    type: 'function' | 'if' | 'else' | 'for' | 'while' | 'statement';
    name?: string;
    condition?: string;
    content: string;
    body?: ParsedBlock[]; // Represent nested structure
    startLine: number;
    endLine: number;
}

/**
 * Parse Arduino/C++ code and generate flowchart data
 */
export function parseCodeToFlow(code: string): FlowData {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const arrays: Record<string, any[]> = {};

    if (!code || code.trim() === '') {
        return { nodes, edges, arrays };
    }

    let nodeId = 1;
    let yPosition = 50;
    const xCenter = 200;
    const ySpacing = 100;

    // Helper to add a node
    const addNode = (label: string, type: FlowNode['type'], depth: number = 0, parentLoopId?: string, lineNumbers?: number[], loopInfo?: FlowNode['loopInfo']): FlowNode => {
        const node: FlowNode = {
            id: `node_${nodeId++}`,
            label,
            type,
            x: xCenter + depth * 40, // Visual indentation
            y: yPosition,
            depth,
            parentLoopId,
            lineNumbers,
            loopInfo
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

    // Detect global declarations and statements outside functions
    const globalLines = code.split('\n');
    let braceLevel = 0;
    const globalStatements: { content: string, line: number }[] = [];

    globalLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

        // Track braces to skip function bodies
        const open = (trimmed.match(/\{/g) || []).length;
        const close = (trimmed.match(/\}/g) || []).length;

        if (braceLevel === 0 && !trimmed.match(/\w+\s*\([^)]*\)\s*\{/)) {
            // It's a top-level statement (declaration)
            if (trimmed.includes(';') || (trimmed.includes('=') && !trimmed.includes('('))) {
                globalStatements.push({ content: trimmed, line: idx });
            }
        }

        braceLevel += open - close;
    });

    if (globalStatements.length > 0) {
        const globalStart = addNode('Global Config', 'start');
        let lastId = globalStart.id;

        globalStatements.forEach(stmt => {
            const label = extractStatementLabel(stmt.content);
            if (label) {
                const node = addNode(label, 'process', 0, undefined, [stmt.line]);
                addEdge(lastId, node.id);
                lastId = node.id;
            }
        });

        // Connect to first function if exists, or end
        if (functions.length > 0) {
            // We'll let functions handle their own start, 
            // but we've now at least identified the global variables
        }
    }

    // Detect array declarations: int arr[] = {1, 2, 3};
    const arrayRegex = /(?:int|float|double|char|bool)\s+(\w+)\[(\d*)\]\s*=\s*\{([^}]+)\}/g;
    let arrayMatch;
    while ((arrayMatch = arrayRegex.exec(code)) !== null) {
        const name = arrayMatch[1];
        const values = arrayMatch[3].split(',').map(v => {
            const trimmed = v.trim();
            return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
        });
        arrays[name] = values;
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

        // Calculate function start line
        const beforeContent = code.substring(0, func.index);
        const funcStartLine = beforeContent.split('\n').length - 1;
        const bodyStartLine = code.substring(0, startIdx + 1).split('\n').length - 1;

        // Add function start node
        const funcStartNode = addNode(`${func.name}()`, 'start', 0, undefined, [funcStartLine]);
        let lastNodeId = funcStartNode.id;

        // Parse control structures in function body
        const controlFlowParsed = parseControlFlow(functionBody, bodyStartLine);

        // Recursive helper to build nodes from blocks
        const processBlocks = (blocks: ParsedBlock[], currentLastNodeId: string, depth: number = 0, parentLoopId?: string): string => {
            let lastId = currentLastNodeId;

            blocks.forEach(block => {
                let currentNode: FlowNode;

                switch (block.type) {
                    case 'if':
                        currentNode = addNode(block.condition || 'condition?', 'decision', depth, parentLoopId, [block.startLine]);
                        addEdge(lastId, currentNode.id);

                        // Process body if exists
                        if (block.body && block.body.length > 0) {
                            const bodyLastId = processBlocks(block.body, currentNode.id, depth + 1, parentLoopId);

                            // Adjust edge label to Yes for the first node of body
                            const yesEdge = edges.find(e => e.from === currentNode.id && !e.label);
                            if (yesEdge) yesEdge.label = 'Yes';

                            // Merge point
                            const mergeNode = addNode('Continue', 'process', depth, parentLoopId);
                            addEdge(bodyLastId, mergeNode.id);
                            addEdge(currentNode.id, mergeNode.id, 'No');
                            lastId = mergeNode.id;
                        } else {
                            // Empty if
                            const mergeNode = addNode('Continue', 'process', depth, parentLoopId);
                            addEdge(currentNode.id, mergeNode.id, 'Yes');
                            addEdge(currentNode.id, mergeNode.id, 'No');
                            lastId = mergeNode.id;
                        }
                        break;

                    case 'for':
                    case 'while':
                        let loopInfo: FlowNode['loopInfo'] | undefined;
                        if (block.type === 'for' && block.condition) {
                            const parts = block.condition.split(';');
                            if (parts.length === 3) {
                                const initMatch = parts[0].match(/(\w+)\s*=\s*(\d+)/);
                                const condMatch = parts[1].match(/(\w+)\s*[<>]=?\s*(\d+)/);
                                const stepMatch = parts[2].match(/(\w+)\s*(\+\+|--|\+=|-=)\s*(\d+)?/);
                                if (initMatch && condMatch) {
                                    loopInfo = {
                                        variable: initMatch[1],
                                        start: parseInt(initMatch[2]),
                                        end: parseInt(condMatch[2]),
                                        step: stepMatch ? (stepMatch[2].includes('+') ? 1 : -1) : 1,
                                        type: 'for'
                                    };
                                }
                            }
                        }

                        currentNode = addNode(block.condition || `${block.type} loop`, 'loop', depth, parentLoopId, [block.startLine], loopInfo);
                        addEdge(lastId, currentNode.id);

                        if (block.body && block.body.length > 0) {
                            const bodyLastId = processBlocks(block.body, currentNode.id, depth + 1, currentNode.id); // Pass current loop's ID as parentLoopId
                            const trueEdge = edges.find(e => e.from === currentNode.id && !e.label);
                            if (trueEdge) trueEdge.label = 'True';
                            addEdge(bodyLastId, currentNode.id); // Loop back
                        } else {
                            // Empty loop body
                            const dummyBody = addNode('Pass', 'process', depth + 1, currentNode.id);
                            addEdge(currentNode.id, dummyBody.id, 'True');
                            addEdge(dummyBody.id, currentNode.id);
                        }

                        // Exit logic: Find where the loop goes NEXT
                        // Create a specific exit marker/anchor node if needed?
                        // For now we use the condition node as the lastId so next stuff attaches to it
                        lastId = currentNode.id;
                        break;

                    case 'statement':
                    default:
                        if (block.content.trim()) {
                            const label = extractStatementLabel(block.content);
                            if (label) {
                                currentNode = addNode(label, 'process', depth, parentLoopId, [block.startLine]);
                                addEdge(lastId, currentNode.id);
                                lastId = currentNode.id;
                            }
                        }
                        break;
                }
            });

            return lastId;
        };

        lastNodeId = processBlocks(controlFlowParsed, lastNodeId, 0);

        // Add function end node
        const funcEndLine = code.substring(0, endIdx).split('\n').length - 1;
        const funcEndNode = addNode(`End ${func.name}`, 'end', 0, undefined, [funcEndLine]);
        addEdge(lastNodeId, funcEndNode.id);

        // Add spacing between functions
        yPosition += 50;
    });

    return { nodes, edges, arrays };
}

/**
 * Parse control flow structures from code block
 */
/**
 * Parse control flow structures from code block with balance brace support for nesting
 */
function parseControlFlow(code: string, baseLine: number = 0): ParsedBlock[] {
    const blocks: ParsedBlock[] = [];
    const lines = code.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        if (!line || line.startsWith('//')) {
            i++;
            continue;
        }

        // Helper to find block body
        const extractBody = (startIndex: number) => {
            let braceCount = 0;
            let foundStart = false;
            let bodyLines: string[] = [];
            let j = startIndex;

            for (; j < lines.length; j++) {
                const curLine = lines[j];
                if (curLine.includes('{')) {
                    if (!foundStart) foundStart = true;
                    braceCount += (curLine.match(/\{/g) || []).length;
                }
                if (curLine.includes('}')) {
                    if (!foundStart) foundStart = true;
                    braceCount -= (curLine.match(/\}/g) || []).length;
                }

                if (foundStart) {
                    bodyLines.push(curLine);
                    if (braceCount <= 0) break;
                } else if (curLine.includes(';')) {
                    // Single line block without braces (e.g. if(c) stmnt;)
                    bodyLines.push(curLine);
                    break;
                }
            }

            // Extract code between first { and last }
            let fullBodyCode = bodyLines.join('\n');
            let innerCode = '';
            const firstBrace = fullBodyCode.indexOf('{');
            const lastBrace = fullBodyCode.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                innerCode = fullBodyCode.substring(firstBrace + 1, lastBrace);
            } else {
                // No braces, single statement. Remove the control line if included.
                innerCode = fullBodyCode;
            }

            return { innerCode, endLine: j };
        };

        // Check for control structures
        const ifMatch = line.match(/^if\s*\((.+)\)/);
        const forMatch = line.match(/^for\s*\((.+)\)/);
        const whileMatch = line.match(/^while\s*\((.+)\)/);

        if (ifMatch || forMatch || whileMatch) {
            const type = ifMatch ? 'if' : (forMatch ? 'for' : 'while');
            const condition = ifMatch ? ifMatch[1] : (forMatch ? forMatch[1] : whileMatch![1]);

            const { innerCode, endLine } = extractBody(i);

            // Calculate body start line relative to code
            // The body starts after the { line.
            const bodyStartLineOffset = lines[i].includes('{') ? 1 : 0;

            blocks.push({
                type: type as any,
                condition: condition.trim(),
                content: line,
                body: innerCode.trim() ? parseControlFlow(innerCode, baseLine + i + bodyStartLineOffset) : [],
                startLine: baseLine + i,
                endLine: baseLine + endLine
            });

            i = endLine + 1;
            continue;
        }

        // Regular statement
        if (line && !line.match(/^[{}]$/)) {
            blocks.push({
                type: 'statement',
                content: line,
                startLine: baseLine + i,
                endLine: baseLine + i
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
    const declMatch = trimmed.match(/^(int|float|double|char|bool|String|long|unsigned)\s+([a-zA-Z_]\w*)\s*(?:=\s*(.+);?)?$/);
    if (declMatch) {
        const varName = declMatch[2];
        const value = declMatch[3];
        if (value) {
            const truncated = value.substring(0, 15);
            return `${varName} = ${truncated}${value.length > 15 ? '...' : ''}`;
        }
        return `Declare ${varName}`;
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
