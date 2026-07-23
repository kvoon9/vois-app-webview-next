<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'BaseModal',
  props: {
    title: {
      type: String,
      required: true,
    },
    cancelText: {
      type: String,
      default: 'Cancel',
    },
    confirmText: {
      type: String,
      default: 'Confirm',
    },
  },
  emits: ['cancel', 'confirm'],
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      @click.self="$emit('cancel')"
    >
      <div
        class="w-full max-w-sm rounded-large bg-surface text-text-primary shadow-xl"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @keydown.esc="$emit('cancel')"
      >
        <header class="border-b border-stroke p-4 text-header font-semibold">
          <slot name="header"
            ><div>{{ title }}</div></slot
          >
        </header>
        <div class="p-4 text-body">
          <slot />
        </div>
        <footer class="border-t border-stroke p-4">
          <slot name="footer">
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                class="rounded-small px-4 py-2 text-text-secondary"
                @click="$emit('cancel')"
              >
                {{ cancelText }}
              </button>
              <button
                type="button"
                class="rounded-small bg-primary px-4 py-2 text-primary-text"
                @click="$emit('confirm')"
              >
                {{ confirmText }}
              </button>
            </div>
          </slot>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
