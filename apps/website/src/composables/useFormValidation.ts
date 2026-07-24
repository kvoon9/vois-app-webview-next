import { ref, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import {
  getDotPath,
  safeParseAsync,
  type BaseIssue,
  type GenericSchema,
  type GenericSchemaAsync,
  type InferInput,
} from 'valibot'

/**
 * Generic form schema whose input shape is an object keyed by field names.
 */
type FormSchema =
  | GenericSchema<Record<string, unknown>, unknown, BaseIssue<unknown>>
  | GenericSchemaAsync<Record<string, unknown>, unknown, BaseIssue<unknown>>

/**
 * Reusable form validation powered by valibot.
 *
 * @param schema - The valibot schema describing the form shape.
 * @param initialData - Initial form data or a getter for it.
 *
 * @returns Reactive `data`, per-field `errors`, and helpers to validate/reset.
 */
export function useFormValidation<TSchema extends FormSchema>(
  schema: TSchema,
  initialData: MaybeRefOrGetter<InferInput<TSchema>>,
) {
  type Data = InferInput<TSchema>

  // `ref` is used here because form fields are bound deeply in templates and
  // need fine-grained updates when individual properties change.
  const data = ref<Data>(cloneInitialData(toValue(initialData)))
  const errors = shallowRef<Record<string, string>>({})

  function cloneInitialData(value: Data): Data {
    // Form payloads are plain objects of primitives; a shallow clone is enough
    // to keep the composable from mutating the caller's initial value.
    return { ...value }
  }

  /**
   * Validate every field and populate `errors` with the first message per field.
   *
   * @returns `true` when the current data passes the schema.
   */
  async function validate(): Promise<boolean> {
    const result = await safeParseAsync(schema, data.value)

    if (result.success) {
      errors.value = {}
      return true
    }

    const nextErrors: Record<string, string> = {}
    for (const issue of result.issues) {
      const path = getDotPath(issue)
      if (path && !(path in nextErrors)) {
        nextErrors[path] = issue.message
      }
    }
    errors.value = nextErrors
    return false
  }

  /**
   * Validate a single field and update only that field's error entry.
   *
   * @param path - Dot path of the field to validate (e.g. `content`).
   * @returns `true` when the field has no error after validation.
   */
  async function validateField(path: string): Promise<boolean> {
    const result = await safeParseAsync(schema, data.value)
    const nextErrors = { ...errors.value }
    delete nextErrors[path]

    if (!result.success) {
      const issue = result.issues.find((item) => getDotPath(item) === path)
      if (issue) {
        nextErrors[path] = issue.message
      }
    }

    errors.value = nextErrors
    return !errors.value[path]
  }

  /** Clear all recorded validation errors. */
  function resetErrors(): void {
    errors.value = {}
  }

  return {
    data: data as Ref<Data>,
    errors,
    resetErrors,
    validate,
    validateField,
  }
}
