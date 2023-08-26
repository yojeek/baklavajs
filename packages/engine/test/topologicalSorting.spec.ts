import { IConnection } from "@baklavajs/core";
import { TestNode } from "./testNode";
import { containsCycle, CycleError, sortTopologically, connectedComponents, getSortedComponents } from "../src";

describe("Topological Sorting", () => {
    it("detects a cycle", () => {
        const n1 = new TestNode();
        const n2 = new TestNode();
        const conn1: IConnection = { id: "a", from: n1.outputs.c, to: n2.inputs.a };
        const conn2: IConnection = { id: "b", from: n2.outputs.c, to: n1.inputs.a };

        expect(() => sortTopologically([n1, n2], [conn1, conn2])).toThrowError(CycleError);
        expect(containsCycle([n1, n2], [conn1, conn2])).toBe(true);
    });

    /**
     * node1 -> node2
     * node3
     * node4 -> node5
     *       -> node6
     */
    it('get connected components', () => {
        const node1 = new TestNode();
        const node2 = new TestNode();
        const node3 = new TestNode();
        const conn1: IConnection = { id: "a", from: node1.outputs.c, to: node2.inputs.a };

        const node4 = new TestNode();
        const node5 = new TestNode();
        const node6 = new TestNode();
        const conn2: IConnection = { id: "b", from: node4.outputs.c, to: node5.inputs.a };
        const conn3: IConnection = { id: "c", from: node4.outputs.c, to: node6.inputs.a };

        const components = connectedComponents(
            [node6, node5, node4, node3, node2, node1],
            [conn3, conn2, conn1]
        );
        
        // sort components by length
        components.sort((a, b) => b.nodes.length - a.nodes.length);

        expect(components[0].nodes).toHaveLength(3);
        expect(components[0].nodes).toEqual(expect.arrayContaining([node4, node5, node6]));
        expect(components[0].connections).toEqual(expect.arrayContaining([conn2, conn3]));
        expect(components[1].nodes).toEqual(expect.arrayContaining([node1, node2]));
        expect(components[1].connections).toEqual(expect.arrayContaining([conn1]));
        expect(components[2].nodes).toEqual([node3]);
        expect(components[2].connections).toEqual([]);
    })

    /**
     * node1 -> node2
     * node3
     * node4 -> node5
     *       -> node6
     */
    it('gets sorted connected components', () => {
        const node1 = new TestNode();
        const node2 = new TestNode();
        const node3 = new TestNode();
        const conn1: IConnection = { id: "a", from: node1.outputs.c, to: node2.inputs.a };

        const node4 = new TestNode();
        const node5 = new TestNode();
        const node6 = new TestNode();
        const conn2: IConnection = { id: "b", from: node4.outputs.c, to: node5.inputs.a };
        const conn3: IConnection = { id: "c", from: node4.outputs.c, to: node6.inputs.a };

        const components = getSortedComponents(
            [node1, node2, node3, node4, node5, node6],
            [conn1, conn2, conn3]
        );
        expect(components.length).toBe(3);
        // sort components by length
        components.sort((a, b) => b.calculationOrder.length - a.calculationOrder.length);

        expect(components[0].calculationOrder).toHaveLength(3);
        expect(components[0].calculationOrder[0]).toEqual(node4);
        expect(components[0].calculationOrder).toContain(node5);
        expect(components[0].calculationOrder).toContain(node6);
        expect(components[1].calculationOrder).toEqual([node1, node2]);
        expect(components[2].calculationOrder).toEqual([node3]);
    })
});
