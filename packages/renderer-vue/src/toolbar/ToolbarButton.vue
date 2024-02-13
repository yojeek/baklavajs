<template>
    <button
        class="baklava-toolbar-entry baklava-toolbar-button"
        :class="{ '--active': isExecuting }"
        :disabled="isDisabled"
        :title="title"
        @click="handleClick"
    >
        <component :is="icon" v-if="icon" />
        <template v-else>
            {{ title }}
        </template>
    </button>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useViewModel } from "../utility";

export default defineComponent({
    props: {
        command: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        icon: {
            type: Object,
            required: false,
            default: undefined,
        },
    },
    setup(props) {
        const { viewModel } = useViewModel();

        const isDisabled = computed(() => {
            const commandHandler = viewModel.value.commandHandler;

            return !commandHandler.canExecuteCommand(props.command) && !commandHandler.canStopExecution(props.command);
        });
        const isExecuting = computed(() => viewModel.value.commandHandler.canStopExecution(props.command));

        const handleClick = () => {
            if (!isExecuting.value) {
                viewModel.value.commandHandler.executeCommand(props.command);
            } else {
                viewModel.value.commandHandler.stopExecution(props.command);
            }
        };

        return { viewModel, isDisabled, isExecuting, handleClick };
    },
});
</script>

<style>
.baklava-toolbar-button.--active {
    color: var(--baklava-control-color-error);
}
</style>
