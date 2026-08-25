<script setup lang="ts">
import CategoryReportForm from '~/components/CategoryReportForm.vue'
</script>

<template>
  <CategoryReportForm
    endpoint="/v2/feedback/submit-feedback"
    i18n-namespace="feedback"
    list-key="categories"
    section-label-key="category"
    textarea-label-key="yourFeedback"
    placeholder-key="placeholder"
    submit-key="submit"
    success-fallback-key="successTitle"
  />
</template>
