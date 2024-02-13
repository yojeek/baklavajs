export interface ICommand<Returns = any, Arguments extends Array<any> = []> {
    execute(...args: Arguments): Returns;
    canExecute(...args: Arguments): boolean;
    canStopExecution?(...args: Arguments): boolean;
    stopExecution?(...args: Arguments): Returns;
}
