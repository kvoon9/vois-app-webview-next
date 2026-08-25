<script setup lang="ts">
import CategoryReportForm from '~/components/CategoryReportForm.vue'
</script>

<template>
  <CategoryReportForm
    endpoint="/v2/feedback/report-problem"
    i18n-namespace="report"
    list-key="types"
    section-label-key="problemType"
    textarea-label-key="whatHappened"
    placeholder-key="placeholder"
    submit-key="report"
    success-fallback-key="successTitle"
  />
</template>
