import {Editor} from "@baklavajs/core";
import {applyResult, CalculationResult} from "../src";
import {TestNode} from "./testNode";

describe("applyResult", () => {
    it("correctly applies a calculation result", () => {
        const e = new Editor();
        const n1 = new TestNode();
        const n2 = new TestNode();
        const n3 = new TestNode();
        [n1, n2, n3].forEach((n) => e.graph.addNode(n));

        const calculationResult: CalculationResult = new Map([
            [
                n1.id,
                {
                    inputs: new Map(),
                    outputs: new Map([
                        ["c", 15],
                        ["d", 5],
                    ])
                },
            ],
            [
                n2.id,
                {
                    inputs: new Map(),
                    outputs: new Map([
                        ["c", 30],
                        ["d", 0],
                    ])
                },
            ],
            [
                n3.id,
                {
                    inputs: new Map(),
                    outputs: new Map([
                        ["c", 10],
                        ["d", 0],
                    ])
                },
            ],
        ]);

        applyResult(calculationResult, e);

        expect(n1.outputs.c.value).toEqual(15);
        expect(n1.outputs.d.value).toEqual(5);
        expect(n2.outputs.c.value).toEqual(30);
        expect(n2.outputs.d.value).toEqual(0);
        expect(n3.outputs.c.value).toEqual(10);
        expect(n3.outputs.d.value).toEqual(0);
    });

    it("doesn't fail on non-existing ids", () => {
        const e = new Editor();
        const n1 = new TestNode();
        e.graph.addNode(n1);
        const calculationResult = new Map([
            ["invalid", {
                inputs: new Map(),
                outputs: new Map([["invalid", 5]]),
            }],
            [n1.id, {
                inputs: new Map(),
                outputs: new Map([["invalid", 5]])
            }],
        ]);
        expect(() => applyResult(calculationResult, e)).not.toThrow();
    });

    it.todo("test subgraphs");
});
