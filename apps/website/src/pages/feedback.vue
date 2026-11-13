<script setup lang="ts">
import CategoryReportForm from '~/components/CategoryReportForm.vue'
</script>

<template>
  <CategoryReportForm endpoint="/v2/feedback/submit-feedback" namespace="feedback" />
</template>
