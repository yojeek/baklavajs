import type {AbstractNode, Editor, Graph, NodeInterface} from "@baklavajs/core";
import {BaseEngine, CalculationResult} from "./baseEngine";
import {getSortedComponents, ITopologicalSortingResult} from "./topologicalSorting";

export const allowMultipleConnections = <T extends Array<any>>(intf: NodeInterface<T>) => {
    intf.allowMultipleConnections = true;
};

export class DependencyEngine<CalculationData = any> extends BaseEngine<CalculationData, []> {
    private order: Map<string, ITopologicalSortingResult[]> = new Map();
    updatedNode: AbstractNode | undefined;

    public constructor(editor: Editor) {
        super(editor);
    }

    public override start() {
        super.start();
        this.recalculateOrder = true;
        void this.calculateWithoutData();
    }

    public override async runGraph(
        graph: Graph,
        inputs: Map<string, any>,
        calculationData: CalculationData,
    ): Promise<CalculationResult> {
        if (!this.order.has(graph.id)) {
            this.order.set(graph.id, getSortedComponents(graph));
        }

        const result: CalculationResult = new Map();

        const calculateComponent = async (sortedComponent: ITopologicalSortingResult) => {
            const { calculationOrder, connectionsFromNode } = sortedComponent;

            for (let i = 0; i < calculationOrder.length; i++) {
                const node = calculationOrder[i];

                if (!node.calculate) {
                    continue;
                }

                const inputValues: Record<string, any> = {};
                let inputsChanged: Record<string, boolean> = {};

                Object.entries(node.inputs).forEach(([k, intf]: [string, NodeInterface]) => {
                    inputValues[k] = inputs.has(intf.id) ? inputs.get(intf.id) : intf.value;

                    // @hack to get rid of vue proxies without importing vue methods in the engine
                    if (node.isInterfaceEqualTo) {
                        inputsChanged[k] = !node.isInterfaceEqualTo(intf, inputValues[k]);
                    } else {
                        inputsChanged[k] = inputValues[k] !== intf.value;
                    }
                });

                this.events.beforeNodeCalculation.emit({ inputValues, node });

                let outputValues: Record<string, any>;

                // to avoid extra calculations, make following checks
                // - if no updated node provided, calculate all
                // - if the node is the updated node, calculate it
                // - if node has alwaysRecalculate flag, do as stated
                // - if the node is not the updated node, check if inputs changed
                if (!updatedNode || node.id === updatedNode.id || node.alwaysRecalculate || Object.values(inputsChanged).filter(v => !!v).length) {
                    outputValues = await node.calculate(inputValues, { globalValues: calculationData, engine: this })
                } else {
                    // collect current output values
                    outputValues = Object.fromEntries(Object.entries(node.outputs).map(([k, v]) => [k, v.value]));
                }

                this.validateNodeCalculationOutput(node, outputValues);
                this.events.afterNodeCalculation.emit({ outputValues, node });

                result.set(node.id, {
                    inputs: new Map(Object.entries(inputValues)),
                    outputs: new Map(Object.entries(outputValues)),
                });

                const subgraphResult : Map<string, any> = outputValues._calculationResults;

                if (subgraphResult) {
                    subgraphResult.forEach((v, k) => {
                        result.set(k, {
                            inputs: v.inputs,
                            outputs: v.outputs,
                        });
                    })
                }

                if (connectionsFromNode.has(node)) {
                    connectionsFromNode.get(node)!.forEach((connection) => {
                        const intfKey = Object.entries(node.outputs).find(([, intf]) => intf.id === connection.from.id)?.[0];
                        if (!intfKey) {
                            throw new Error(
                                `Could not find key for interface ${connection.from.id}\n` +
                                    "This is likely a Baklava internal issue. Please report it on GitHub.",
                            );
                        }
                        const v = this.hooks.transferData.execute(outputValues[intfKey], connection);
                        if (connection.to.allowMultipleConnections) {
                            if (inputs.has(connection.to.id)) {
                                (inputs.get(connection.to.id)! as Array<any>).push(v);
                            } else {
                                inputs.set(connection.to.id, [v]);
                            }
                        } else {
                            inputs.set(connection.to.id, v);
                        }
                    });
                }
            }
        }

        const updatedNode = this.updatedNode;
        this.updatedNode = undefined;

        for (const component of this.order.get(graph.id)!) {
            // if (updatedNode && !component.calculationOrder.includes(updatedNode)) { <- doesn't work with proxies ?
            if (updatedNode && !component.calculationOrder.find((n) => n.id === updatedNode.id)) {
                continue;
            }

            await calculateComponent(component);
        }

        return result;
    }

    protected override async execute(calculationData: CalculationData): Promise<CalculationResult> {
        if (this.recalculateOrder) {
            this.order.clear();
            this.recalculateOrder = false;
        }

        // gather all values of the unconnected inputs
        // maps NodeInterface.id -> value
        // the reason it is done here and not during calculation is that this
        // way we prevent race conditions because calculations can be async
        const inputValues = new Map<string, any>();
        for (const n of this.editor.graph.nodes) {
            Object.values(n.inputs).forEach((ni) => {
                if (ni.connectionCount === 0) {
                    inputValues.set(ni.id, ni.value);
                }
            });
        }

        return await this.runGraph(this.editor.graph, inputValues, calculationData);
    }

    protected onChange(recalculateOrder: boolean, updatedNode?: AbstractNode): void {
        this.recalculateOrder = recalculateOrder || this.recalculateOrder;
        this.updatedNode = updatedNode;
        void this.calculateWithoutData();
    }
}
