import { AbstractGraphNode, AbstractNode } from "@baklavajs/core";
import { SubgraphControlNode, SubgraphInterfaceNode } from "../graph/subgraphInterfaceNodes";

function cloneNodeInterface(targetNode: AbstractNode, targetInterfaceKey: string) {
    // can only properly clone Vue interface by cloning the node
    const clonedNode = new (targetNode.constructor as any)();
    return clonedNode.inputs[targetInterfaceKey];
}

export function updateSubgraphNodeInterfaces(node: AbstractGraphNode) {
    if (!node.subgraph) {
        throw new Error(`GraphNode ${node.id} updateSubgraphNodeInterfaces called without subgraph being initialized`);
    }

    for (const graphInput of node.subgraph.inputs) {
        const subgraphInterfaceNode = node.subgraph.nodes.find(
            (n: any) => n instanceof SubgraphInterfaceNode && n.graphInterfaceId === graphInput.id,
        );

        if (subgraphInterfaceNode instanceof SubgraphControlNode) {
            const subgraphTargetInterface = node.subgraph.findNodeInterface(graphInput.nodeInterfaceId);

            if (!subgraphTargetInterface) {
                console.warn(`Could not find target interface for ${graphInput.nodeInterfaceId}`);
                continue;
            }

            const existingInterface = node.inputs[graphInput.id];

            // because we don't have reliable way to check if the interface was changed,
            // we just remove it and add it again
            if (existingInterface) {
                node.removeInput(existingInterface.name);
            }

            const targetNode = node.subgraph.findNodeById(subgraphTargetInterface?.nodeId);

            if (!targetNode) {
                console.warn(`Could not find target node for ${subgraphTargetInterface?.nodeId}`);
                continue;
            }

            let targetInterfaceKey;

            for (const [key, nodeInterface] of Object.entries(targetNode?.inputs)) {
                if (nodeInterface === subgraphTargetInterface) {
                    targetInterfaceKey = key;
                    break;
                }
            }

            // maybe redundant check
            if (!targetInterfaceKey) {
                console.warn(`Could not find target interface key for ${subgraphTargetInterface?.id}`);
                continue;
            }

            const clone = cloneNodeInterface(targetNode, targetInterfaceKey);

            if (existingInterface) {
                // attempt to restore interface value, may fail if new interface has different type
                try {
                    clone.value = existingInterface.value;
                } catch (e : any) {
                    console.warn(`Could not set value for ${existingInterface.id}: ${e.message}`);
                }
            }

            clone.name = subgraphInterfaceNode.inputs.name.value;

            node.addInput(graphInput.id, clone.setPort(false));
        }
    }
}
