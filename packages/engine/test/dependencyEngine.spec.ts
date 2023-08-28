import {Editor, NodeInterface, defineNode} from "@baklavajs/core";
import {TestNode} from "./testNode";
import {
    AfterNodeCalculationEventData,
    BeforeNodeCalculationEventData,
    DependencyEngine,
    allowMultipleConnections, applyResult,
} from "../src";

describe("DependencyEngine", () => {
    it("emits the beforeNodeCalculation and afterNodeCalculation events", async () => {
        const editor = new Editor();
        const n1 = editor.graph.addNode(new TestNode())!;
        const n2 = editor.graph.addNode(new TestNode())!;
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);

        const engine = new DependencyEngine<void>(editor);
        const beforeSpy = jest.fn();
        const afterSpy = jest.fn();
        engine.events.beforeNodeCalculation.subscribe("a", beforeSpy);
        engine.events.afterNodeCalculation.subscribe("b", afterSpy);

        n1.inputs.a.value = 2;
        n1.inputs.b.value = 3;
        n2.inputs.b.value = 4;

        await engine.runOnce();

        expect(beforeSpy).toHaveBeenCalledTimes(2);
        expect(beforeSpy.mock.calls[0][0]).toEqual({
            node: n1,
            inputValues: {
                a: 2,
                b: 3,
            },
        } as BeforeNodeCalculationEventData);
        expect(beforeSpy.mock.calls[1][0]).toEqual({
            node: n2,
            inputValues: {
                a: 5,
                b: 4,
            },
        } as BeforeNodeCalculationEventData);

        expect(afterSpy).toHaveBeenCalledTimes(2);
        expect(afterSpy.mock.calls[0][0]).toEqual({
            node: n1,
            outputValues: {
                c: 5,
                d: -1,
            },
        } as AfterNodeCalculationEventData);
        expect(afterSpy.mock.calls[1][0]).toEqual({
            node: n2,
            outputValues: {
                c: 9,
                d: 1,
            },
        } as AfterNodeCalculationEventData);
    });

    it("handles nodes without a calculate method", async () => {
        const editor = new Editor();
        const NoCalculationNode = defineNode({type: "NoCalculation"});
        editor.graph.addNode(new NoCalculationNode());
        const engine = new DependencyEngine<void>(editor);
        expect(await engine.runOnce()).toEqual(new Map());
    });

    it("allows using multiple connections", async () => {
        const editor = new Editor();
        const spy = jest.fn();
        const MultiNode = defineNode({
            type: "MultiNode",
            inputs: {
                a: () => new NodeInterface<number[]>("a", [0]).use(allowMultipleConnections),
            },
            calculate({a}) {
                spy(a);
                return {};
            },
        });
        const n1 = editor.graph.addNode(new TestNode())!;
        const n2 = editor.graph.addNode(new MultiNode())!;
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);
        editor.graph.addConnection(n1.outputs.d, n2.inputs.a);

        const engine = new DependencyEngine<void>(editor);
        await engine.runOnce();

        expect(spy).toHaveBeenCalledWith([2, 0]);
    });

    it("calculate nodes only in connected components", async () => {
        const editor = new Editor();
        const n1 = editor.graph.addNode(new TestNode())!;
        const n1calculateSpy = jest.spyOn(n1, "calculate");
        const n2 = editor.graph.addNode(new TestNode())!;
        const n2calculateSpy = jest.spyOn(n2, "calculate");
        const n3 = editor.graph.addNode(new TestNode())!;
        const n3calculateSpy = jest.spyOn(n3, "calculate");
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);

        const engine = new DependencyEngine<void>(editor);
        engine.updatedNode = n1;

        const result = (await engine.runOnce())!;

        expect(n1calculateSpy).toHaveBeenCalled();
        expect(n2calculateSpy).toHaveBeenCalled();
        expect(n3calculateSpy).not.toHaveBeenCalled();
        expect(result.size).toEqual(2);
        expect(Object.fromEntries(result.get(n1.id)!.outputs.entries())).toMatchObject({c: 2, d: 0});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toMatchObject({c: 3, d: 1});
    });

    /**
     * n1 -> n2 -> n4
     * n1 -> n3 -> n4
     */
    it("should work on complex graph", async () => {
        const editor = new Editor();
        const n1 = new TestNode();
        const n2 = new TestNode();
        const n3 = new TestNode();
        const n4 = new TestNode();
        [n1, n2, n3, n4].forEach((n) => editor.graph.addNode(n));
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);
        editor.graph.addConnection(n1.outputs.d, n3.inputs.a);
        editor.graph.addConnection(n2.outputs.c, n4.inputs.a);
        editor.graph.addConnection(n3.outputs.d, n4.inputs.b);
        const engine = new DependencyEngine<void>(editor);
        const result = (await engine.runOnce())!;
        expect(result.size).toEqual(4);
        expect(Object.fromEntries(result.get(n1.id)!.outputs.entries())).toMatchObject({c: 2, d: 0});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toMatchObject({c: 3, d: 1});
        expect(Object.fromEntries(result.get(n3.id)!.outputs.entries())).toMatchObject({c: 1, d: -1});
        expect(Object.fromEntries(result.get(n4.id)!.outputs.entries())).toMatchObject({c: 2, d: 4});
    });

    it("should calculate only nodes affected by the updated node", async () => {
        const editor = new Editor();
        const n1 = new TestNode();
        const n2 = new TestNode();
        const n3 = new TestNode();
        n1.title = "n1";
        n2.title = "n2";
        n3.title = "n3";
        [n1, n2, n3].forEach((n) => editor.graph.addNode(n));
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);
        editor.graph.addConnection(n2.outputs.c, n3.inputs.a);
        const engine = new DependencyEngine<void>(editor);
        // initial calculation
        let result = (await engine.runOnce())!;
        expect(Object.fromEntries(result.get(n2.id)!.inputs.entries())).toEqual({a: 2, b: 1});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toEqual({c: 3, d: 1});
        expect(Object.fromEntries(result.get(n3.id)!.inputs.entries())).toEqual({a: 3, b: 1});
        expect(Object.fromEntries(result.get(n3.id)!.outputs.entries())).toEqual({c: 4, d: 2});
        applyResult(result, editor);
        // calculation with updated node
        const n1calculateSpy = jest.spyOn(n1, "calculate");
        const n2calculateSpy = jest.spyOn(n2, "calculate");
        const n3calculateSpy = jest.spyOn(n3, "calculate");
        n2.inputs.a.value = 3;
        engine.updatedNode = n2;
        result = (await engine.runOnce())!;
        expect(result.size).toEqual(2);
        expect(Object.fromEntries(result.get(n2.id)!.inputs.entries())).toEqual({a: 3, b: 1});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toEqual({c: 4, d: 2});
        expect(Object.fromEntries(result.get(n3.id)!.inputs.entries())).toEqual({a: 4, b: 1});
        expect(Object.fromEntries(result.get(n3.id)!.outputs.entries())).toEqual({c: 5, d: 3});
        expect(n1calculateSpy).not.toHaveBeenCalled();
        expect(n2calculateSpy).toHaveBeenCalled();
        expect(n3calculateSpy).toHaveBeenCalled();
    });

    it("should not recalculate node if inputs weren't changed", async () => {
        const editor = new Editor();
        const n1 = new TestNode();
        const n2 = new TestNode();
        n1.title = "n1";
        n2.title = "n2";
        [n1, n2].forEach((n) => editor.graph.addNode(n));
        editor.graph.addConnection(n1.outputs.c, n2.inputs.a);
        const engine = new DependencyEngine<void>(editor);
        // initial calculation
        let result = (await engine.runOnce())!;
        expect(Object.fromEntries(result.get(n1.id)!.inputs.entries())).toEqual({a: 1, b: 1});
        expect(Object.fromEntries(result.get(n1.id)!.outputs.entries())).toEqual({c: 2, d: 0});
        expect(Object.fromEntries(result.get(n2.id)!.inputs.entries())).toEqual({a: 2, b: 1});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toEqual({c: 3, d: 1});
        applyResult(result, editor);
        // calculation with updated node
        const n1calculateSpy = jest.spyOn(n1, "calculate");
        const n2calculateSpy = jest.spyOn(n2, "calculate");
        engine.updatedNode = n1;
        result = (await engine.runOnce())!;
        expect(result.size).toEqual(2);
        expect(Object.fromEntries(result.get(n1.id)!.inputs.entries())).toEqual({a: 1, b: 1});
        expect(Object.fromEntries(result.get(n1.id)!.outputs.entries())).toEqual({c: 2, d: 0});
        expect(Object.fromEntries(result.get(n2.id)!.inputs.entries())).toEqual({a: 2, b: 1});
        expect(Object.fromEntries(result.get(n2.id)!.outputs.entries())).toEqual({c: 3, d: 1});
        expect(n1calculateSpy).toHaveBeenCalled();
        expect(n2calculateSpy).not.toHaveBeenCalled();
    });
});
