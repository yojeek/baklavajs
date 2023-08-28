import { AbstractNode, Graph, IConnection } from "@baklavajs/core";

export interface ITopologicalSortingResult {
    calculationOrder: AbstractNode[];
    connectionsFromNode: Map<AbstractNode, IConnection[]>;
    /** NodeInterface.id -> parent Node.id */
    interfaceIdToNodeId: Map<string, string>;
}

export class CycleError extends Error {
    public constructor() {
        super("Cycle detected");
    }
}

function isString(v: string | undefined): v is string {
    return typeof v === "string";
}

/**
 * Utility function to convert inputs to more useful data structures
 */
function nodesOrGraphToData(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    pConnections?: ReadonlyArray<IConnection>,
): {
    nodes: ReadonlyArray<AbstractNode>
    connections: ReadonlyArray<IConnection>
    interfaceIdToNodeId: Map<string, string>
    nodeIdToNode: Map<string, AbstractNode>
} {
    let nodes: ReadonlyArray<AbstractNode>;
    let connections: ReadonlyArray<IConnection>;
    const interfaceIdToNodeId = new Map<string, string>();

    // if (nodesOrGraph instanceof Graph) { <-- doesn't work with proxy
    if ("nodes" in nodesOrGraph && "connections" in nodesOrGraph) {
        nodes = nodesOrGraph.nodes;
        connections = nodesOrGraph.connections;
    } else {
        if (!pConnections) {
            throw new Error("Invalid argument value: expected array of connections");
        }
        nodes = nodesOrGraph;
        connections = pConnections;
    }

    nodes.forEach((n) => {
        Object.values(n.inputs).forEach((intf) => interfaceIdToNodeId.set(intf.id, n.id));
        Object.values(n.outputs).forEach((intf) => interfaceIdToNodeId.set(intf.id, n.id));
    });

    const nodeIdToNode = nodes.reduce((map, node) => {
        map.set(node.id, node);
        return map;
    }, new Map<string, AbstractNode>());

    return { nodes, connections, interfaceIdToNodeId, nodeIdToNode };
}

/** Uses Kahn's algorithm to topologically sort the nodes in the graph */
export function sortTopologically(graph: Graph): ITopologicalSortingResult;
/** Uses Kahn's algorithm to topologically sort the nodes in the graph */
export function sortTopologically(
    nodes: ReadonlyArray<AbstractNode>,
    connections: ReadonlyArray<IConnection>,
): ITopologicalSortingResult;
/** This overload is only used for internal purposes */
export function sortTopologically(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    connections?: ReadonlyArray<IConnection>,
): ITopologicalSortingResult;
export function sortTopologically(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    pConnections?: ReadonlyArray<IConnection>,
): ITopologicalSortingResult {
    /** Node.id -> set of connected node.id */
    const adjacency = new Map<string, Set<string>>();
    const connectionsFromNode = new Map<AbstractNode, IConnection[]>();

    const { nodes, connections, interfaceIdToNodeId } = nodesOrGraphToData(nodesOrGraph, pConnections);

    // build adjacency list
    nodes.forEach((n) => {
        const connectionsFromCurrentNode = connections.filter(
            (c) => c.from && interfaceIdToNodeId.get(c.from.id) === n.id,
        );
        const adjacentNodes = new Set<string>(
            connectionsFromCurrentNode.map((c) => interfaceIdToNodeId.get(c.to.id)).filter(isString),
        );
        adjacency.set(n.id, adjacentNodes);
        connectionsFromNode.set(n, connectionsFromCurrentNode);
    });

    // startNodes are all nodes that don't have any input connected
    const startNodes = nodes.slice();
    connections.forEach((c) => {
        const index = startNodes.findIndex((n) => interfaceIdToNodeId.get(c.to.id) === n.id);
        if (index >= 0) {
            startNodes.splice(index, 1);
        }
    });

    const sorted: AbstractNode[] = [];

    while (startNodes.length > 0) {
        const n = startNodes.pop()!;
        sorted.push(n);
        const nodesConnectedFromN = adjacency.get(n.id)!;
        while (nodesConnectedFromN.size > 0) {
            const mId: string = nodesConnectedFromN.values().next()!.value;
            nodesConnectedFromN.delete(mId);
            if (Array.from(adjacency.values()).every((connectedNodes) => !connectedNodes.has(mId))) {
                const m = nodes.find((node) => node.id === mId)!;
                startNodes.push(m);
            }
        }
    }

    if (Array.from(adjacency.values()).some((c) => c.size > 0)) {
        throw new CycleError();
    }

    return {
        calculationOrder: sorted,
        connectionsFromNode,
        interfaceIdToNodeId,
    };
}

/** Checks whether a graph contains a cycle */
export function containsCycle(graph: Graph): boolean;
/** Checks whether the provided set of nodes and connections contains a cycle */
export function containsCycle(nodes: ReadonlyArray<AbstractNode>, connections: ReadonlyArray<IConnection>): boolean;
export function containsCycle(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    connections?: ReadonlyArray<IConnection>,
): boolean {
    try {
        sortTopologically(nodesOrGraph, connections);
        return false;
    } catch (err) {
        if (err instanceof CycleError) {
            return true;
        }
        throw err;
    }
}

type GraphComponent = {
    nodes: Array<AbstractNode>;
    connections: Array<IConnection>;
};

export interface ISortedComponentResult extends Array<ITopologicalSortingResult> { }

export function connectedComponents(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    pConnections?: ReadonlyArray<IConnection>,
): GraphComponent[] {
    const { nodes, connections, interfaceIdToNodeId, nodeIdToNode } = nodesOrGraphToData(nodesOrGraph, pConnections);

    const successors = new Map<string, IConnection[]>();
    const predecessors = new Map<string, IConnection[]>();

    // build predecessors and successors list
    nodes.forEach((n) => {
        const connectionsFromCurrentNode = connections.filter(
            (c) => c.from && interfaceIdToNodeId.get(c.from.id) === n.id,
        );

        if (!predecessors.has(n.id)) {
            predecessors.set(n.id, []);
        }

        for (const connection of connectionsFromCurrentNode) {
            if (!predecessors.has(connection.to.nodeId)) {
                predecessors.set(connection.to.nodeId, []);
            }
            predecessors.get(connection.to.nodeId)!.push(connection);
        }

        successors.set(n.id, connectionsFromCurrentNode);
    });


    const components: Array<GraphComponent> = [];
    const visited = new Set<string>();

    function dfs(nodeId: string, component: GraphComponent) {
        if (visited.has(nodeId)) {
            return;
        }
        visited.add(nodeId);
        component.nodes.push(nodeIdToNode.get(nodeId)!);
        const nSuccessors = successors.get(nodeId)!;
        component.connections.push(...nSuccessors);
        for (const connection of nSuccessors) {
            dfs(connection.to.nodeId, component);
        }
        for (const connection of predecessors.get(nodeId)!) {
            dfs(connection.from.nodeId, component);
        }
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            const component: GraphComponent = { nodes: [], connections: [] };
            dfs(node.id, component);
            components.push(component);
        }
    }

    return components;
}

export function getSortedComponents(
    nodesOrGraph: ReadonlyArray<AbstractNode> | Graph,
    pConnections?: ReadonlyArray<IConnection>,
): ISortedComponentResult {
    const components = connectedComponents(nodesOrGraph, pConnections);
    return components.map((c) => sortTopologically(c.nodes, c.connections));
}
