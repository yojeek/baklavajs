import { reactive, ref } from "vue";
import { ICommand } from "./command";
import { useHotkeyHandler } from "./hotkeyHandler";

export * from "./command";

type AbstractCommand = ICommand<any, any[]>;

export interface ICommandHandler {
    /**
     * @internal
     * Currently pressed keys
     */
    pressedKeys: string[];
    /**
     * Register a new command
     * @param name - Name of the command
     * @param command - Command definition
     */
    registerCommand<T extends AbstractCommand>(name: string, command: T): void;
    /**
     * Executes the command with the given name
     * @param name - Name of the command
     * @param throwOnNonexisting - Whether to throw an error if the command with the specified name does not exist.
     * If set to `false` and the command doesn't exist, the method will just return undefined.
     */
    executeCommand<T extends AbstractCommand>(
        name: string,
        throwOnNonexisting?: false,
        ...args: Parameters<T["execute"]>
    ): ReturnType<T["execute"]> | void;
    /**
     * Checks whether the command can be executed at the present time.
     * @param name - Name of the command
     * @param throwOnNonexisting - Whether to throw an error if the command with the specified name does not exist.
     * If set to `false` and the command doesn't exist, the method will just return `false`.
     */
    canExecuteCommand<T extends AbstractCommand>(
        name: string,
        throwOnNonexisting?: boolean,
        ...args: Parameters<T["execute"]>
    ): boolean;
    /**
     * Checks whether the command can be stopped at the present time.
     */
    canStopExecution<T extends AbstractCommand>(
        name: string,
        throwOnNonexisting?: boolean,
        ...args: Parameters<T["execute"]>
    ): boolean;
    /**
     * Stops the execution of the command with the given name.
     */
    stopExecution<T extends AbstractCommand>(
        name: string,
        throwOnNonexisting?: boolean,
        ...args: Parameters<T["execute"]>
    ): void;
    /**
     * Register a new hotkey combination for the command.
     * @param keys Combination of keys. When all keys in the given array are pressed at the same time, the command will be executed.
     * @param commandName Name of the command that should be executed when the keys are pressed.
     */
    registerHotkey(keys: string[], commandName: string): void;
    /** @internal */
    handleKeyUp(ev: KeyboardEvent): void;
    /** @internal */
    handleKeyDown(ev: KeyboardEvent): void;
}

export const useCommandHandler: () => ICommandHandler = () => {
    const commands = ref(new Map<string, AbstractCommand>());

    function checkCommandExists(name: string, throwOnNonexisting: any) {
        if (!commands.value.has(name)) {
            if (throwOnNonexisting) {
                throw new Error(`[CommandHandler] Command ${name} not registered`);
            } else {
                return false;
            }
        }

        return true;
    }

    const registerCommand = <T extends AbstractCommand>(name: string, command: T): void => {
        if (commands.value.has(name)) {
            throw new Error(`Command "${name}" already exists`);
        }
        commands.value.set(name, command);
    };

    const executeCommand = <T extends AbstractCommand>(
        name: string,
        throwOnNonexisting = false,
        ...args: Parameters<T["execute"]>
    ): ReturnType<T["execute"]> | void => {
        if (!checkCommandExists(name, throwOnNonexisting)) {
            return;
        }
        return commands.value.get(name)!.execute(...args);
    };

    const canExecuteCommand = <T extends AbstractCommand>(
        name: string,
        throwOnNonexisting = false,
        ...args: Parameters<T["execute"]>
    ): boolean => {
        if (!checkCommandExists(name, throwOnNonexisting)) {
            return false;
        }
        return commands.value.get(name)!.canExecute(args);
    };

    const canStopExecution = <T extends AbstractCommand>(
        name: string,
        throwOnNonexisting = false,
        ...args: Parameters<T["execute"]>
    ): boolean => {
        if (!checkCommandExists(name, throwOnNonexisting)) {
            return false;
        }
        const command = commands.value.get(name)!;
        return command.canStopExecution ?  command.canStopExecution(args) : false;
    };

    const stopExecution = <T extends AbstractCommand>(
        name: string,
        throwOnNonexisting = false,
        ...args: Parameters<T["execute"]>
    ): boolean => {
        if (!checkCommandExists(name, throwOnNonexisting)) {
            return false;
        }

        const command = commands.value.get(name)!;

        if (!command.stopExecution) {
            throw new Error(`[CommandHandler] Command ${name} does not support stopping execution`);
        }

        if (command.canStopExecution && !command.canStopExecution(args)) {
            throw new Error(`[CommandHandler] Command ${name} cannot be stopped at the moment`);
        }

        return command.stopExecution(args);
    }

    const hotkeyHandler = useHotkeyHandler(executeCommand);

    return reactive({
        registerCommand,
        executeCommand,
        canExecuteCommand,
        canStopExecution,
        stopExecution,
        ...hotkeyHandler
    });
};
